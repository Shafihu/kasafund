import { useEffect, type ReactNode } from "react";
import "./public-pages.css";

type PublicPage = "support" | "privacy" | "terms";

function PolicyIcon({ name }: { name: "mail" | "shield" | "phone" | "arrow" }) {
  const paths: Record<string, ReactNode> = {
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    shield: <><path d="M12 3 4.5 6v5.2c0 4.7 3.2 8 7.5 9.8 4.3-1.8 7.5-5.1 7.5-9.8V6L12 3Z"/><path d="m9 12 2 2 4-5"/></>,
    phone: <path d="M6.6 3h3l1.2 5-2 1.3a15 15 0 0 0 5.9 5.9l1.3-2 5 1.2v3A2.6 2.6 0 0 1 18.4 20C10.5 20 4 13.5 4 5.6A2.6 2.6 0 0 1 6.6 3Z"/>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  };
  return <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>;
}

function PublicHeader({ current }: { current: PublicPage }) {
  return <header className="policy-header"><a className="policy-brand" href="/"><img alt="" src="/kasafund-mark.svg"/><span>KasaFund</span></a><nav aria-label="Utility navigation"><a className={current === "support" ? "active" : ""} href="/support">Support</a><a className={current === "privacy" ? "active" : ""} href="/privacy">Privacy</a><a className={current === "terms" ? "active" : ""} href="/terms">Terms</a></nav><a className="policy-home" href="/">Back to home</a></header>;
}

function PublicFooter() {
  return <footer className="policy-footer"><a className="policy-brand light" href="/"><img alt="" src="/kasafund-mark.svg"/><span>KasaFund</span></a><p>Community money, made clearer.</p><nav><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav><small>© {new Date().getFullYear()} KasaFund. Built in Ghana.</small></footer>;
}

