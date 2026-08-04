import { Router } from "express";
import { deleteMessage, listMessages, markChatRead, unreadChatCount } from "../controllers/chatController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);
router.get("/", listMessages);
router.get("/unread", unreadChatCount);
router.post("/read", markChatRead);
router.delete("/:messageId", deleteMessage);

export default router;
