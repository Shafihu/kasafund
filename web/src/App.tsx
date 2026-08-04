import { CSSProperties, FormEvent, ReactNode, useEffect, useState } from "react";
import { adminLogin, getKycReviewQueue, getOverview, getUsers } from "./api";
import type { AdminUser, AuthSession, Overview } from "./types";
import { AdminMemberDrawer } from "./AdminMemberDrawer";
import { CampaignsPage, GroupsPage, OperationsDrawer } from "./AdminOperations";
import { AdminAuditPage } from "./AdminAudit";
import { AdminReportsPage } from "./AdminReports";
import { PrivacyPage, SupportPage, TermsPage } from "./PublicPages";

const SESSION_KEY = "kasafund.admin.session";

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    groups: <><circle cx="9" cy="8" r="3"/><path d="M3 19v-1a6 6 0 0 1 12 0v1"/><path d="M16 4a3 3 0 0 1 0 6M17 13a5 5 0 0 1 4 5v1"/></>,
    shield: <><path d="M12 3 4.5 6v5.2c0 4.7 3.2 8 7.5 9.8 4.3-1.8 7.5-5.1 7.5-9.8V6L12 3Z"/><path d="m9 12 2 2 4-5"/></>,
    wallet: <><path d="M4 7.5h14a2 2 0 0 1 2 2V18H6a2 2 0 0 1-2-2V5.5A2.5 2.5 0 0 1 6.5 3H17v4.5"/><path d="M16 12h4"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    campaign: <><path d="M3 11v2a2 2 0 0 0 2 2h2l4 5V4L7 9H5a2 2 0 0 0-2 2Z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></>,
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
  };
  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <a className={`brand ${light ? "brand-light" : ""}`} href="/" aria-label="KasaFund home"><img alt="" src="/kasafund-mark.svg"/><span>KasaFund</span></a>;
}

function AppleLogo() {
  return <svg aria-hidden="true" className="store-logo apple-logo" fill="currentColor" viewBox="0 0 24 24"><path d="M17.1 12.5c0-2.5 2-3.7 2.1-3.8a4.6 4.6 0 0 0-3.6-2c-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.8 1.3 10.3.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-3-.9-3-4.1ZM14.6 5.1A4.4 4.4 0 0 0 15.7 2a4.5 4.5 0 0 0-2.9 1.5 4.2 4.2 0 0 0-1.1 3c1.1.1 2.2-.5 2.9-1.4Z"/></svg>;
}

