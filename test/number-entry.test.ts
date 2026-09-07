import assert from "node:assert/strict";
import test from "node:test";
import {
  editEntry,
  formatEntry,
} from "../src/components/interval/number-entry.js";
import { parseAmount } from "../src/components/interval/game.js";

test("three-zero key builds thousands and millions without including commas in the value", () => {
  let display = "1";
  for (const expected of ["1,000", "1,000,000", "1,000,000,000"]) {
    const next = editEntry(display, display.length, display.length, "000");
    display = formatEntry(next.value);
    assert.equal(display, expected);
    assert.equal(next.cursor, display.length);
    assert.ok(!next.value.includes(","));
    assert.equal(parseAmount(display), Number(next.value));
  }
});

test("formatting preserves precision, fractional zeros, and unfinished scientific notation", () => {
  for (const [raw, display] of [
    ["12345678901234567890", "12,345,678,901,234,567,890"],
    ["1234.0050", "1,234.0050"],
    ["1234.", "1,234."],
    ["1234E", "1,234E"],
    ["4E-5", "4E-5"],
    [".005", ".005"],
    ["-12345", "-12,345"],
    ["1,234,567", "1,234,567"],
  ])
    assert.equal(formatEntry(raw), display);
});

test("deleting at grouping separators removes digits instead of getting stuck on commas", () => {
  assert.deepEqual(editEntry("1,234", 2, 2, "Delete"), {
    value: "234",
    cursor: 0,
  });
  assert.deepEqual(editEntry("1,234", 1, 1, "DeleteForward"), {
    value: "134",
    cursor: 1,
  });
  assert.deepEqual(editEntry("1,000", 5, 5, "Delete"), {
    value: "100",
    cursor: 3,
  });
});

test("inserting and replacing within grouped numbers preserves the editing position", () => {
  assert.deepEqual(editEntry("12,345", 2, 2, "000"), {
    value: "12000345",
    cursor: 6,
  });
  assert.deepEqual(editEntry("1,234,567", 2, 5, "9"), {
    value: "19567",
    cursor: 2,
  });
  assert.deepEqual(editEntry("1,234", 0, 5, "8"), { value: "8", cursor: 1 });
});
