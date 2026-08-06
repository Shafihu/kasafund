import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../src/models/User.js";

function userWithPayoutMethod(overrides = {}) {
  return new User({
    fullName: "Ama Mensah",
    email: "ama-payout@example.com",
    passwordHash: "hash",
    payoutMethod: {
      type: "mobile_money",
      providerCode: "MTN",
      providerName: "MTN",
      accountName: "Ama Mensah",
      accountLast4: "4567",
      recipientCode: "RCP_private_reference",
      transferMode: "mock",
      verifiedAt: new Date(),
      ...overrides,
    },
  });
}

test("keeps the transfer recipient code out of user API JSON", () => {
  const json = userWithPayoutMethod().toJSON();
  assert.equal(json.payoutMethod.accountLast4, "4567");
  assert.equal(json.payoutMethod.recipientCode, undefined);
});

test("accepts bank and mobile money payout methods", () => {
  assert.equal(userWithPayoutMethod().validateSync(), undefined);
  assert.equal(userWithPayoutMethod({ type: "bank", providerCode: "GCB", providerName: "GCB Bank" }).validateSync(), undefined);
});

test("rejects unsupported payout method types", () => {
  const error = userWithPayoutMethod({ type: "crypto" }).validateSync();
  assert.match(error.errors["payoutMethod.type"].message, /not a valid enum value/i);
});
