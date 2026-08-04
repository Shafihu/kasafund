import { useEffect, useRef, useState } from "react";
import { getMemberDetail, reconcileMemberKyc } from "./api";
import type { MemberDetail } from "./types";

type Props = {
  token: string;
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
};

function money(value = 0) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function date(value?: string) {
  return value
    ? new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
    : "Not available";
}

function label(value = "") {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("");
}

function DetailSkeleton() {
  return <div className="member-detail-skeleton" aria-label="Loading member details"><span/><span/><span/><span/><span/></div>;
}

export function AdminMemberDrawer({ token, userId, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [error, setError] = useState("");
  const [reconciling, setReconciling] = useState(false);
  const [notice, setNotice] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);

  const load = () => {
    setError("");
    return getMemberDetail(token, userId).then(setDetail).catch((reason) => setError(reason.message));
  };

  useEffect(() => {
    void load();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [userId]);

  async function reconcile() {
    setReconciling(true); setError(""); setNotice("");
    try {
      const result = await reconcileMemberKyc(token, userId);
      setNotice(result.status === result.previousStatus
        ? "Verification status was already current."
        : `Verification updated to ${label(result.status)}.`);
      await load();
      onUpdated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not refresh verification status.");
    } finally { setReconciling(false); }
  }

  const user = detail?.user;
  const kyc = user?.identityVerification;
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section aria-labelledby="member-drawer-title" aria-modal="true" className="member-drawer" role="dialog">
      <header className="member-drawer-header"><div><span>MEMBER REVIEW</span><h2 id="member-drawer-title">Account details</h2></div><button ref={closeButton} aria-label="Close member details" onClick={onClose}>×</button></header>
      {error && <div className="drawer-error" role="alert"><span>{error}</span><button onClick={() => void load()}>Try again</button></div>}
      {!detail && !error ? <DetailSkeleton/> : detail && user ? <div className="member-drawer-content">
        <section className="member-identity"><div className="member-avatar">{user.avatarUrl ? <img alt="" src={user.avatarUrl}/> : initials(user.fullName)}</div><div><h3>{user.fullName}</h3><p>{user.email}</p><span className={user.isActive ? "account-active" : "account-inactive"}>{user.isActive ? "Active account" : "Inactive account"}</span></div></section>

        {notice && <div className="drawer-notice" role="status">{notice}</div>}

        <section className="detail-section kyc-review-card"><div className="detail-heading"><div><span>IDENTITY VERIFICATION</span><h3>Provider review</h3></div><span className={`status status-${kyc?.status || "not_started"}`}>{label(kyc?.status || "not_started")}</span></div><div className="kyc-detail-grid"><div><small>Provider</small><strong>{label(kyc?.provider || "didit")}</strong></div><div><small>Document</small><strong>{kyc?.documentType || "Not submitted"}</strong></div><div><small>Issuing country</small><strong>{kyc?.issuingCountry || "Not available"}</strong></div><div><small>Submitted</small><strong>{date(kyc?.submittedAt)}</strong></div><div><small>Last checked</small><strong>{date(kyc?.lastCheckedAt)}</strong></div><div><small>Verified</small><strong>{date(kyc?.verifiedAt)}</strong></div></div>{kyc?.failureReason && <div className="kyc-failure"><strong>Provider feedback</strong><p>{kyc.failureReason}</p></div>}<div className="provider-boundary"><p>Didit remains the source of truth. Refreshing checks the signed provider decision; it cannot manually approve this member.</p><button className="reconcile-button" disabled={!detail.canReconcileKyc || reconciling} onClick={() => void reconcile()}>{reconciling ? <><i/> Checking provider…</> : "Refresh from Didit"}</button></div></section>

        <section className="detail-section"><div className="detail-heading"><div><span>ACCOUNT HEALTH</span><h3>Participation snapshot</h3></div></div><div className="health-grid"><div><strong>{detail.metrics.groups}</strong><small>Active groups</small></div><div><strong>{detail.metrics.contributions}</strong><small>Contributions</small></div><div><strong>{money(detail.metrics.contributedAmount)}</strong><small>Contributed</small></div><div><strong>{detail.metrics.activeSavingsPots}</strong><small>Savings pots</small></div></div><div className="risk-row"><span className={detail.metrics.openDelinquencies ? "risk-warning" : "risk-clear"}>{detail.metrics.openDelinquencies} open contribution issue{detail.metrics.openDelinquencies === 1 ? "" : "s"}</span><span className={detail.metrics.openReports ? "risk-warning" : "risk-clear"}>{detail.metrics.openReports} open report{detail.metrics.openReports === 1 ? "" : "s"}</span></div></section>

        <section className="detail-section"><div className="detail-heading"><div><span>CONTACT & ACCESS</span><h3>Account information</h3></div></div><dl className="account-details"><div><dt>Phone</dt><dd>{user.phone || "Not provided"}</dd></div><div><dt>Email verified</dt><dd>{user.isEmailVerified ? "Yes" : "No"}</dd></div><div><dt>Phone verified</dt><dd>{user.isPhoneVerified ? "Yes" : "No"}</dd></div><div><dt>Joined</dt><dd>{date(user.createdAt)}</dd></div><div><dt>Last active</dt><dd>{date(user.lastLoginAt)}</dd></div><div><dt>Wallet balance</dt><dd>{money(user.walletBalance)}</dd></div></dl></section>

        <section className="detail-section"><div className="detail-heading"><div><span>GROUPS</span><h3>Current memberships</h3></div><b>{detail.memberships.length}</b></div>{detail.memberships.length ? <div className="detail-list">{detail.memberships.map((membership) => <div key={membership._id}><span><strong>{membership.groupId?.name || "Unavailable group"}</strong><small>{label(membership.role)} · {label(membership.lastContributionStatus)}</small></span><b>{money(membership.totalContributed)}</b></div>)}</div> : <p className="inline-empty">This member is not in an active group.</p>}</section>

        <section className="detail-section"><div className="detail-heading"><div><span>RECENT ACTIVITY</span><h3>Wallet transactions</h3></div></div>{detail.recentTransactions.length ? <div className="detail-list">{detail.recentTransactions.map((transaction) => <div key={transaction._id}><span><strong>{label(transaction.type)}</strong><small>{date(transaction.completedAt || transaction.createdAt)} · {label(transaction.status)}</small></span><b>{money(transaction.amount)}</b></div>)}</div> : <p className="inline-empty">No wallet activity has been recorded.</p>}</section>
      </div> : null}
    </section>
  </div>;
}
