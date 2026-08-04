import mongoose from "mongoose";

const groupInvitationSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    invitedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    invitedPhone: { type: String, default: "", trim: true },
    invitedEmail: { type: String, default: "", trim: true, lowercase: true },
    payoutPosition: { type: Number, default: null, min: 0 },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "group_invitations" }
);

groupInvitationSchema.index({ groupId: 1, status: 1 });
groupInvitationSchema.index({ invitedUserId: 1, status: 1 });
groupInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GroupInvitation = mongoose.model("GroupInvitation", groupInvitationSchema);
