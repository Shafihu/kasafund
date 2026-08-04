import { useEffect, useMemo, useRef, useState } from "react";
import { addReportNote, getReportDetail, getReports, updateReport } from "./api";
import type { AdminReport, ReportCounts, ReportDetail, ReportReason, ReportStatus, ReportTargetType } from "./types";

const EMPTY_COUNTS: ReportCounts = { open: 0, pending: 0, reviewing: 0, resolved: 0, dismissed: 0 };
const STATUS_FILTERS: Array<{ value: "open" | "all" | ReportStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Unassigned" },
  { value: "reviewing", label: "In review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];
const REASONS: Array<{ value: "" | ReportReason; label: string }> = [
  { value: "", label: "All reasons" },
  { value: "scam", label: "Scam or fraud" },
  { value: "harassment", label: "Harassment" },
  { value: "impersonation", label: "Impersonation" },
  { value: "misleading", label: "Misleading information" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "prohibited", label: "Prohibited fundraising" },
  { value: "other", label: "Other" },
];

function label(value = "") { return value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase()); }
function initials(name = "Unknown") { return name.split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
function dateTime(value?: string) {
  return value ? new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "Not available";
}
function statusCount(status: "open" | "all" | ReportStatus, counts: ReportCounts) {
  if (status === "all") return counts.pending + counts.reviewing + counts.resolved + counts.dismissed;
  return counts[status];
}

function Person({ person, role }: { person?: AdminReport["reporterId"]; role: string }) {
  return <div className="report-person"><span>{person?.avatarUrl ? <img alt="" src={person.avatarUrl}/> : initials(person?.fullName)}</span><div><small>{role}</small><strong>{person?.fullName || "Unavailable member"}</strong><p>{person?.email || "No email available"}</p></div></div>;
}

export function AdminReportsPage({ token, adminId, onQueueChanged, onSelectCampaign }: { token: string; adminId: string; onQueueChanged: () => void; onSelectCampaign: (id: string) => void }) {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [counts, setCounts] = useState<ReportCounts>(EMPTY_COUNTS);
  const [status, setStatus] = useState<"open" | "all" | ReportStatus>("open");
  const [reason, setReason] = useState<"" | ReportReason>("");
  const [targetType, setTargetType] = useState<"" | ReportTargetType>("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    getReports(token, status, reason || undefined, targetType || undefined)
      .then(result => { if (active) { setReports(result.reports); setCounts(result.counts); } })
      .catch(requestError => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reason, refreshKey, status, targetType, token]);

  const visibleReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter(report => [report.reason, report.details, report.reporterId?.fullName, report.reportedUserId?.fullName, report.reportedCampaignId?.title, report.reportedCampaignId?.creatorId?.fullName, report.assignedTo?.fullName]
      .some(value => String(value || "").toLowerCase().includes(query)));
  }, [reports, search]);

  const changed = () => { setRefreshKey(value => value + 1); onQueueChanged(); };
  return <div className="dashboard-content reports-page">
    <div className="dashboard-title"><div><span className="kicker">TRUST & SAFETY</span><h1>Reports and support</h1><p>Own each confidential case from first review to a documented outcome.</p></div><span className="queue-summary">{counts.open} open</span></div>
    <section className="report-stats" aria-label="Report queue summary"><div><strong>{counts.pending}</strong><span>Need an owner</span></div><div><strong>{counts.reviewing}</strong><span>In review</span></div><div><strong>{counts.resolved}</strong><span>Resolved</span></div><div><strong>{counts.dismissed}</strong><span>Dismissed</span></div></section>
    <section className="admin-card reports-card">
      <div className="report-filters"><div className="report-tabs" role="group" aria-label="Filter by status">{STATUS_FILTERS.map(item => <button className={status === item.value ? "active" : ""} key={item.value} onClick={() => setStatus(item.value)}>{item.label}<small>{statusCount(item.value, counts)}</small></button>)}</div><div className="report-search-row"><label><span aria-hidden="true">⌕</span><input aria-label="Search reports" placeholder="Search people, campaigns, or details…" value={search} onChange={event => setSearch(event.target.value)}/></label><select aria-label="Filter by target type" value={targetType} onChange={event => setTargetType(event.target.value as "" | ReportTargetType)}><option value="">All report types</option><option value="member">Member reports</option><option value="campaign">Campaign reports</option></select><select aria-label="Filter by report reason" value={reason} onChange={event => setReason(event.target.value as "" | ReportReason)}>{REASONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
      {error ? <div className="report-state" role="alert"><strong>Could not load reports</strong><p>{error}</p><button onClick={() => setRefreshKey(value => value + 1)}>Try again</button></div> : loading ? <div className="report-list-skeleton" aria-label="Loading reports"><span/><span/><span/><span/></div> : visibleReports.length ? <div className="report-list">{visibleReports.map(report => { const target = report.targetType === "campaign" ? report.reportedCampaignId?.title || "Unavailable campaign" : report.reportedUserId?.fullName || "Unavailable member"; return <button key={report._id} onClick={() => setSelectedId(report._id)}><span className={`report-reason-icon reason-${report.reason}`}>{report.targetType === "campaign" ? "C" : report.reason === "scam" ? "!" : report.reason.slice(0, 1).toUpperCase()}</span><div className="report-row-main"><span><strong>{label(report.reason)}</strong><i className="report-target-tag">{label(report.targetType)}</i><i className={`case-status case-status-${report.status}`}>{label(report.status)}</i></span><p>{target} reported by {report.reporterId?.fullName || "Unavailable reporter"}</p><small>{report.details || "No additional details supplied."}</small></div><div className="report-row-meta"><time>{dateTime(report.createdAt)}</time><span>{report.assignedTo?.fullName || "Needs owner"}</span></div><b aria-hidden="true">›</b></button>; })}</div> : <div className="report-state"><span className="report-empty-icon">✓</span><strong>{search ? "No matching reports" : "Queue is clear"}</strong><p>{search ? "Try a broader search or another status." : "There are no reports in this view."}</p></div>}
    </section>
    {selectedId && <ReportDrawer token={token} adminId={adminId} reportId={selectedId} onClose={() => setSelectedId(null)} onOpenCampaign={id => { setSelectedId(null); onSelectCampaign(id); }} onUpdated={changed}/>} 
  </div>;
}

function ReportDrawer({ token, adminId, reportId, onClose, onOpenCampaign, onUpdated }: { token: string; adminId: string; reportId: string; onClose: () => void; onOpenCampaign: (id: string) => void; onUpdated: () => void }) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [mode, setMode] = useState<"resolve" | "dismiss" | "reopen" | null>(null);
  const [summary, setSummary] = useState("");
  const [updating, setUpdating] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const load = (clear = true) => {
    if (clear) setReport(null);
    setError("");
    return getReportDetail(token, reportId).then(result => setReport(result.report)).catch(requestError => setError(requestError.message));
  };
  useEffect(() => {
    void load();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", handleKey); };
  }, [reportId]);

  const mutate = async (action: "start_review" | "resolve" | "dismiss" | "reopen", explanation = "") => {
    setUpdating(true); setError(""); setNotice("");
    try {
      const result = await updateReport(token, reportId, action, explanation);
      setReport(result.report); setMode(null); setSummary("");
      setNotice(action === "start_review" ? "This report is now assigned to you." : action === "reopen" ? "The case has been reopened and assigned to you." : `The report was ${action === "resolve" ? "resolved" : "dismissed"} and the reporter was notified.`);
      onUpdated();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The report could not be updated."); }
    finally { setUpdating(false); }
  };

  const saveNote = async () => {
    setNoteSaving(true); setError(""); setNotice("");
    try {
      const result = await addReportNote(token, reportId, note);
      setReport(result.report); setNote(""); setNotice("Internal note saved."); onUpdated();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The note could not be saved."); }
    finally { setNoteSaving(false); }
  };

  const ownedByMe = report?.assignedTo?._id === adminId;
  return <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section aria-labelledby="report-drawer-title" aria-modal="true" className="member-drawer report-drawer" role="dialog"><header className="member-drawer-header"><div><span>CONFIDENTIAL CASE</span><h2 id="report-drawer-title">Report review</h2></div><button ref={closeButton} aria-label="Close report" onClick={onClose}>×</button></header>
    {error && <div className="drawer-error" role="alert"><span>{error}</span><button onClick={() => void load(false)}>Try again</button></div>}
    {!report && !error ? <div className="report-drawer-skeleton"><span/><span/><span/><span/></div> : report ? <div className="member-drawer-content report-detail">
      {notice && <div className="drawer-notice" role="status">{notice}</div>}
      <section className="report-case-hero"><div><span>{label(report.reason)} · {label(report.targetType)}</span><h3>{report.targetType === "campaign" ? report.reportedCampaignId?.title || "Unavailable campaign" : report.reportedUserId?.fullName || "Unavailable member"}</h3><p>Submitted {dateTime(report.createdAt)}</p></div><i className={`case-status case-status-${report.status}`}>{label(report.status)}</i></section>
      <div className="confidential-note"><strong>Keep reporter information confidential</strong><p>Internal notes are visible only to administrators. A report does not automatically notify or penalize its subject.</p></div>
      <section className="detail-section"><div className="detail-heading"><div><span>{report.targetType === "campaign" ? "REPORTER & CAMPAIGN" : "PEOPLE"}</span><h3>Case participants</h3></div></div>{report.targetType === "campaign" ? <div className="report-people"><Person person={report.reporterId} role="Reported by"/><button className="reported-campaign" onClick={() => report.reportedCampaignId && onOpenCampaign(report.reportedCampaignId._id)}><span>{report.reportedCampaignId?.coverImageUrl ? <img alt="" src={report.reportedCampaignId.coverImageUrl}/> : "C"}</span><div><small>Reported campaign</small><strong>{report.reportedCampaignId?.title || "Unavailable campaign"}</strong><p>{report.reportedCampaignId?.creatorId?.fullName || "Unknown organizer"} · {label(report.reportedCampaignId?.status || "unknown")}</p></div><b>Inspect ›</b></button></div> : <div className="report-people"><Person person={report.reporterId} role="Reported by"/><Person person={report.reportedUserId} role="Reported member"/></div>}</section>
      <section className="detail-section report-statement"><div className="detail-heading"><div><span>SUBMISSION</span><h3>What was reported</h3></div></div><strong>{label(report.reason)}</strong><p>{report.details || "The reporter did not provide additional details."}</p></section>
      <section className="detail-section case-ownership"><div className="detail-heading"><div><span>OWNERSHIP</span><h3>Review responsibility</h3></div></div>{report.status === "pending" || (report.status === "reviewing" && !report.assignedTo) ? <div><p>No administrator owns this case yet. Claiming it records you as the reviewer.</p><button className="case-primary" disabled={updating} onClick={() => void mutate("start_review")}>{updating ? <><i/> Claiming…</> : "Start review"}</button></div> : <div className="case-owner"><span>{initials(report.assignedTo?.fullName)}</span><div><small>Assigned administrator</small><strong>{report.assignedTo?.fullName || "Not assigned"}</strong><p>{report.reviewStartedAt ? `Review started ${dateTime(report.reviewStartedAt)}` : "Review date unavailable"}</p></div></div>}</section>
      <section className="detail-section internal-notes"><div className="detail-heading"><div><span>INTERNAL NOTES</span><h3>Review trail</h3></div><b>{report.internalNotes.length}</b></div>{report.internalNotes.length > 0 && <div className="case-note-list">{report.internalNotes.map(item => <article key={item._id}><p>{item.body}</p><small>{item.authorId?.fullName || "Administrator"} · {dateTime(item.createdAt)}</small></article>)}</div>}<label>Add a private note<textarea maxLength={1000} placeholder="Record checks completed, relevant context, or the next step…" value={note} onChange={event => setNote(event.target.value)}/><small>{note.trim().length}/1000</small></label><button className="case-secondary" disabled={noteSaving || note.trim().length < 3} onClick={() => void saveNote()}>{noteSaving ? <><i/> Saving note…</> : "Save internal note"}</button></section>
      {report.decisions.length > 0 && <section className="detail-section"><div className="detail-heading"><div><span>DECISION HISTORY</span><h3>Recorded outcomes</h3></div></div><div className="case-decision-list">{report.decisions.map(item => <article key={item._id}><i className={`case-status case-status-${item.action === "reopened" ? "reviewing" : item.action}`}>{label(item.action)}</i><p>{item.summary}</p><small>{item.authorId?.fullName || "Administrator"} · {dateTime(item.createdAt)}</small></article>)}</div></section>}
      {report.status === "reviewing" && ownedByMe && <section className="detail-section case-decision"><div className="detail-heading"><div><span>CASE DECISION</span><h3>Close this review</h3></div></div>{!mode ? <div className="case-decision-buttons"><button onClick={() => setMode("dismiss")}>Dismiss report</button><button className="case-primary" onClick={() => setMode("resolve")}>Resolve report</button></div> : <DecisionForm mode={mode} summary={summary} setSummary={setSummary} updating={updating} onCancel={() => { setMode(null); setSummary(""); }} onConfirm={() => void mutate(mode, summary)}/>}</section>}
      {report.status === "reviewing" && report.assignedTo && !ownedByMe && <div className="case-assigned-warning">This case is owned by {report.assignedTo.fullName}. Only the assigned administrator can close it.</div>}
      {(report.status === "resolved" || report.status === "dismissed") && <section className="detail-section case-reopen"><div><strong>Need another look?</strong><p>Reopening preserves the previous decision and assigns the case to you.</p></div>{mode !== "reopen" ? <button onClick={() => setMode("reopen")}>Reopen case</button> : <DecisionForm mode="reopen" summary={summary} setSummary={setSummary} updating={updating} onCancel={() => { setMode(null); setSummary(""); }} onConfirm={() => void mutate("reopen", summary)}/>}</section>}
    </div> : null}
  </section></div>;
}

function DecisionForm({ mode, summary, setSummary, updating, onCancel, onConfirm }: { mode: "resolve" | "dismiss" | "reopen"; summary: string; setSummary: (value: string) => void; updating: boolean; onCancel: () => void; onConfirm: () => void }) {
  const isReopen = mode === "reopen";
  return <div className="case-decision-form"><div><strong>{isReopen ? "Explain why this case needs another review" : mode === "resolve" ? "Explain the resolution to the reporter" : "Explain why no further action is needed"}</strong><p>{isReopen ? "This reason becomes part of the decision history." : "This message will be sent to the reporter. Do not include private internal notes."}</p></div><label>{isReopen ? "Reopening reason" : "Message to reporter"}<textarea autoFocus maxLength={1000} minLength={10} value={summary} onChange={event => setSummary(event.target.value)} placeholder={isReopen ? "New information or review concern…" : "Explain the outcome clearly and respectfully…"}/><small>{summary.trim().length}/1000 · minimum 10 characters</small></label><div><button disabled={updating} onClick={onCancel}>Cancel</button><button className={mode === "dismiss" ? "case-dismiss" : "case-primary"} disabled={updating || summary.trim().length < 10} onClick={onConfirm}>{updating && <i/>}{updating ? "Updating…" : isReopen ? "Confirm reopen" : mode === "resolve" ? "Confirm resolution" : "Confirm dismissal"}</button></div></div>;
}
