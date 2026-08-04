import { useEffect, useRef, useState } from "react";
import { getCampaignDetail, getCampaigns, getGroupDetail, getGroups, moderateCampaign } from "./api";
import type { AdminCampaign, AdminGroup, CampaignDetail, GroupDetail } from "./types";

function money(value = 0) {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 }).format(value / 100);
}
function date(value?: string) {
  return value ? new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Not scheduled";
}
function label(value = "") { return value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase()); }
function percent(value: number) { return `${Math.round(value * 100)}%`; }

function SearchIcon() {
  return <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
}

function ListSkeleton() { return <div className="operations-skeleton" aria-label="Loading records"><span/><span/><span/><span/></div>; }

type ListProps = { token: string; onSelect: (id: string) => void };

export function GroupsPage({ token, onSelect }: ListProps) {
  const [items, setItems] = useState<AdminGroup[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setError("");
      getGroups(token, search).then(result => setItems(result.groups)).catch(reason => setError(reason.message)).finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search, token]);
  return <div className="dashboard-content"><div className="dashboard-title"><div><span className="kicker">GROUP OPERATIONS</span><h1>Susu group health</h1><p>Inspect membership, contribution readiness, payouts, delinquencies, and active votes.</p></div><span className="queue-summary">{items.length} groups</span></div><section className="admin-card users-card"><div className="user-tools"><label><SearchIcon/><input aria-label="Search groups" placeholder="Search groups…" value={search} onChange={event => setSearch(event.target.value)}/></label><span>Live group records</span></div>{error ? <InlineError message={error}/> : loading ? <ListSkeleton/> : items.length ? <div className="table-wrap"><table className="operations-table"><thead><tr><th>Group</th><th>Contribution</th><th>Members</th><th>Pot</th><th>Next payout</th><th>Health</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map(group => <tr key={group._id}><td><EntityTitle image={group.coverImageUrl} title={group.name} subtitle={`${label(group.type)} · ${group.ownerId?.fullName || "Unknown owner"}`}/></td><td><strong className="table-value">{money(group.contribution.amount)}</strong><small className="table-subvalue">{label(group.contribution.frequency)}</small></td><td>{group.memberCount} / {group.expectedMemberCount}</td><td><strong className="table-value">{money(group.totalPot)}</strong></td><td>{date(group.nextPayoutDate)}</td><td><EntityStatus status={group.attentionCount ? "attention" : group.status} text={group.attentionCount ? `${group.attentionCount} issue${group.attentionCount === 1 ? "" : "s"}` : label(group.status)}/></td><td><ReviewButton onClick={() => onSelect(group._id)}/></td></tr>)}</tbody></table></div> : <InlineEmpty title="No groups found" body={search ? "Try a different group name." : "Groups will appear here when members create them."}/>}</section></div>;
}

export function CampaignsPage({ token, onSelect }: ListProps) {
  const [items, setItems] = useState<AdminCampaign[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setError("");
      getCampaigns(token, search).then(result => setItems(result.campaigns)).catch(reason => setError(reason.message)).finally(() => setLoading(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search, token]);
  return <div className="dashboard-content"><div className="dashboard-title"><div><span className="kicker">FUNDRAISING OPERATIONS</span><h1>Campaign activity</h1><p>Inspect funding progress, creator context, donation health, and public updates.</p></div><span className="queue-summary">{items.length} campaigns</span></div><section className="admin-card users-card"><div className="user-tools"><label><SearchIcon/><input aria-label="Search campaigns" placeholder="Search campaigns…" value={search} onChange={event => setSearch(event.target.value)}/></label><span>Live campaign records</span></div>{error ? <InlineError message={error}/> : loading ? <ListSkeleton/> : items.length ? <div className="table-wrap"><table className="operations-table"><thead><tr><th>Campaign</th><th>Raised</th><th>Progress</th><th>Donors</th><th>Deadline</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map(campaign => { const progress = campaign.goalAmount ? Math.min(campaign.raisedAmount / campaign.goalAmount, 1) : 0; return <tr key={campaign._id}><td><EntityTitle image={campaign.coverImageUrl} title={campaign.title} subtitle={`${label(campaign.category)} · ${campaign.creatorId?.fullName || "Unknown creator"}`}/></td><td><strong className="table-value">{money(campaign.raisedAmount)}</strong><small className="table-subvalue">of {money(campaign.goalAmount)}</small></td><td><div className="mini-progress"><span style={{ width: percent(progress) }}/></div><small className="table-subvalue">{percent(progress)}</small></td><td>{campaign.donorCount}</td><td>{date(campaign.deadline)}</td><td><EntityStatus status={campaign.status} text={label(campaign.status)}/></td><td><ReviewButton onClick={() => onSelect(campaign._id)}/></td></tr>; })}</tbody></table></div> : <InlineEmpty title="No campaigns found" body={search ? "Try a different campaign title." : "Campaigns will appear here when members publish them."}/>}</section></div>;
}

