import { test } from "node:test";
import assert from "node:assert/strict";
import { SPA_PATHS, normalizeSpaPath } from "../utils/spaRoutes.js";

test("known SPA paths preserve Settings and consent aliases without accepting unknown routes", () => {
  const known = new Set(SPA_PATHS);
  for (const path of ["/settings", "/Settings/", "/plugin/", "/AI-PLUGIN/"]) {
    assert.ok(known.has(normalizeSpaPath(path)), path);
  }
  for (const path of ["/authorize", "/plugin/unknown", "/settings/admin", "/not-a-route", "//evil.example"]) {
    assert.equal(known.has(normalizeSpaPath(path)), false, path);
  }
});

