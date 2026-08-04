import jwt from "jsonwebtoken";
import { GroupMember } from "../models/GroupMember.js";
import { GroupMessage } from "../models/GroupMessage.js";
import { User } from "../models/User.js";
import { ensureChatGroup, serializeMessage } from "../controllers/chatController.js";

export function configureChatSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.userId).select("fullName avatarUrl profileImage isActive");
      if (!user?.isActive) return next(new Error("Invalid account"));
      socket.user = user;
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const typingGroups = new Set();
    socket.on("chat:join", async ({ groupId, markRead = true } = {}, acknowledge = () => {}) => {
      try {
        const [member, groupExists] = await Promise.all([
          GroupMember.findOne({ groupId, userId: socket.user._id, status: "active" }),
          ensureChatGroup(groupId),
        ]);
        if (!member || !groupExists) return acknowledge({ success: false, message: "Active membership required" });
        await socket.join(`group:${groupId}`);
        if (markRead) {
          member.chatLastReadAt = new Date();
          await member.save();
        }
        return acknowledge({ success: true });
      } catch {
        return acknowledge({ success: false, message: "Could not join group chat" });
      }
    });

    socket.on("chat:send", async ({ groupId, text } = {}, acknowledge = () => {}) => {
      try {
        const cleanText = typeof text === "string" ? text.trim() : "";
        if (!cleanText || cleanText.length > 1000) {
          return acknowledge({ success: false, message: "Message must be between 1 and 1000 characters" });
        }
        const member = await GroupMember.findOne({ groupId, userId: socket.user._id, status: "active" });
        if (!member) return acknowledge({ success: false, message: "Active membership required" });
        const created = await GroupMessage.create({ groupId, senderId: socket.user._id, text: cleanText });
        await created.populate("senderId", "fullName avatarUrl profileImage");
        const message = serializeMessage(created);
        io.to(`group:${groupId}`).emit("chat:message", message);
        acknowledge({ success: true, data: message });
      } catch {
        acknowledge({ success: false, message: "Message could not be sent" });
      }
    });

    socket.on("chat:typing", ({ groupId, isTyping } = {}) => {
      const room = `group:${groupId}`;
      if (!groupId || !socket.rooms.has(room)) return;
      if (isTyping) typingGroups.add(String(groupId));
      else typingGroups.delete(String(groupId));
      socket.to(room).emit("chat:typing", {
        groupId: String(groupId),
        userId: String(socket.user._id),
        fullName: socket.user.fullName,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on("disconnecting", () => {
      typingGroups.forEach((groupId) => {
        socket.to(`group:${groupId}`).emit("chat:typing", {
          groupId,
          userId: String(socket.user._id),
          fullName: socket.user.fullName,
          isTyping: false,
        });
      });
    });
  });
}