function PolicyShell({ current, eyebrow, title, intro, children }: { current: PublicPage; eyebrow: string; title: string; intro: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} | KasaFund`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [title]);

  return <div className="policy-shell"><PublicHeader current={current}/><main><section className="policy-hero"><span>{eyebrow}</span><h1>{title}</h1><p>{intro}</p></section>{children}</main><PublicFooter/></div>;
}

export function SupportPage() {
  const whatsappUrl = import.meta.env.VITE_WHATSAPP_SUPPORT_URL as string | undefined;
  return <PolicyShell current="support" eyebrow="KASAFUND SUPPORT" title="How can we help?" intro="Find the safest next step for account access, payments, groups, fundraising, or trust concerns.">
    <section className="support-contact-grid">
      <a className="support-primary" href="mailto:support@kasafund.com?subject=KasaFund%20support%20request"><span><PolicyIcon name="mail"/></span><div><small>EMAIL SUPPORT</small><h2>support@kasafund.com</h2><p>Include the email on your KasaFund account and a short description. Never send your password, OTP, card PIN, or mobile-money PIN.</p><strong>Start an email <PolicyIcon name="arrow"/></strong></div></a>
      <article className="support-safety"><span><PolicyIcon name="shield"/></span><div><small>TRUST & SAFETY</small><h2>Report inside the app</h2><p>Use the report action on a member profile or campaign for confidential review by the KasaFund safety team.</p></div></article>
      {whatsappUrl ? <a className="support-whatsapp" href={whatsappUrl} rel="noreferrer" target="_blank"><span><PolicyIcon name="phone"/></span><div><small>WHATSAPP ASSISTANT</small><h2>Get KasaFund guidance</h2><p>Open the configured KasaFund WhatsApp support channel.</p><strong>Open WhatsApp <PolicyIcon name="arrow"/></strong></div></a> : null}
    </section>
    <section className="support-guide"><div><span className="policy-kicker">QUICK GUIDANCE</span><h2>Start with the right route.</h2><p>Using the right channel helps protect your account and gives the team the context needed to help.</p></div><div className="faq-list">
      <details><summary>My payment is pending or failed <span>+</span></summary><p>Keep the transaction reference shown in KasaFund. Do not repeat a payment until its status is clear. Email support with the reference, amount, approximate time, and payment method.</p></details>
      <details><summary>I cannot access my account <span>+</span></summary><p>Use “Forgot password” on the sign-in screen. For verification or account-access problems, contact support from the email address associated with the account.</p></details>
      <details><summary>I have a group contribution or payout concern <span>+</span></summary><p>Review the group agreement, contribution ledger, payout schedule, and any active resolution first. Include the group name and affected cycle when contacting support.</p></details>
      <details><summary>I suspect a scam or unsafe campaign <span>+</span></summary><p>Open the relevant member profile or campaign and choose Report. Reports are confidential and do not automatically punish the person or campaign.</p></details>
      <details><summary>My identity verification is taking longer than expected <span>+</span></summary><p>Check the Identity Verification section in your profile for the provider’s current status. Support cannot manufacture or override a provider decision.</p></details>
    </div></section>
    <section className="support-urgent"><PolicyIcon name="shield"/><div><strong>Immediate danger or suspected theft?</strong><p>Secure your mobile-money or bank account with the provider first. For urgent danger, contact the appropriate local emergency or law-enforcement service.</p></div></section>
  </PolicyShell>;
}

const UPDATED = "4 August 2026";

export function PrivacyPage() {
  return <PolicyShell current="privacy" eyebrow="PRIVACY NOTICE" title="Your information should move with care." intro="This notice explains what KasaFund collects, why it is used, and the choices available to you.">
    <div className="policy-layout"><aside><strong>On this page</strong><a href="#collect">Information we collect</a><a href="#use">How we use it</a><a href="#share">When we share it</a><a href="#retain">Retention and security</a><a href="#choices">Your choices</a><a href="#contact">Contact</a></aside><article className="policy-copy"><p className="policy-updated">Last updated {UPDATED}</p>
      <section><h2>Overview</h2><p>KasaFund provides community savings groups, personal savings tools, fundraising, wallet activity, identity verification, safety reporting, and related support. We collect only the information reasonably needed to provide, secure, and improve those services.</p></section>
      <section id="collect"><h2>Information we collect</h2><h3>Account and profile information</h3><p>This can include your name, email address, phone number, profile image, biography, preferences, account status, and authentication records.</p><h3>Identity-verification information</h3><p>For protected actions, KasaFund records verification status and relevant provider references. The verification provider may separately process identity documents and biometric information under its own privacy terms.</p><h3>Financial and participation records</h3><p>We process wallet transactions, savings activity, group contributions, payout schedules, campaign donations, payment references, and the agreements or votes connected to those activities.</p><h3>Safety, support, and communications</h3><p>We process reports, confidential report details, administrator review notes, support communications, campaign updates, group messages, and notification history.</p><h3>Technical information</h3><p>We may receive device, app, network, log, and diagnostic information needed to secure the service and investigate failures.</p></section>
      <section id="use"><h2>How we use information</h2><ul><li>Provide and maintain your KasaFund account and requested features.</li><li>Verify identity and protect higher-risk actions.</li><li>Record contributions, payouts, donations, savings, votes, and agreements accurately.</li><li>Prevent fraud, investigate reports, enforce platform rules, and maintain audit records.</li><li>Send service, security, payment, campaign, and support notifications.</li><li>Diagnose problems and improve reliability and accessibility.</li><li>Meet lawful regulatory, accounting, dispute, and security obligations.</li></ul></section>
      <section id="share"><h2>When we share information</h2><p>We may share the minimum necessary information with identity-verification, payment, cloud-hosting, communications, analytics, and security providers that support KasaFund. Information may also be disclosed where required by law, to protect users or the service, or as part of a properly managed business transfer.</p><p>Group and campaign information is shared according to the feature’s visibility and participation settings. Confidential reporters are not identified to the reported member or campaign organizer through the report workflow.</p></section>
      <section id="retain"><h2>Retention and security</h2><p>We retain information for as long as needed to provide the service, maintain financial and audit records, resolve disputes, prevent abuse, and meet legal obligations. Retention periods can differ by record type.</p><p>We use access controls, encrypted transport, password hashing, provider-managed verification, audit logging, and operational safeguards. No online system can guarantee absolute security.</p></section>
      <section id="choices"><h2>Your choices and rights</h2><p>You can update certain profile and notification settings in the app. You may contact KasaFund to request access, correction, or deletion where applicable. Some financial, safety, or audit records may need to be retained for lawful and legitimate purposes.</p><p>You can control campaign visibility, anonymous-donation settings, public-profile preferences, and available communication preferences through the relevant app screens.</p></section>
      <section><h2>Children</h2><p>KasaFund is not intended for children who cannot lawfully enter the financial and platform agreements described in these terms. Do not create an account for a child without the authority and safeguards required by applicable law.</p></section>
      <section><h2>Changes to this notice</h2><p>We may update this notice as KasaFund changes. The revised date will appear at the top, and material changes may also be communicated in the app or by email.</p></section>
      <section id="contact"><h2>Contact</h2><p>For privacy questions or requests, email <a href="mailto:privacy@kasafund.com">privacy@kasafund.com</a>. For general product help, visit the <a href="/support">support centre</a>.</p></section>
    </article></div>
  </PolicyShell>;
}

export function TermsPage() {
  return <PolicyShell current="terms" eyebrow="TERMS OF USE" title="Clear expectations protect the whole circle." intro="These terms describe the rules for accessing KasaFund and using its savings, group, wallet, and fundraising features.">
    <div className="policy-layout"><aside><strong>On this page</strong><a href="#account">Your account</a><a href="#money">Financial features</a><a href="#groups">Groups</a><a href="#campaigns">Campaigns</a><a href="#conduct">Acceptable use</a><a href="#enforcement">Enforcement</a><a href="#contact">Contact</a></aside><article className="policy-copy"><p className="policy-updated">Last updated {UPDATED}</p>
      <section><h2>Agreement</h2><p>By creating an account or using KasaFund, you agree to these terms and the <a href="/privacy">Privacy Notice</a>. If you do not agree, do not use the service.</p></section>
      <section id="account"><h2>Your account</h2><p>You must provide accurate information, keep your sign-in credentials and verification codes confidential, and notify KasaFund promptly if you believe your account has been compromised. You are responsible for activity performed through your account unless applicable law provides otherwise.</p><p>Some features require identity verification. KasaFund may rely on an external verification provider and cannot guarantee that every submission will be approved.</p></section>
      <section id="money"><h2>Financial features and payments</h2><p>KasaFund provides software for recording and coordinating savings, contributions, payouts, wallet activity, and donations. Payment processing and transfers may be performed by third-party financial providers and remain subject to their availability, verification, limits, and terms.</p><p>Review the exact amount, recipient, group, campaign, schedule, and payment method before confirming an action. A displayed pending status is not confirmation that money has settled.</p><p>KasaFund is not a bank, investment adviser, insurer, or guarantor of another user’s obligations. Returns, payouts, fundraising outcomes, and the conduct of other users are not guaranteed.</p></section>
      <section id="groups"><h2>Susu groups and agreements</h2><p>Before joining or activating a group, review its contribution amount, frequency, grace period, penalties, payout order, voting rules, and accelerated-debt terms. The group agreement and recorded ledger govern the platform workflow for that circle.</p><p>Owners and administrators must not misrepresent terms, manipulate records, or use their role to bypass voting and payout protections. Members remain responsible for commitments they knowingly accept.</p></section>
      <section id="campaigns"><h2>Campaigns and donations</h2><p>Campaign organizers must provide truthful information, use funds consistently with the stated purpose, and publish updates where circumstances materially change. They must have the right to use submitted images and content.</p><p>Donors should evaluate each campaign before contributing. A donation supports the campaign’s stated purpose but does not purchase ownership, repayment, investment returns, or a guaranteed result unless expressly required by applicable law.</p><p>Campaigns may be reported and reviewed. KasaFund may temporarily flag a campaign, preventing discovery and new donations, while a concern is reviewed. Flagging does not alter completed donation records.</p></section>
      <section id="conduct"><h2>Acceptable use</h2><p>You must not use KasaFund for fraud, harassment, impersonation, unlawful fundraising, money laundering, exploitation, misleading content, unauthorized access, service disruption, or attempts to bypass identity, payment, voting, moderation, or security controls.</p></section>
      <section id="enforcement"><h2>Reports, moderation, and enforcement</h2><p>KasaFund may investigate reports, preserve audit records, request additional information, restrict content, or take proportionate action where necessary to protect users and the service. A report does not automatically establish wrongdoing or trigger punishment.</p><p>Where practical, moderation decisions should be reasoned and reversible. Serious legal, security, or financial risks may require immediate action or cooperation with appropriate authorities and service providers.</p></section>
      <section><h2>Availability and changes</h2><p>KasaFund may change, suspend, or discontinue features to maintain security, comply with legal obligations, or improve the service. We do not promise uninterrupted availability. Material changes to these terms will be communicated through reasonable channels.</p></section>
      <section><h2>Liability</h2><p>To the extent permitted by applicable law, KasaFund is not responsible for indirect or consequential losses, user misrepresentation, group defaults, campaign outcomes, or failures outside its reasonable control. Nothing in these terms excludes rights or liabilities that cannot lawfully be excluded.</p></section>
      <section><h2>Governing law</h2><p>These terms are governed by the laws of Ghana, subject to any mandatory consumer or data-protection rights that apply to you. The parties should first attempt to resolve concerns through KasaFund support before pursuing another available remedy.</p></section>
      <section id="contact"><h2>Contact</h2><p>Questions about these terms can be sent to <a href="mailto:legal@kasafund.com">legal@kasafund.com</a>. Product and account questions should go through the <a href="/support">support centre</a>.</p></section>
    </article></div>
  </PolicyShell>;
}