function GooglePlayLogo() {
  return <svg aria-hidden="true" className="store-logo" viewBox="0 0 24 24"><path d="M3.6 2.7c-.4.4-.6 1-.6 1.8v15c0 .7.2 1.3.6 1.7l.1.1 8.4-8.4v-1.8L3.7 2.6l-.1.1Z" fill="#00D7FE"/><path d="m15 15.8-2.9-2.9v-1.8L15 8.2l.1.1 3.5 2c1 .6 1 1.5 0 2.1l-3.5 2-.1 1.4Z" fill="#FFCE00"/><path d="m15.1 14.4-3-2.4-8.5 9.3c.6.6 1.4.6 2.3.1l9.2-5.2v-1.8Z" fill="#FF3A44"/><path d="M15.1 8.3 5.9 3.1c-.9-.5-1.7-.4-2.3.1l8.5 8.8 3-2.3V8.3Z" fill="#00F076"/></svg>;
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return <div className="site-shell">
    <header className="site-header">
      <Brand />
      <button className="menu-button" type="button" aria-expanded={menuOpen} aria-label="Toggle navigation" onClick={() => setMenuOpen(v => !v)}><Icon name={menuOpen ? "close" : "menu"}/></button>
      <nav className={menuOpen ? "site-nav open" : "site-nav"} aria-label="Main navigation">
        <a href="#how" onClick={closeMenu}>How it works</a><a href="#ways" onClick={closeMenu}>What you can do</a><a href="#safety" onClick={closeMenu}>Safety</a>
        <a className="nav-cta" href="#download" onClick={closeMenu}>Get the app <Icon name="arrow" size={17}/></a>
      </nav>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy reveal reveal-one">
          <div className="eyebrow"><span></span> Built for how communities save</div>
          <h1>Money moves better when <em>we move together.</em></h1>
          <p>KasaFund brings susu groups, personal savings, and community fundraising into one clear, trusted place.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#download">Get KasaFund <Icon name="arrow" size={18}/></a>
            <a className="text-link" href="#how">See how it works <span>↓</span></a>
          </div>
          <div className="hero-proof"><div className="avatar-stack"><span>AM</span><span>KA</span><span>EO</span></div><p><strong>Built around people,</strong><br/>not complicated banking.</p></div>
        </div>
        <div className="hero-visual reveal reveal-two" aria-label="Preview of a KasaFund savings circle">
          <div className="sun-shape"></div>
          <div className="phone-card">
            <div className="phone-top"><img alt="" src="/kasafund-mark.svg"/><span>9:41</span></div>
            <p className="phone-label">GOOD MORNING, ABENA</p>
            <h2>Your money, in motion.</h2>
            <div className="balance-card"><div><span>Wallet balance</span><strong>GH₵ 1,250.00</strong></div><span className="balance-icon"><Icon name="wallet"/></span></div>
            <div className="mini-heading"><strong>Coming up</strong><span>View all</span></div>
            <div className="upcoming-card"><div className="mini-icon"><Icon name="groups"/></div><div><strong>Family Support Circle</strong><span>Contribution due Friday</span></div><b>GH₵ 100</b></div>
            <div className="progress-card"><div className="progress-title"><div><span className="status-dot"></span><strong>Makola Traders</strong></div><span>5 of 6 paid</span></div><div className="progress-track"><span></span></div><small>Next payout in 3 days</small></div>
          </div>
          <div className="floating-note"><span><Icon name="check" size={16}/></span><div><strong>Contribution received</strong><small>Your circle is up to date</small></div></div>
        </div>
      </section>

      <section className="trust-row" aria-label="KasaFund benefits"><p><Icon name="shield"/> Identity-aware access</p><p><Icon name="eye"/> Clear group records</p><p><Icon name="heart"/> Built for real communities</p></section>

      <section className="section ways" id="ways">
        <div className="section-heading"><div><span className="kicker">ONE HOME FOR COMMUNITY MONEY</span><h2>However you’re moving forward,<br/><em>there’s a place for it.</em></h2></div><p>Simple tools that respect the way families, friends, traders, and teams already support one another.</p></div>
        <div className="feature-grid">
          <article className="feature-card feature-dark"><span className="feature-number">01</span><div className="feature-icon"><Icon name="groups" size={27}/></div><h3>Run a susu circle</h3><p>Create a group, agree on the contribution, choose a payout order, and keep every member aligned.</p><a href="#download">Save together <Icon name="arrow" size={17}/></a><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div></article>
          <article className="feature-card"><span className="feature-number">02</span><div className="feature-icon"><Icon name="wallet" size={27}/></div><h3>Save for your own goals</h3><p>Build a personal savings pot at your pace, with progress that stays easy to understand.</p><a href="#download">Start a goal <Icon name="arrow" size={17}/></a><div className="goal-preview"><div><span>Shop expansion</span><b>39%</b></div><div className="goal-track"><i></i></div><small>GH₵ 2,350 of GH₵ 6,000</small></div></article>
          <article className="feature-card feature-photo"><span className="feature-number">03</span><div className="feature-card-content"><div className="feature-icon"><Icon name="heart" size={27}/></div><h3>Fund what matters</h3><p>Share a real need, receive support, and keep donors close with honest updates.</p><a href="#download">Raise support <Icon name="arrow" size={17}/></a></div><img alt="Friends using KasaFund together" src="/community.jpg"/></article>
        </div>
      </section>

      <section className="section how" id="how">
        <div className="how-intro"><span className="kicker">HOW KASAFUND WORKS</span><h2>From an idea to a habit<br/>your circle can <em>trust.</em></h2><p>No financial jargon. No mystery. Everyone sees what matters and knows what comes next.</p></div>
        <ol className="steps">
          <li><span>1</span><div><h3>Choose your path</h3><p>Join a savings group, create your own pot, or begin a fundraiser.</p></div></li>
          <li><span>2</span><div><h3>Set clear expectations</h3><p>Agree on amounts, dates, and payout order before money starts moving.</p></div></li>
          <li><span>3</span><div><h3>Move forward together</h3><p>Track every contribution, vote on group decisions, and stay informed.</p></div></li>
        </ol>
      </section>

      <section className="story-section">
        <div className="story-photo"><img src="/community.jpg" alt="Three KasaFund community members sharing a moment"/><span>COMMUNITY, MADE VISIBLE</span></div>
        <blockquote><span>“</span><p>We built KasaFund around a simple belief: people already know how to support each other. Technology should make that trust easier to carry.</p><footer>— The thinking behind KasaFund</footer></blockquote>
      </section>

      <section className="section safety" id="safety">
        <div className="safety-mark"><Icon name="shield" size={48}/></div><div><span className="kicker">TRUST IS THE FOUNDATION</span><h2>Clarity before every commitment.</h2><p>Identity checks for important actions, visible contribution records, group agreements, and democratic resolution tools help communities make informed decisions together.</p></div><ul><li><Icon name="check"/> Identity verification gates</li><li><Icon name="check"/> Transparent ledgers</li><li><Icon name="check"/> Group voting and resolutions</li><li><Icon name="check"/> Account standing signals</li></ul>
      </section>

      <section className="download" id="download"><div><span className="kicker">YOUR NEXT MOVE CAN START SMALL</span><h2>Bring your people.<br/><em>We’ll bring the clarity.</em></h2><p>KasaFund is coming to iOS and Android.</p><div className="store-buttons"><a aria-label="Download KasaFund on the App Store" href={import.meta.env.VITE_APP_STORE_URL || "#"}><AppleLogo/><span className="store-copy"><small>Download on the</small><strong>App Store</strong></span></a><a aria-label="Get KasaFund on Google Play" href={import.meta.env.VITE_PLAY_STORE_URL || "#"}><GooglePlayLogo/><span className="store-copy"><small>GET IT ON</small><strong>Google Play</strong></span></a></div></div><img alt="KasaFund app mark" src="/kasafund-mark.svg"/></section>
    </main>
    <footer className="footer"><Brand light/><p>Community money, made clearer.</p><div><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><small>© {new Date().getFullYear()} KasaFund. Built in Ghana.</small></footer>
  </div>;
}

