import { PreferenceSettingsScreen } from "@/components/settings/PreferenceSettingsScreen";
import React from "react";

export default function WalletSettingsScreen() {
  return (
    <PreferenceSettingsScreen
      footer="Wallet funds are held in Ghana cedis. Hiding your balance changes its default visibility; you can still reveal it from the wallet card."
      infoItems={[
        { id: "currency", title: "Wallet currency", subtitle: "Ghana cedi (GH₵)", icon: "cash-outline", type: "info" },
        { id: "processing", title: "Withdrawal processing", subtitle: "Availability depends on your configured payout provider", icon: "time-outline", type: "info" },
      ]}
      items={[
        { key: "hideWalletBalance", title: "Hide balance by default", subtitle: "Mask your wallet balance whenever the wallet opens", icon: "eye-off-outline" },
        { key: "gamifiedSavings", title: "Playful personal saving", subtitle: "Drag cash into a piggy bank when saving manually to My Susu", icon: "sparkles-outline" },
      ]}
      sectionTitle="Wallet experience"
      subtitle="Control how your wallet and personal saving interactions behave."
      title="Wallet settings"
    />
  );
}
