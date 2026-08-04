import {
  createTransferRecipient,
  finalizeTransfer,
  initiateTransfer,
  listGhanaMobileMoneyProviders,
  verifyTransfer,
} from "../paystackService.js";

function normalizeTransfer(raw) {
  return {
    status: raw.status,
    transferCode: raw.transfer_code || "",
    reference: raw.reference,
    mode: "live",
    mocked: false,
    note: "Processed by Paystack Transfers",
    message:
      raw.status === "otp"
        ? "Enter the transfer OTP to continue"
        : "Withdrawal submitted",
    raw,
  };
}

export const liveTransferService = Object.freeze({
  mode: "live",

  async listProviders() {
    const providers = await listGhanaMobileMoneyProviders();
    return providers
      .filter((provider) => provider.active !== false)
      .map((provider) => ({ code: provider.code, name: provider.name }));
  },

  async createRecipient({ name, accountNumber, providerCode, currency }) {
    const raw = await createTransferRecipient({
      type: "mobile_money",
      name,
      account_number: accountNumber,
      bank_code: providerCode,
      currency,
    });
    return {
      recipientCode: raw.recipient_code,
      mode: "live",
      mocked: false,
      note: "Paystack transfer recipient",
      raw,
    };
  },

  async initiate({ amount, recipientCode, reference, reason, currency }) {
    const raw = await initiateTransfer({
      source: "balance",
      amount,
      recipient: recipientCode,
      reference,
      reason,
      currency,
    });
    return normalizeTransfer(raw);
  },

  async verify(reference) {
    return normalizeTransfer(await verifyTransfer(reference));
  },

  async finalize({ transferCode, otp }) {
    return normalizeTransfer(
      await finalizeTransfer({ transfer_code: transferCode, otp })
    );
  },
});
