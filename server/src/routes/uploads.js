import { Router } from "express";
import multer from "multer";
import { uploadImage } from "../controllers/uploadController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (allowedTypes.has(file.mimetype)) callback(null, true);
    else callback(new Error("Only JPEG, PNG, WebP, or HEIC images are supported"));
  },
});

router.post(
  "/image",
  requireAuth,
  (req, res, next) => {
    imageUpload.single("image")(req, res, (error) => {
      if (!error) return next();
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Image must be smaller than 8 MB"
        : error.message;
      return res.status(400).json({ success: false, message });
    });
  },
  uploadImage
);

export default router;
