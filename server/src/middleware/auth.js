import jwt from "jsonwebtoken";
import { GroupDelinquency } from "../models/GroupDelinquency.js";
import { User } from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Invalid account" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(req, res, next) {
  if (["super_admin", "admin"].includes(req.user?.role)) return next();
  return res.status(403).json({
    success: false,
    code: "ADMIN_ACCESS_REQUIRED",
    message: "Administrator access is required",
  });
}

export function requireVerifiedEmail(req, res, next) {
  if (req.user?.isEmailVerified || req.user?.emailVerified) return next();
  return res.status(403).json({
    success: false,
    code: "EMAIL_VERIFICATION_REQUIRED",
    message: "Verify your email before adding a phone number",
  });
}

export function requireKyc(req, res, next) {
  if (!req.user?.isEmailVerified && !req.user?.emailVerified) {
    return res.status(403).json({
      success: false,
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Verify your email before using this feature",
    });
  }

  if (req.user?.identityVerification?.status === "verified") return next();

  return res.status(403).json({
    success: false,
    code: "KYC_REQUIRED",
    action: req.kycAction || "continue",
    kycStatus: req.user?.identityVerification?.status || "not_started",
    message: "Complete identity verification to use this feature",
  });
}

export function kycAction(action) {
  return (req, _res, next) => {
    req.kycAction = action;
    next();
  };
}

export function requireKycWhen(predicate, action) {
  return (req, res, next) => {
    if (!predicate(req)) return next();
    req.kycAction = action;
    return requireKyc(req, res, next);
  };
}

export async function requireGoodStanding(req, res, next) {
  try {
    const delinquency = await GroupDelinquency.findOne({
      userId: req.user?._id,
      status: "open",
    }).select("groupId cycleNumber amountDue");
    if (!delinquency) return next();

    return res.status(409).json({
      success: false,
      code: "GROUP_CONTRIBUTION_OVERDUE",
      message: "Resolve your overdue group contribution before joining or creating another group",
      data: {
        groupId: delinquency.groupId,
        cycleNumber: delinquency.cycleNumber,
        amountDue: delinquency.amountDue,
      },
    });
  } catch (error) {
    return next(error);
  }
}
