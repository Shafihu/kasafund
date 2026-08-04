import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../src/models/User.js";

test("allows a Google user to be created without a local password", async () => {
  const user = new User({
    fullName: "Ama Mensah",
    email: "ama@example.com",
    googleId: "google-subject-123",
    isEmailVerified: true,
  });

  await assert.doesNotReject(() => user.validate());
});

test("still requires a password for a local account", async () => {
  const user = new User({
    fullName: "Kojo Asare",
    email: "kojo@example.com",
  });

  await assert.rejects(
    () => user.validate(),
    (error) => error?.errors?.passwordHash?.kind === "required"
  );
});
