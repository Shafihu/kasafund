import { PreferenceSettingsScreen } from "@/components/settings/PreferenceSettingsScreen";
import React from "react";

export default function PrivacySettingsScreen() {
  return (
    <PreferenceSettingsScreen
      footer="Your email, phone number, wallet details, and identity documents are always private."
      items={[
        {
          key: "publicProfile",
          title: "Public member profile",
          subtitle: "Let any signed-in KasaFund user view your profile",
          icon: "globe-outline",
        },
        {
          key: "showProfileBio",
          title: "Show my bio",
          subtitle: "Display your introduction on your member profile",
          icon: "reader-outline",
        },
        {
          key: "showSharedGroups",
          title: "Show shared groups",
          subtitle: "Let visitors see the active groups you have in common",
          icon: "people-outline",
        },
        {
          key: "showOnLeaderboard",
          title: "Appear on KasaPoints leaderboard",
          subtitle: "Show your name, tier and earned points in public rankings",
          icon: "trophy-outline",
        },
        {
          key: "allowGroupInvites",
          title: "Allow group invitations",
          subtitle: "Let other KasaFund users send you group invitations",
          icon: "person-add-outline",
        },
      ]}
      sectionTitle="Member privacy"
      subtitle="Choose how other signed-in members can find and interact with you."
      title="Privacy settings"
    />
  );
}
