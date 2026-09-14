import assert from "node:assert/strict";
import test from "node:test";
import { parsePostGroupPage } from "./navigation.ts";

test("group pagination accepts the first page and positive integer page numbers", () => {
  assert.equal(parsePostGroupPage(undefined), 1);
  assert.equal(parsePostGroupPage("1"), 1);
  assert.equal(parsePostGroupPage("27"), 27);
});

test("ambiguous, fractional and unbounded page queries cannot reach a database offset", () => {
  for (const value of ["", "0", "-1", "1.5", "1e3", "01", " 2", "Infinity", "100001", "9007199254740992", ["1", "2"]]) {
    assert.equal(parsePostGroupPage(value), undefined);
  }
});
