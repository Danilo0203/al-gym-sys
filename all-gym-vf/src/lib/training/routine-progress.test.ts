import assert from "node:assert/strict";
import test from "node:test";
import { getDayProgress } from "./routine-progress";

test("a day completes only when every assigned exercise is done, and unmarking reopens it", () => {
  const day = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(getDayProgress(day, new Set([1])), { completed: 1, total: 2, isComplete: false });
  assert.deepEqual(getDayProgress(day, new Set([1, 2])), { completed: 2, total: 2, isComplete: true });
  assert.equal(getDayProgress(day, new Set([2])).isComplete, false);
});

test("empty days and removed exercises never count as complete", () => {
  assert.deepEqual(getDayProgress([], new Set([1])), { completed: 0, total: 0, isComplete: false });
  assert.deepEqual(getDayProgress([{ id: 2 }, { id: 3 }], new Set([1, 2])), { completed: 1, total: 2, isComplete: false });
});

test("repeating the same exercise on another day has independent completion", () => {
  const completed = new Set([10]);
  assert.equal(getDayProgress([{ id: 10 }], completed).isComplete, true);
  assert.equal(getDayProgress([{ id: 11 }], completed).isComplete, false);
});
