import { test } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin, parseAllowList } from "../src/lib/origin.ts";

const tunnel = parseAllowList("https://*.devtunnels.ms, https://choosify.example");

test("gleicher Host ist erlaubt", () => {
  assert.equal(isAllowedOrigin("http://localhost:3000", ["", "localhost:3000"], []), true);
});

test("fremde Seite ist blockiert", () => {
  assert.equal(isAllowedOrigin("https://evil.example", ["", "localhost:3000"], tunnel), false);
});

test("Dev Tunnel per Wildcard erlaubt", () => {
  assert.equal(isAllowedOrigin("https://abc123-3000.euw.devtunnels.ms", ["", "localhost:3000"], tunnel), true);
});

test("Wildcard erlaubt keine Tricks", () => {
  assert.equal(isAllowedOrigin("https://devtunnels.ms", [], tunnel), false);
  assert.equal(isAllowedOrigin("https://evildevtunnels.ms", [], tunnel), false);
  assert.equal(isAllowedOrigin("https://x.devtunnels.ms.evil.example", [], tunnel), false);
  assert.equal(isAllowedOrigin("http://abc.devtunnels.ms", [], tunnel), false);
});

test("exakte Origin erlaubt", () => {
  assert.equal(isAllowedOrigin("https://choosify.example", [], tunnel), true);
  assert.equal(isAllowedOrigin("https://choosify.example:8443", [], tunnel), false);
});

test("kaputte Origin", () => {
  assert.equal(isAllowedOrigin("null", ["localhost"], tunnel), false);
});
