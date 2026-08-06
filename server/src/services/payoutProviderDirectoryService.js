import {
  listGhanaBanks,
  listGhanaMobileMoneyProviders,
} from "./paystackService.js";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

const fallbackProviders = Object.freeze({
  bank: [
    { code: "GCB", name: "GCB Bank" },
    { code: "ECOBANK", name: "Ecobank Ghana" },
    { code: "FIDELITY", name: "Fidelity Bank Ghana" },
    { code: "ABSA", name: "Absa Bank Ghana" },
    { code: "STANBIC", name: "Stanbic Bank Ghana" },
  ],
  mobile_money: [
    { code: "MTN", name: "MTN MoMo" },
    { code: "ATL", name: "AT Money" },
    { code: "VOD", name: "Telecel Cash" },
  ],
});

function displayName(provider, type) {
  if (type !== "mobile_money") return provider.name;
  return {
    MTN: "MTN MoMo",
    ATL: "AT Money",
    VOD: "Telecel Cash",
  }[String(provider.code).toUpperCase()] || provider.name;
}

export function normalizePayoutProviders(providers, type) {
  const seen = new Set();
  return providers
    .filter((provider) => provider.active !== false && provider.is_deleted !== true)
    .filter((provider) => type !== "bank" || !/bank of ghana/i.test(provider.name))
    .map((provider) => ({
      code: String(provider.code).toUpperCase(),
      name: displayName(provider, type),
    }))
    .filter((provider) => {
      if (!provider.code || seen.has(provider.code)) return false;
      seen.add(provider.code);
      return true;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listPayoutProviders(type = "mobile_money", { allowFallback = false } = {}) {
  const normalizedType = type === "bank" ? "bank" : "mobile_money";
  const cached = cache.get(normalizedType);
  if (cached && cached.expiresAt > Date.now()) return cached.providers;

  try {
    const rawProviders = normalizedType === "bank"
      ? await listGhanaBanks()
      : await listGhanaMobileMoneyProviders();
    const providers = normalizePayoutProviders(rawProviders, normalizedType);
    if (!providers.length) throw new Error("No payout providers returned");
    cache.set(normalizedType, {
      providers,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return providers;
  } catch (error) {
    if (!allowFallback) throw error;
    return fallbackProviders[normalizedType];
  }
}
