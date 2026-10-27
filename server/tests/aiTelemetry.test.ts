import { test } from "node:test";
import assert from "node:assert/strict";
import { redactAiTelemetry } from "../../src/shared/aiTelemetry.js";
test("AI error reports and traces remove credentials, consent queries and private request bodies", () => {
  const token = "bnx_at_" + "x".repeat(43);
  const report = {
    request: {
      url: "https://bsenexus.in/mcp?request=private",
      headers: { Authorization: token, Cookie: "session=private" },
      data: { text: "personal note", code_verifier: "private" },
    },
    breadcrumbs: [
      {
        data: {
          url: "https://bsenexus.in/plugin?request=bnx_req_" + "y".repeat(43),
        },
      },
    ],
    exception: { value: "Expired " + token },
  };
  const safe = redactAiTelemetry(report);
  assert.equal(safe.request.url, "https://bsenexus.in/mcp");
  assert.equal(safe.request.data as any, "[REDACTED]");
  const text = JSON.stringify(safe);
  for (const privateValue of [
    token,
    "personal note",
    "session=private",
    "request=private",
  ])
    assert.ok(!text.includes(privateValue));
  assert.equal(
    report.request.data.text,
    "personal note",
    "sanitizing does not mutate the request",
  );
  const ordinary = {
    message: "Source unavailable",
    request: { url: "https://bsenexus.in/health?detail=1" },
    tags: { code: "source_unavailable" },
  };
  assert.deepEqual(redactAiTelemetry(ordinary), ordinary);
});
