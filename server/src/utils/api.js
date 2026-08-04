import crypto from "crypto";
import { AuditLog } from "../models/AuditLog.js";

export function createShortCode(length = 8) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

export function isHostedImageUrl(value) {
  if (value === undefined || value === null || value === "") return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function pagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

export function audit({ actorId, action, targetType, targetId, metadata = {}, session }) {
  return AuditLog.create(
    [{ actorId, action, targetType, targetId, metadata }],
    session ? { session } : undefined
  );
}

export function sendPage(res, items, page, limit, total) {
  return res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
