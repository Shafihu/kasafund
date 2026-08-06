const PAYSTACK_BASE_URL = "https://api.paystack.co";

function ensureConfigured() {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    const error = new Error("Payments are not configured");
    error.statusCode = 503;
    throw error;
  }
}

async function paystackRequest(path, { method = "GET", body } = {}) {
  ensureConfigured();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.status) {
      const gatewayMessage = result.message || "Paystack request failed";
      const message = gatewayMessage
        .toLowerCase()
        .includes("third party payouts as a starter business")
        ? "Withdrawals require a Registered Paystack business. Upgrade your business in the Paystack Dashboard to enable payouts."
        : gatewayMessage;
      const error = new Error(message);
      error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
      error.paystackData = result.data;
      throw error;
    }

    return result.data;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Paystack did not respond in time");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function initializeTransaction(payload) {
  return paystackRequest("/transaction/initialize", { method: "POST", body: payload });
}

export function verifyTransaction(reference) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export function listGhanaMobileMoneyProviders() {
  return paystackRequest("/bank?country=ghana&currency=GHS&type=mobile_money&perPage=100");
}

export function listGhanaBanks() {
  return paystackRequest("/bank?country=ghana&currency=GHS&type=ghipss&perPage=100");
}

export function createTransferRecipient(payload) {
  return paystackRequest("/transferrecipient", { method: "POST", body: payload });
}

export function initiateTransfer(payload) {
  return paystackRequest("/transfer", { method: "POST", body: payload });
}

export function verifyTransfer(reference) {
  return paystackRequest(`/transfer/verify/${encodeURIComponent(reference)}`);
}

export function finalizeTransfer(payload) {
  return paystackRequest("/transfer/finalize_transfer", { method: "POST", body: payload });
}
