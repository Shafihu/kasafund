import { cloudinaryIsConfigured, uploadImageBuffer } from "../services/cloudinaryService.js";

const PURPOSES = {
  profile: { folder: "profiles", maxWidth: 800, maxHeight: 800 },
  group: { folder: "groups", maxWidth: 1600, maxHeight: 1200 },
  campaign: { folder: "campaigns", maxWidth: 1600, maxHeight: 1200 },
};

export async function uploadImage(req, res) {
  if (!cloudinaryIsConfigured()) {
    return res.status(503).json({ success: false, message: "Image uploads are not configured" });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Choose an image to upload" });
  }
  const settings = PURPOSES[req.body.purpose];
  if (!settings) {
    return res.status(400).json({ success: false, message: "Invalid image purpose" });
  }

  const result = await uploadImageBuffer(req.file.buffer, settings);
  return res.status(201).json({
    success: true,
    data: {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    },
  });
}