function EntityTitle({ image, title, subtitle }: { image?: string; title: string; subtitle: string }) {
  return <div className="entity-title"><span>{image ? <img alt="" src={image}/> : title.slice(0, 1)}</span><div><strong>{title}</strong><small>{subtitle}</small></div></div>;
}
function EntityStatus({ status, text }: { status: string; text: string }) { return <span className={`entity-status entity-status-${status}`}>{text}</span>; }
function ReviewButton({ onClick }: { onClick: () => void }) { return <button className="view-member" onClick={onClick}>Inspect <span>›</span></button>; }
function InlineError({ message }: { message: string }) { return <div className="operations-error" role="alert"><strong>Could not load records</strong><p>{message}</p></div>; }
function InlineEmpty({ title, body }: { title: string; body: string }) { return <div className="operations-empty"><strong>{title}</strong><p>{body}</p></div>; }

type DrawerProps = { token: string; type: "group" | "campaign"; id: string; onClose: () => void; onUpdated?: () => void };
export function OperationsDrawer({ token, type, id, onClose, onUpdated }: DrawerProps) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);
  const load = (reset = true) => {
    setError("");
    if (reset) { setGroup(null); setCampaign(null); }
    return (type === "group" ? getGroupDetail(token, id).then(setGroup) : getCampaignDetail(token, id).then(setCampaign)).catch(reason => setError(reason.message));
  };
  useEffect(() => {
    void load();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", handleKey); };
  }, [id, type]);
  return <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section aria-labelledby="operations-drawer-title" aria-modal="true" className="member-drawer operations-drawer" role="dialog"><header className="member-drawer-header"><div><span>{type === "group" ? "GROUP INSPECTION" : "CAMPAIGN INSPECTION"}</span><h2 id="operations-drawer-title">Operational details</h2></div><button ref={closeButton} aria-label="Close details" onClick={onClose}>×</button></header>{error && <div className="drawer-error" role="alert"><span>{error}</span><button onClick={() => void load()}>Try again</button></div>}{!group && !campaign && !error ? <ListSkeleton/> : group ? <GroupDrawerContent detail={group}/> : campaign ? <CampaignDrawerContent detail={campaign} token={token} onUpdated={() => { void load(false); onUpdated?.(); }}/> : null}</section></div>;
}

