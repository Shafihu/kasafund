import { env } from "../config/env.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendVerificationEmail({ email, fullName, code }) {
  if (!env.resendApiKey || !env.emailFrom) {
    if (env.nodeEnv === "production") {
      throw new Error("Email delivery is not configured");
    }

    console.log(`[email verification] ${email}: ${code}`);
    return { delivery: "console", devCode: code };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [email],
      subject: `${code} is your KasaFund verification code`,
      html: `
        <div style="background:#f5f7f6;padding:32px 16px;font-family:Arial,sans-serif;color:#12211c">
          <div style="max-width:520px;margin:auto;background:#fff;border-radius:18px;padding:32px;border:1px solid #e1e8e5">
            <div style="color:#0b4d3e;font-size:22px;font-weight:800">KasaFund</div>
            <h1 style="font-size:24px;margin:28px 0 10px">Verify your email</h1>
            <p style="color:#697873;line-height:1.6">Hi ${escapeHtml(fullName)}, enter this code in KasaFund to finish securing your account.</p>
            <div style="margin:26px 0;padding:18px;text-align:center;background:#e7f1ed;border-radius:14px;color:#0b4d3e;font-size:32px;font-weight:800;letter-spacing:8px">${code}</div>
            <p style="color:#697873;font-size:13px;line-height:1.5">This code expires in 30 minutes. If you did not create this account, you can ignore this email.</p>
          </div>
        </div>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Resend email error:", response.status, details);
    throw new Error("Verification email could not be sent");
  }

  return { delivery: "email" };
}
