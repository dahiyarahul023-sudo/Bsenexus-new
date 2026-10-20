import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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

test("both shell owners use the route catalogue, normalize paths and keep Settings private", () => {
  const source = fs.readFileSync("server.ts", "utf8");
  assert.ok(source.includes("app.get(SPA_PATHS, async"));
  assert.ok(source.includes("new Set(SPA_PATHS)"));
  assert.ok(source.includes("VALID_SPA_ROUTES.has(routePath)"));
  assert.equal((source.match(/routePath === "\/settings" \? "settings"/g) || []).length, 2);
  assert.ok(source.includes("p === '/settings') return 'no-store'"));
  assert.equal((source.match(/setHeader\('X-Robots-Tag', 'noindex, nofollow'\)/g) || []).length >= 2, true);
  assert.ok(source.includes("res.status(404)"));
});
