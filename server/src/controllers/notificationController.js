import { Notification } from "../models/Notification.js";
import { pagination, sendPage } from "../utils/api.js";

export async function listNotifications(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const filter = { userId: req.user._id, ...(req.query.unread === "true" ? { isRead: false } : {}) };
  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);
  return sendPage(res, notifications, page, limit, total);
}

export async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
  return res.json({ success: true, data: notification });
}

export async function markAllNotificationsRead(req, res) {
  await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  return res.status(204).send();
}
