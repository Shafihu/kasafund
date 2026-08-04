import type { AdminCampaign, AdminGroup, AdminReport, AdminUser, AuditEntry, AuditTargetType, AuthSession, CampaignDetail, GroupDetail, MemberDetail, Overview, ReportCounts, ReportDetail, ReportReason, ReportStatus, ReportTargetType } from "./types";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

type ApiResponse<T> = { success: boolean; message?: string; data: T };

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as Partial<ApiResponse<T>>;
  if (!response.ok) throw new Error(body.message || "Something went wrong. Please try again.");
  return body.data as T;
}

export async function adminLogin(email: string, password: string): Promise<AuthSession> {
  const result = await request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (result.user.role !== "super_admin") throw new Error("This account does not have administrator access.");
  await request<Overview>("/admin/overview", {}, result.token);
  return result;
}

export const getOverview = (token: string) => request<Overview>("/admin/overview", {}, token);

export const getUsers = (token: string, search = "") =>
  request<{ users: AdminUser[]; total: number }>(
    `/admin/users?limit=20&search=${encodeURIComponent(search)}`,
    {},
    token,
  );

export const getKycReviewQueue = (token: string) =>
  request<{ users: AdminUser[]; total: number }>("/admin/kyc-review", {}, token);

export const getMemberDetail = (token: string, userId: string) =>
  request<MemberDetail>(`/admin/users/${encodeURIComponent(userId)}`, {}, token);

export const reconcileMemberKyc = (token: string, userId: string) =>
  request<{ status: string; previousStatus: string }>(
    `/admin/users/${encodeURIComponent(userId)}/kyc/reconcile`,
    { method: "POST" },
    token,
  );

export const getGroups = (token: string, search = "") =>
  request<{ groups: AdminGroup[]; total: number }>(
    `/admin/groups?search=${encodeURIComponent(search)}`,
    {},
    token,
  );

export const getGroupDetail = (token: string, groupId: string) =>
  request<GroupDetail>(`/admin/groups/${encodeURIComponent(groupId)}`, {}, token);

export const getCampaigns = (token: string, search = "") =>
  request<{ campaigns: AdminCampaign[]; total: number }>(
    `/admin/campaigns?search=${encodeURIComponent(search)}`,
    {},
    token,
  );

export const getCampaignDetail = (token: string, campaignId: string) =>
  request<CampaignDetail>(`/admin/campaigns/${encodeURIComponent(campaignId)}`, {}, token);

export const moderateCampaign = (token: string, campaignId: string, action: "flag" | "restore", reason: string) =>
  request<{ campaign: CampaignDetail["campaign"] }>(
    `/admin/campaigns/${encodeURIComponent(campaignId)}/moderation`,
    { method: "PATCH", body: JSON.stringify({ action, reason }) },
    token,
  );

export const getAuditLogs = (token: string, targetType?: AuditTargetType, page = 1) =>
  request<{ logs: AuditEntry[]; total: number; page: number; limit: number; pages: number }>(
    `/admin/audit?limit=40&page=${page}${targetType ? `&targetType=${encodeURIComponent(targetType)}` : ""}`,
    {},
    token,
  );

export const getReports = (token: string, status: "open" | "all" | ReportStatus = "open", reason?: ReportReason, targetType?: ReportTargetType, page = 1) =>
  request<{ reports: AdminReport[]; total: number; page: number; limit: number; pages: number; counts: ReportCounts }>(
    `/admin/reports?limit=40&page=${page}&status=${encodeURIComponent(status)}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}${targetType ? `&targetType=${encodeURIComponent(targetType)}` : ""}`,
    {},
    token,
  );

export const getReportDetail = (token: string, reportId: string) =>
  request<{ report: ReportDetail }>(`/admin/reports/${encodeURIComponent(reportId)}`, {}, token);

export const updateReport = (token: string, reportId: string, action: "start_review" | "resolve" | "dismiss" | "reopen", summary = "") =>
  request<{ report: ReportDetail }>(
    `/admin/reports/${encodeURIComponent(reportId)}`,
    { method: "PATCH", body: JSON.stringify({ action, summary }) },
    token,
  );

export const addReportNote = (token: string, reportId: string, body: string) =>
  request<{ report: ReportDetail }>(
    `/admin/reports/${encodeURIComponent(reportId)}/notes`,
    { method: "POST", body: JSON.stringify({ body }) },
    token,
  );
