import assert from "node:assert/strict";
import test from "node:test";
import { normalizePayoutProviders } from "../src/services/payoutProviderDirectoryService.js";

test("normalizes current Ghana mobile money names", () => {
  assert.deepEqual(
    normalizePayoutProviders([
      { code: "MTN", name: "MTN", active: true },
      { code: "ATL", name: "AirtelTigo", active: true },
      { code: "VOD", name: "Vodafone", active: true },
    ], "mobile_money"),
    [
      { code: "ATL", name: "AT Money" },
      { code: "MTN", name: "MTN MoMo" },
      { code: "VOD", name: "Telecel Cash" },
    ]
  );
});

test("filters unsupported Ghana bank directory entries", () => {
  assert.deepEqual(
    normalizePayoutProviders([
      { code: "BOG", name: "Bank of Ghana", active: true },
      { code: "GCB", name: "GCB Bank", active: true },
      { code: "OLD", name: "Old Bank", active: false },
      { code: "GCB", name: "GCB Bank duplicate", active: true },
    ], "bank"),
    [{ code: "GCB", name: "GCB Bank" }]
  );
});