function AdminLogin({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try { onLogin(await adminLogin(email.trim().toLowerCase(), password)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Sign in failed."); }
    finally { setLoading(false); }
  }
  return <main className="admin-login-page"><a className="back-home" href="/"><span>←</span> KasaFund home</a><section className="login-panel"><Brand/><div className="login-icon"><Icon name="lock" size={24}/></div><span className="kicker">OPERATIONS CONSOLE</span><h1>Welcome back</h1><p>Sign in with an authorised administrator account.</p><form onSubmit={submit}><label>Email address<input autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@kasafund.com" required/></label><label>Password<input autoComplete="current-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required/></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary login-submit" disabled={loading} type="submit"><span>{loading ? "Checking access…" : "Sign in securely"}</span>{loading ? <i className="spinner"/> : <Icon name="arrow" size={18}/>}</button></form><div className="login-note"><Icon name="shield" size={18}/><span>Administrator actions are protected and should be performed from a trusted device.</span></div></section><p className="login-footer">Restricted KasaFund operations environment</p></main>;
}

function money(value: number) { return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 0 }).format(value / 100); }
function date(value?: string) { return value ? new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Never"; }
function initials(name: string) { return name.split(" ").slice(0, 2).map(part => part[0]).join(""); }

function Status({ user }: { user: AdminUser }) {
  const value = user.identityVerification?.status || "not_started";
  const label = value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
  return <span className={`status status-${value}`}>{label}</span>;
}

function AdminDashboard({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [kycUsers, setKycUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<{ type: "group" | "campaign"; id: string } | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<"overview" | "users" | "kyc" | "groups" | "campaigns" | "reports" | "audit">("overview");
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [operationsVersion, setOperationsVersion] = useState(0);

  const refreshKycQueue = () => getKycReviewQueue(session.token).then(result => setKycUsers(result.users)).catch(reason => setError(reason.message));
  const refreshOverview = () => getOverview(session.token).then(setOverview).catch(reason => setError(reason.message));
  useEffect(() => { void refreshOverview(); void refreshKycQueue(); }, [session.token]);
  useEffect(() => {
    const timer = window.setTimeout(() => getUsers(session.token, search).then(result => setUsers(result.users)).catch(reason => setError(reason.message)), 180);
    return () => window.clearTimeout(timer);
  }, [search, session.token]);

  const nav = (target: "overview" | "users" | "kyc" | "groups" | "campaigns" | "reports" | "audit") => { setPage(target); setMobileNav(false); };
  const handleMemberUpdated = () => { void refreshOverview(); void refreshKycQueue(); };
  return <div className="admin-shell">
    <aside className={mobileNav ? "admin-sidebar open" : "admin-sidebar"}><div className="sidebar-top"><Brand light/><button aria-label="Close menu" onClick={() => setMobileNav(false)}><Icon name="close"/></button></div><p className="workspace-label">OPERATIONS</p><nav><button className={page === "overview" ? "active" : ""} onClick={() => nav("overview")}><Icon name="dashboard"/> Overview</button><button className={page === "users" ? "active" : ""} onClick={() => nav("users")}><Icon name="users"/> Members</button><button className={page === "kyc" ? "active" : ""} onClick={() => nav("kyc")}><Icon name="shield"/> KYC review {kycUsers.length > 0 && <small className="nav-count">{kycUsers.length}</small>}</button><button className={page === "groups" ? "active" : ""} onClick={() => nav("groups")}><Icon name="groups"/> Groups</button><button className={page === "campaigns" ? "active" : ""} onClick={() => nav("campaigns")}><Icon name="campaign"/> Campaigns</button><button className={page === "reports" ? "active" : ""} onClick={() => nav("reports")}><Icon name="shield"/> Reports {Boolean(overview?.attention.openReports) && <small className="nav-count">{overview?.attention.openReports}</small>}</button><button className={page === "audit" ? "active" : ""} onClick={() => nav("audit")}><Icon name="activity"/> Audit log</button></nav><div className="admin-identity"><div>{initials(session.user.fullName)}</div><span><strong>{session.user.fullName}</strong><small>Super administrator</small></span><button aria-label="Sign out" title="Sign out" onClick={onLogout}><Icon name="logout"/></button></div></aside>
    <main className="admin-main"><header className="admin-topbar"><button className="admin-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Icon name="menu"/></button><div><span className="admin-date">{new Intl.DateTimeFormat("en-GH", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><strong>KasaFund Operations</strong></div><span className="live-pill"><i></i> Live data</span></header>
      {error && <div className="admin-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
      {page === "overview" && <OverviewPage overview={overview} users={users} onCampaigns={() => nav("campaigns")} onGroups={() => nav("groups")} onKycReview={() => nav("kyc")} onReports={() => nav("reports")} onSelectUser={setSelectedUserId}/>} 
      {page === "users" && <UsersPage users={users} search={search} setSearch={setSearch} onSelectUser={setSelectedUserId}/>} 
      {page === "kyc" && <KycReviewPage users={kycUsers} onSelectUser={setSelectedUserId}/>} 
      {page === "groups" && <GroupsPage token={session.token} onSelect={id => setSelectedEntity({ type: "group", id })}/>} 
      {page === "campaigns" && <CampaignsPage key={operationsVersion} token={session.token} onSelect={id => setSelectedEntity({ type: "campaign", id })}/>} 
      {page === "reports" && <AdminReportsPage token={session.token} adminId={session.user._id} onSelectCampaign={id => setSelectedEntity({ type: "campaign", id })} onQueueChanged={() => { setOperationsVersion(value => value + 1); void refreshOverview(); }}/>} 
      {page === "audit" && <AdminAuditPage token={session.token} refreshKey={operationsVersion}/>} 
    </main>
    {selectedUserId && <AdminMemberDrawer token={session.token} userId={selectedUserId} onClose={() => setSelectedUserId(null)} onUpdated={handleMemberUpdated}/>} 
    {selectedEntity && <OperationsDrawer token={session.token} type={selectedEntity.type} id={selectedEntity.id} onClose={() => setSelectedEntity(null)} onUpdated={() => { setOperationsVersion(value => value + 1); void refreshOverview(); }}/>} 
  </div>;
}

function OverviewPage({ overview, users, onCampaigns, onGroups, onKycReview, onReports, onSelectUser }: { overview: Overview | null; users: AdminUser[]; onCampaigns: () => void; onGroups: () => void; onKycReview: () => void; onReports: () => void; onSelectUser: (id: string) => void }) {
  if (!overview) return <div className="dashboard-loading"><span className="spinner dark"></span><p>Loading live operations data…</p></div>;
  const cards = [
    ["Members", overview.metrics.users.toLocaleString(), "users", "All registered accounts"],
    ["Active groups", overview.metrics.activeGroups.toLocaleString(), "groups", "Currently contributing"],
    ["Active campaigns", overview.metrics.activeCampaigns.toLocaleString(), "campaign", "Accepting support"],
    ["Money moved", money(overview.metrics.moneyMoved), "wallet", "Completed contributions & donations"],
  ];
  return <div className="dashboard-content"><div className="dashboard-title"><div><span className="kicker">OVERVIEW</span><h1>Good to see you.</h1><p>Here’s what needs attention across KasaFund today.</p></div><button className="refresh-button" onClick={() => window.location.reload()}>Refresh data</button></div><section className="metric-grid">{cards.map(([label, value, icon, note]) => <article key={label}><span className="metric-icon"><Icon name={icon}/></span><small>{label}</small><strong>{value}</strong><p>{note}</p></article>)}</section><div className="dashboard-columns"><section className="admin-card attention-card"><div className="card-heading"><div><span className="kicker">ATTENTION QUEUE</span><h2>Worth a closer look</h2></div><span className="attention-count">{overview.attention.kycInReview + overview.attention.overduePayouts + overview.attention.flaggedCampaigns + overview.attention.openReports}</span></div><div className="attention-list"><button onClick={onReports}><span className="attention-icon red"><Icon name="shield"/></span><div><strong>Member reports</strong><small>{overview.attention.openReports} open case{overview.attention.openReports === 1 ? "" : "s"}</small></div><Icon name="chevron"/></button><button onClick={onKycReview}><span className="attention-icon amber"><Icon name="shield"/></span><div><strong>KYC awaiting review</strong><small>{overview.attention.kycInReview} member{overview.attention.kycInReview === 1 ? "" : "s"}</small></div><Icon name="chevron"/></button><button onClick={onGroups}><span className="attention-icon red"><Icon name="activity"/></span><div><strong>Overdue group payouts</strong><small>{overview.attention.overduePayouts} payout{overview.attention.overduePayouts === 1 ? "" : "s"}</small></div><Icon name="chevron"/></button><button onClick={onCampaigns}><span className="attention-icon green"><Icon name="campaign"/></span><div><strong>Flagged campaigns</strong><small>{overview.attention.flaggedCampaigns} campaign{overview.attention.flaggedCampaigns === 1 ? "" : "s"}</small></div><Icon name="chevron"/></button></div></section><section className="admin-card kyc-card"><div className="card-heading"><div><span className="kicker">IDENTITY STATUS</span><h2>Verification health</h2></div></div><div className="kyc-chart"><div className="donut" style={{ "--verified": `${overview.metrics.users ? Math.round(((overview.kyc.verified || 0) / overview.metrics.users) * 100) : 0}%` } as CSSProperties}><span><strong>{overview.kyc.verified || 0}</strong><small>Verified</small></span></div><ul><li><i className="verified"></i><span>Verified</span><b>{overview.kyc.verified || 0}</b></li><li><i className="review"></i><span>In review</span><b>{overview.kyc.in_review || 0}</b></li><li><i className="not-started"></i><span>Not started</span><b>{overview.kyc.not_started || 0}</b></li></ul></div></section></div><section className="admin-card member-table"><div className="card-heading"><div><span className="kicker">RECENT MEMBERS</span><h2>Newest accounts</h2></div></div><UserTable users={users.slice(0, 6)} onSelect={onSelectUser}/></section></div>;
}

function UserTable({ users, onSelect }: { users: AdminUser[]; onSelect: (id: string) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Member</th><th>KYC status</th><th>Joined</th><th>Last active</th><th>Account</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{users.map(user => <tr key={user._id}><td><div className="table-member"><span>{user.avatarUrl ? <img alt="" src={user.avatarUrl}/> : initials(user.fullName)}</span><div><strong>{user.fullName}</strong><small>{user.email}</small></div></div></td><td><Status user={user}/></td><td>{date(user.createdAt)}</td><td>{date(user.lastLoginAt)}</td><td><span className={user.isActive ? "account-active" : "account-inactive"}>{user.isActive ? "Active" : "Inactive"}</span></td><td><button className="view-member" onClick={() => onSelect(user._id)}>Review <Icon name="chevron" size={15}/></button></td></tr>)}</tbody></table>{users.length === 0 && <div className="empty-table"><Icon name="search"/><strong>No members found</strong><p>Try another name or email address.</p></div>}</div>;
}

function UsersPage({ users, search, setSearch, onSelectUser }: { users: AdminUser[]; search: string; setSearch: (value: string) => void; onSelectUser: (id: string) => void }) {
  return <div className="dashboard-content"><div className="dashboard-title"><div><span className="kicker">MEMBERS</span><h1>People on KasaFund</h1><p>Find accounts and review their current trust status.</p></div></div><section className="admin-card users-card"><div className="user-tools"><label><Icon name="search"/><input aria-label="Search members" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)}/></label><span>{users.length} shown</span></div><UserTable users={users} onSelect={onSelectUser}/></section></div>;
}

function KycReviewPage({ users, onSelectUser }: { users: AdminUser[]; onSelectUser: (id: string) => void }) {
  return <div className="dashboard-content"><div className="dashboard-title"><div><span className="kicker">KYC REVIEW</span><h1>Identity review queue</h1><p>Provider-managed cases that are in progress, under review, or require resubmission.</p></div><span className="queue-summary">{users.length} waiting</span></div><div className="review-boundary"><Icon name="shield"/><div><strong>Provider decisions stay authoritative</strong><p>Review context here, then refresh a case from Didit. KasaFund administrators cannot manually manufacture a verified status.</p></div></div>{users.length ? <section className="admin-card users-card"><UserTable users={users} onSelect={onSelectUser}/></section> : <div className="queue-clear"><span><Icon name="check"/></span><strong>The review queue is clear</strong><p>New provider-managed cases will appear here automatically.</p></div>}</div>;
}

function AdminApp() {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });
  const login = (next: AuthSession) => { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); setSession(next); };
  const logout = () => { sessionStorage.removeItem(SESSION_KEY); setSession(null); };
  return session ? <AdminDashboard session={session} onLogout={logout}/> : <AdminLogin onLogin={login}/>;
}

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/admin")) return <AdminApp/>;
  if (path === "/support") return <SupportPage/>;
  if (path === "/privacy") return <PrivacyPage/>;
  if (path === "/terms") return <TermsPage/>;
  return <LandingPage/>;
}
