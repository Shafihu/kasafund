import * as Linking from "expo-linking";

export const KASAFUND_PUBLIC_LINKS = {
  privacy: "https://kasafund.com/privacy",
  support: "https://kasafund.com/support",
  terms: "https://kasafund.com/terms",
} as const;

export type KasaFundPublicPage = keyof typeof KASAFUND_PUBLIC_LINKS;

export function openKasaFundPublicPage(page: KasaFundPublicPage) {
  return Linking.openURL(KASAFUND_PUBLIC_LINKS[page]);
}
