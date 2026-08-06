import crypto from "crypto";
import { listPayoutProviders } from "../payoutProviderDirectoryService.js";

const MOCK_NOTE =
  "Simulated transfer: Paystack live payouts are disabled and no real money was sent.";
const completedTransfers = new Map();

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mockTransfer({ reference, transferCode, amount, recipientCode }) {
  return {
    status: "success",
    transferCode,
    reference,
    mode: "mock",
    mocked: true,
    note: MOCK_NOTE,
    message: "Demo withdrawal completed — no real money was sent.",
    raw: {
      mocked: true,
      note: MOCK_NOTE,
      status: "success",
      reference,
      transfer_code: transferCode,
      amount,
      recipient: recipientCode,
    },
  };
}

export const mockTransferService = Object.freeze({
  mode: "mock",

  async listProviders(type = "mobile_money") {
    await delay(400);
    return listPayoutProviders(type, { allowFallback: true });
  },

  async createRecipient({ name, accountNumber, providerCode }) {
    await delay(400);
    return {
      recipientCode: `RCP_mock_${crypto.randomBytes(8).toString("hex")}`,
      mode: "mock",
      mocked: true,
      note: MOCK_NOTE,
      accountName: name,
      raw: {
        mocked: true,
        note: MOCK_NOTE,
        providerCode,
        accountLast4: accountNumber.slice(-4),
      },
    };
  },

  async initiate({ amount, recipientCode, reference }) {
    await delay(800);
    const result = mockTransfer({
      reference,
      amount,
      recipientCode,
      transferCode: `TRF_mock_${crypto.randomBytes(8).toString("hex")}`,
    });
    completedTransfers.set(reference, result);
    return result;
  },

  async verify(reference) {
    await delay(400);
    const transfer = completedTransfers.get(reference);
    if (!transfer) {
      const error = new Error("Mock transfer not found");
      error.statusCode = 404;
      throw error;
    }
    return transfer;
  },

  async finalize({ transferCode }) {
    await delay(400);
    const transfer = [...completedTransfers.values()].find(
      (item) => item.transferCode === transferCode
    );
    if (!transfer) {
      const error = new Error("Mock transfer not found");
      error.statusCode = 404;
      throw error;
    }
    return transfer;
  },
});
