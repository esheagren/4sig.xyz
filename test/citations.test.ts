import assert from "node:assert/strict";
import test from "node:test";
import { citations } from "../src/components/interval/citations.js";
test("legacy citations become separate usable named links without losing query strings", () => {
  assert.deepEqual(
    citations(
      "https://example.com/a; https://example.org/b?x=1&y=2",
      "First; Second",
    ),
    [
      { url: "https://example.com/a", label: "First" },
      { url: "https://example.org/b?x=1&y=2", label: "Second" },
    ],
  );
  assert.deepEqual(
    citations("https://www.example.com/a; https://www.example.com/a"),
    [{ url: "https://www.example.com/a", label: "example.com" }],
  );
});
test("malformed and unsafe citations never produce navigable links", () => {
  assert.deepEqual(
    citations(
      "javascript:alert(1);data:text/html,bad;https://user:pass@example.com;not a URL;",
    ),
    [],
  );
  assert.deepEqual(citations("bad;https://example.org", "Bad;Good"), [
    { url: "https://example.org/", label: "Good" },
  ]);
});
