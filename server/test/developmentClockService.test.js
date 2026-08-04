import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSimulatedGroupTime,
  getSimulatedGroupTime,
  nowForGroup,
  setSimulatedGroupTime,
} from "../src/services/developmentClockService.js";

test("isolates simulated time by group and restores real time on reset", () => {
  const groupA = "group-a";
  const groupB = "group-b";
  const simulated = new Date("2026-08-05T10:30:00.000Z");

  setSimulatedGroupTime(groupA, simulated);
  assert.equal(nowForGroup(groupA).toISOString(), simulated.toISOString());
  assert.equal(getSimulatedGroupTime(groupB), null);

  clearSimulatedGroupTime(groupA);
  assert.equal(getSimulatedGroupTime(groupA), null);
  assert.ok(Math.abs(nowForGroup(groupA).getTime() - Date.now()) < 1_000);
});

test("rejects invalid simulated timestamps", () => {
  assert.throws(
    () => setSimulatedGroupTime("group-a", "not-a-date"),
    /Invalid simulated time/
  );
});
