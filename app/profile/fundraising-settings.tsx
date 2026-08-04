import { PreferenceSettingsScreen } from "@/components/settings/PreferenceSettingsScreen";
import React from "react";

export default function FundraisingSettingsScreen() {
  return (
    <PreferenceSettingsScreen
      footer="You can always change anonymity for an individual donation before confirming it."
      items={[
        { key: "campaignNotifications", title: "Campaign updates", subtitle: "Updates from campaigns you have supported", icon: "megaphone-outline" },
        { key: "donationNotifications", title: "Donation activity", subtitle: "Updates when people support your campaigns", icon: "heart-outline" },
        { key: "anonymousDonationsByDefault", title: "Donate anonymously by default", subtitle: "Hide your identity initially on eligible donations", icon: "eye-off-outline" },
      ]}
      sectionTitle="Fundraising preferences"
      subtitle="Manage campaign activity and your default donation privacy."
      title="Fundraising settings"
    />
  );
}