function GroupDrawerContent({ detail }: { detail: GroupDetail }) {
  const { group } = detail;
  return <div className="member-drawer-content"><EntityHero image={group.coverImageUrl} eyebrow={`${label(group.type)} GROUP`} title={group.name} subtitle={group.description || "No group description provided."} status={group.status}/><MetricStrip items={[[String(detail.metrics.activeMembers),"Active members"],[String(detail.metrics.completedPayouts),"Completed payouts"],[String(detail.metrics.openDelinquencies),"Open issues"],[String(detail.metrics.activeVotes),"Active votes"]]}/><section className="detail-section"><SectionTitle eyebrow="CONTRIBUTION TERMS" title="Financial agreement"/><div className="entity-facts"><Fact label="Contribution" value={money(group.contribution.amount)}/><Fact label="Frequency" value={label(group.contribution.frequency)}/><Fact label="Grace period" value={`${group.contribution.gracePeriodDays || 0} days`}/><Fact label="Penalty" value={money(group.contribution.penaltyAmount)}/><Fact label="Current pot" value={money(group.totalPot)}/><Fact label="Visibility" value={group.isPublic ? "Public" : "Private"}/></div></section>{detail.delinquencies.length > 0 && <section className="detail-section detail-attention"><SectionTitle eyebrow="NEEDS ATTENTION" title="Open contribution issues"/><RecordList items={detail.delinquencies.map(item => ({title:item.userId?.fullName || "Unknown member",meta:`Cycle ${item.cycleNumber} · ${label(item.status)} · Due ${date(item.dueDate)}`,value:money(item.amountDue)}))}/></section>}<section className="detail-section"><SectionTitle eyebrow="MEMBERS" title="Membership and standing" count={detail.members.length}/><RecordList items={detail.members.map(item => ({title:item.userId?.fullName || "Unknown member",meta:`${label(item.role)} · ${label(item.lastContributionStatus)} · ${label(item.status)}`,value:money(item.totalContributed)}))}/></section><section className="detail-section"><SectionTitle eyebrow="PAYOUTS" title="Recent payout schedule" count={detail.payouts.length}/>{detail.payouts.length ? <RecordList items={detail.payouts.map(item => ({title:`Cycle ${item.cycleNumber} · ${item.recipientId?.fullName || "Recipient unavailable"}`,meta:`${date(item.scheduledDate)} · ${label(item.fundingStatus)} · ${label(item.status)}`,value:money(item.amount)}))}/> : <InlineEmpty title="No payouts yet" body="The group has no payout records."/>}</section><section className="detail-section"><SectionTitle eyebrow="RESOLUTIONS" title="Voting history" count={detail.resolutions.length}/>{detail.resolutions.length ? <RecordList items={detail.resolutions.map(item => ({title:`Attempt ${item.attemptNumber} · ${label(item.status)}`,meta:`${item.votes.filter(vote => vote.choice === "approve").length} approvals of ${item.requiredYesVotes} required · Expires ${date(item.expiresAt)}`,value:`${money(item.proposedPayoutAmount)} proposed`}))}/> : <InlineEmpty title="No resolution votes" body="This group has not needed a payout resolution."/>}</section></div>;
}

