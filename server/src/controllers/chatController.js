import mongoose from "mongoose";
import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupMessage } from "../models/GroupMessage.js";

const activeMembership = (groupId, userId) =>
  GroupMember.findOne({ groupId, userId, status: "active" });

export function serializeMessage(message) {
  const value = message.toObject ? message.toObject() : message;
  return {
    _id: String(value._id),
    groupId: String(value.groupId),
    sender: value.senderId && typeof value.senderId === "object"
      ? {
          _id: String(value.senderId._id),
          fullName: value.senderId.fullName,
          avatarUrl: value.senderId.avatarUrl || value.senderId.profileImage || "",
        }
      : { _id: String(value.senderId) },
    text: value.deletedAt ? "This message was deleted" : value.text,
    type: value.type,
    deletedAt: value.deletedAt || null,
    createdAt: value.createdAt,
  };
}

export async function listMessages(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid group" });
  }
  const member = await activeMembership(req.params.id, req.user._id);
  if (!member) return res.status(403).json({ success: false, message: "Active membership required" });

  const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 80);
  const filter = { groupId: req.params.id };
  if (req.query.before && !Number.isNaN(new Date(req.query.before).getTime())) {
    filter.createdAt = { $lt: new Date(req.query.before) };
  }
  const messages = await GroupMessage.find(filter)
    .populate("senderId", "fullName avatarUrl profileImage")
    .sort({ createdAt: -1 })
    .limit(limit);
  return res.json({ success: true, data: messages.reverse().map(serializeMessage) });
}

export async function markChatRead(req, res) {
  const member = await activeMembership(req.params.id, req.user._id);
  if (!member) return res.status(403).json({ success: false, message: "Active membership required" });
  member.chatLastReadAt = new Date();
  await member.save();
  return res.json({ success: true, data: { unreadCount: 0 } });
}

export async function unreadChatCount(req, res) {
  const member = await activeMembership(req.params.id, req.user._id);
  if (!member) return res.status(403).json({ success: false, message: "Active membership required" });
  const unreadCount = await getUnreadCount(req.params.id, member);
  return res.json({ success: true, data: { unreadCount } });
}

export async function deleteMessage(req, res) {
  const member = await activeMembership(req.params.id, req.user._id);
  if (!member) return res.status(403).json({ success: false, message: "Active membership required" });
  const message = await GroupMessage.findOne({ _id: req.params.messageId, groupId: req.params.id });
  if (!message) return res.status(404).json({ success: false, message: "Message not found" });
  const canDelete = String(message.senderId) === String(req.user._id) || member.role === "owner";
  if (!canDelete) return res.status(403).json({ success: false, message: "You cannot delete this message" });
  message.deletedAt = new Date();
  await message.save();
  req.app.get("io")?.to(`group:${req.params.id}`).emit("chat:message_deleted", {
    groupId: req.params.id,
    messageId: String(message._id),
    deletedAt: message.deletedAt,
  });
  return res.json({ success: true, data: serializeMessage(message) });
}

export async function getUnreadCount(groupId, member) {
  if (!member) return 0;
  return GroupMessage.countDocuments({
    groupId,
    senderId: { $ne: member.userId },
    createdAt: { $gt: member.chatLastReadAt || member.joinedAt || new Date(0) },
  });
}

export async function ensureChatGroup(groupId) {
  return Group.exists({ _id: groupId, status: { $ne: "archived" } });
}
