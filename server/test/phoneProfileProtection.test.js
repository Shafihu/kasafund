import assert from "node:assert/strict";
import test from "node:test";
import { updateProfile } from "../src/controllers/authController.js";

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("ordinary profile updates cannot replace a phone number", async () => {
  const response = responseRecorder();
  const user = {
    phone: "+233241111111",
    fullName: "Ama Serwaa",
    save: () => assert.fail("an unverified phone change must not be saved"),
  };

  await updateProfile(
    { user, body: { phoneNumber: "024 222 2222" } },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "PHONE_VERIFICATION_REQUIRED");
  assert.equal(user.phone, "+233241111111");
});
