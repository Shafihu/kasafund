import mongoose from "mongoose";

const userAchievementSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    badgeId: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    points: { type: Number, required: true, min: 0, validate: Number.isInteger },
    earnedAt: { type: Date, required: true },
    presentedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userAchievementSchema.index({ userId: 1, badgeId: 1 }, { unique: true });
userAchievementSchema.index({ userId: 1, presentedAt: 1, earnedAt: 1 });

export const UserAchievement = mongoose.model("UserAchievement", userAchievementSchema);
