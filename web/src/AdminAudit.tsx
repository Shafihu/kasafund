import { useEffect, useMemo, useState } from "react";
import { getAuditLogs } from "./api";
import type { AuditEntry, AuditTargetType } from "./types";

const FILTERS: Array<{ value: "" | AuditTargetType; label: string }> = [
  { value: "", label: "All activity" },
  { value: "campaign", label: "Campaigns" },
  { value: "group", label: "Groups" },
  { value: "user", label: "Members" },
  { value: "user_report", label: "Reports" },
  { value: "savings_pot", label: "Savings" },
  { value: "wallet_transaction", label: "Wallet" },
];

function actionLabel(value: string) {
  return value
    .replace(/^admin\./, "")
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function initials(name = "System") {
  return name.split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function timestamp(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function metadataSummary(metadata: Record<string, unknown>) {
  return Object.entries(metadata)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 4);
}

export function AdminAuditPage({ token, refreshKey = 0 }: { token: string; refreshKey?: number }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [targetType, setTargetType] = useState<"" | AuditTargetType>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAuditLogs(token, targetType || undefined, page)
      .then(result => { if (active) { setLogs(result.logs); setPageCount(Math.max(1, result.pages)); setTotal(result.total); } })
      .catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, refreshKey, targetType, token]);

  const visibleLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter(log => [
      log.action,
      actionLabel(log.action),
      log.target.label,
      log.actorId?.fullName,
      log.actorId?.email,
    ].some(value => String(value || "").toLowerCase().includes(query)));
  }, [logs, search]);

  return <div className="dashboard-content audit-page">
    <div className="dashboard-title">
      <div><span className="kicker">ACCOUNTABILITY</span><h1>Administrator activity</h1><p>A chronological record of sensitive operational decisions and their stated reasons.</p></div>
      <span className="queue-summary">{total} events</span>
    </div>
    <section className="admin-card audit-card">
      <div className="audit-tools">
        <label className="audit-search"><span aria-hidden="true">⌕</span><input aria-label="Search audit log" placeholder="Search action, person, or record…" value={search} onChange={event => setSearch(event.target.value)}/></label>
        <label className="audit-filter"><span>Record type</span><select aria-label="Filter audit log by record type" value={targetType} onChange={event => { setTargetType(event.target.value as "" | AuditTargetType); setPage(1); }}>{FILTERS.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
      </div>
      {error ? <div className="audit-state" role="alert"><strong>Could not load activity</strong><p>{error}</p></div> : loading ? <div className="audit-skeleton" aria-label="Loading audit activity"><span/><span/><span/><span/></div> : visibleLogs.length ? <ol className="audit-timeline">
        {visibleLogs.map(log => {
          const actor = log.actorId?.fullName || "System actor";
          const details = metadataSummary(log.metadata);
          return <li key={log._id}>
            <div className="audit-avatar">{log.actorId?.avatarUrl ? <img alt="" src={log.actorId.avatarUrl}/> : initials(actor)}</div>
            <article>
              <div className="audit-event-heading"><div><strong>{actionLabel(log.action)}</strong><span>{actor}</span></div><time dateTime={log.createdAt}>{timestamp(log.createdAt)}</time></div>
              <p><span>{log.target.type.replaceAll("_", " ")}</span>{log.target.label}</p>
              {details.length > 0 && <dl>{details.map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value).replaceAll("_", " ")}</dd></div>)}</dl>}
            </article>
          </li>;
        })}
      </ol> : <div className="audit-state"><strong>No matching activity</strong><p>{search ? "Try a broader search." : "Administrator actions will appear here as they happen."}</p></div>}
      {!loading && !error && pageCount > 1 && <nav className="audit-pagination" aria-label="Audit log pages"><button disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>Next</button></nav>}
    </section>
  </div>;
}
