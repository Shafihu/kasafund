import assert from "node:assert/strict";
import test from "node:test";
import {
  maskPhoneNumber,
  normalizePhoneNumber,
} from "../src/services/phoneVerificationService.js";

test("normalizes common Ghana phone formats to E.164", () => {
  assert.equal(normalizePhoneNumber("024 123 4567"), "+233241234567");
  assert.equal(normalizePhoneNumber("233 24 123 4567"), "+233241234567");
  assert.equal(normalizePhoneNumber("24-123-4567"), "+233241234567");
  assert.equal(normalizePhoneNumber("+233 24 123 4567"), "+233241234567");
});

test("preserves valid international E.164 numbers", () => {
  assert.equal(normalizePhoneNumber("+1 (501) 712-2661"), "+15017122661");
  assert.equal(normalizePhoneNumber("+44 7700 900123"), "+447700900123");
});

test("rejects empty, short, or ambiguous phone input", () => {
  assert.equal(normalizePhoneNumber(""), null);
  assert.equal(normalizePhoneNumber("12345"), null);
  assert.equal(normalizePhoneNumber("not a number"), null);
});

test("masks all but the final four phone digits", () => {
  assert.equal(maskPhoneNumber("+233241234567"), "•••• 4567");
});