function CampaignDrawerContent({ detail, token, onUpdated }: { detail: CampaignDetail; token: string; onUpdated: () => void }) {
  const { campaign } = detail;
  const [mode, setMode] = useState<"flag" | "restore" | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const action = campaign.status === "flagged" ? "restore" : "flag";
  const submit = async () => {
    setSubmitting(true); setError(""); setNotice("");
    try {
      await moderateCampaign(token, campaign._id, action, reason);
      setNotice(action === "flag" ? "Campaign flagged. The creator has been notified." : "Campaign restored. The creator has been notified.");
      setMode(null); setReason(""); onUpdated();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "The moderation action could not be completed.");
    } finally { setSubmitting(false); }
  };
  return <div className="member-drawer-content">
    <EntityHero image={campaign.coverImageUrl} eyebrow={label(campaign.category)} title={campaign.title} subtitle={campaign.description} status={campaign.status}/>
    {notice && <div className="moderation-notice" role="status">{notice}</div>}
    <section className="detail-section campaign-progress"><div><span>FUNDS RAISED</span><strong>{money(campaign.raisedAmount)}</strong><small>of {money(campaign.goalAmount)} · {percent(detail.metrics.progress)}</small></div><div className="campaign-progress-track"><span style={{width:percent(detail.metrics.progress)}}/></div></section>
    <MetricStrip items={[[String(campaign.donorCount),"Recorded donors"],[String(detail.metrics.completedDonations),"Completed gifts"],[String(detail.metrics.failedDonations),"Failed gifts"],[String(detail.metrics.comments),"Comments"]]}/>
    <section className="detail-section"><SectionTitle eyebrow="CAMPAIGN CONTEXT" title="Publishing details"/><div className="entity-facts"><Fact label="Creator" value={campaign.creatorId?.fullName || "Unknown"}/><Fact label="Creator KYC" value={label(campaign.creatorId?.identityVerification?.status || "not_started")}/><Fact label="Deadline" value={date(campaign.deadline)}/><Fact label="Visibility" value={campaign.isPublic ? "Public" : "Link only"}/><Fact label="Anonymous gifts" value={campaign.allowAnonymousDonations ? "Allowed" : "Disabled"}/><Fact label="Created" value={date(campaign.createdAt)}/></div></section>
    {(campaign.status === "active" || campaign.status === "flagged") && <section className={`detail-section moderation-panel ${campaign.status === "flagged" ? "is-flagged" : ""}`}>
      <SectionTitle eyebrow="MODERATION" title={campaign.status === "flagged" ? "Campaign under review" : "Campaign controls"}/>
      {campaign.status === "flagged" && <div className="moderation-history"><strong>Current flag reason</strong><p>{campaign.moderation?.flagReason || "No reason recorded."}</p><small>{campaign.moderation?.flaggedBy?.fullName || "Administrator"} · {date(campaign.moderation?.flaggedAt)}</small></div>}
      {!mode ? <div className="moderation-summary"><p>{campaign.status === "flagged" ? "Restoring makes the campaign discoverable and able to receive new donations again." : "Flagging removes this campaign from public discovery and blocks new donations. Existing donation records are not changed."}</p><button className={campaign.status === "flagged" ? "moderation-button restore" : "moderation-button flag"} onClick={() => { setMode(action); setError(""); }}>{campaign.status === "flagged" ? "Restore campaign" : "Flag campaign"}</button></div> : <div className="moderation-confirm">
        <div><strong>{mode === "flag" ? "Confirm campaign flag" : "Confirm campaign restore"}</strong><p>{mode === "flag" ? "The campaign will stop accepting new donations immediately. The creator will receive your reason." : "The campaign will become active immediately. The creator will receive your note."}</p></div>
        <label>Required reason<textarea autoFocus maxLength={300} minLength={10} placeholder={mode === "flag" ? "Explain what requires review…" : "Explain why the campaign can return…"} value={reason} onChange={event => setReason(event.target.value)}/><small>{reason.trim().length}/300 · minimum 10 characters</small></label>
        {error && <div className="moderation-error" role="alert">{error}</div>}
        <div className="moderation-actions"><button disabled={submitting} className="moderation-cancel" onClick={() => { setMode(null); setReason(""); setError(""); }}>Cancel</button><button disabled={submitting || reason.trim().length < 10} className={mode === "flag" ? "moderation-button flag" : "moderation-button restore"} onClick={() => void submit()}>{submitting && <i/>}{submitting ? (mode === "flag" ? "Flagging…" : "Restoring…") : (mode === "flag" ? "Confirm flag" : "Confirm restore")}</button></div>
      </div>}
    </section>}
    <section className="detail-section"><SectionTitle eyebrow="DONATIONS" title="Recent support" count={detail.donations.length}/>{detail.donations.length ? <RecordList items={detail.donations.map(item => ({title:item.isAnonymous ? "Anonymous donor" : item.donorId?.fullName || item.displayName,meta:`${date(item.paidAt || item.createdAt)} · ${label(item.paymentMethod)} · ${label(item.status)}`,value:money(item.amount)}))}/> : <InlineEmpty title="No donations yet" body="Completed and pending gifts will appear here."/>}</section>
    <section className="detail-section"><SectionTitle eyebrow="UPDATES" title="Creator communication" count={detail.updates.length}/>{detail.updates.length ? <div className="campaign-updates">{detail.updates.map(update => <article key={update._id}><p>{update.content}</p><small>{update.authorId?.fullName || "Campaign creator"} · {date(update.createdAt)}</small></article>)}</div> : <InlineEmpty title="No campaign updates" body="The creator has not posted an update."/>}</section>
  </div>;
}

function EntityHero({ image, eyebrow, title, subtitle, status }: { image?: string; eyebrow: string; title: string; subtitle: string; status: string }) { return <section className="entity-hero">{image && <img alt="" src={image}/>}<div><span>{eyebrow}</span><h3>{title}</h3><p>{subtitle}</p><EntityStatus status={status} text={label(status)}/></div></section>; }
function MetricStrip({ items }: { items: string[][] }) { return <section className="entity-metrics">{items.map(([value,title]) => <div key={title}><strong>{value}</strong><small>{title}</small></div>)}</section>; }
function SectionTitle({ eyebrow, title, count }: { eyebrow: string; title: string; count?: number }) { return <div className="detail-heading"><div><span>{eyebrow}</span><h3>{title}</h3></div>{count !== undefined && <b>{count}</b>}</div>; }
function Fact({ label: factLabel, value }: { label: string; value: string }) { return <div><small>{factLabel}</small><strong>{value}</strong></div>; }
function RecordList({ items }: { items: Array<{title:string;meta:string;value:string}> }) { return <div className="detail-list operations-records">{items.map((item,index) => <div key={`${item.title}-${index}`}><span><strong>{item.title}</strong><small>{item.meta}</small></span><b>{item.value}</b></div>)}</div>; }
