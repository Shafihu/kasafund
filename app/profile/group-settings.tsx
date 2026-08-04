import { PreferenceSettingsScreen } from "@/components/settings/PreferenceSettingsScreen";
import React from "react";

export default function GroupSettingsScreen() {
  return (
    <PreferenceSettingsScreen
      footer="Role changes and other security-critical group events may still be shown even when optional alerts are disabled."
      items={[
        { key: "contributionReminders", title: "Contribution reminders", subtitle: "Remind me when a group contribution is due", icon: "calendar-outline" },
        { key: "payoutNotifications", title: "Payout updates", subtitle: "Notify me when group payouts are scheduled or completed", icon: "cash-outline" },
        { key: "groupInviteNotifications", title: "Group invitations", subtitle: "Notify me about invitations and responses", icon: "person-add-outline" },
      ]}
      sectionTitle="Group alerts"
      subtitle="Choose the group activity you want KasaFund to bring to your attention."
      title="Group settings"
    />
  );
}
