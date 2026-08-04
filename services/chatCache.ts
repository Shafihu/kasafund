import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ApiGroupMessage } from "./apiService";

const CACHE_VERSION = 1;
const MAX_CACHED_MESSAGES = 100;

function cacheKey(groupId: string, userId: string) {
  return `@KasaFund:chat:v${CACHE_VERSION}:${userId}:${groupId}`;
}

export async function getCachedMessages(groupId: string, userId: string) {
  try {
    const value = await AsyncStorage.getItem(cacheKey(groupId, userId));
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as ApiGroupMessage[] : [];
  } catch {
    return [];
  }
}

export async function cacheMessages(groupId: string, userId: string, messages: ApiGroupMessage[]) {
  try {
    await AsyncStorage.setItem(
      cacheKey(groupId, userId),
      JSON.stringify(messages.slice(-MAX_CACHED_MESSAGES))
    );
  } catch {
    // Chat remains usable if the device cannot persist its local cache.
  }
}

export function mergeMessages(cached: ApiGroupMessage[], fresh: ApiGroupMessage[]) {
  const byId = new Map(cached.map((message) => [message._id, message]));
  fresh.forEach((message) => byId.set(message._id, message));
  return [...byId.values()]
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .slice(-MAX_CACHED_MESSAGES);
}
