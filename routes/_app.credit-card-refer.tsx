import { createFileRoute } from "@tanstack/react-router";
import { ReferralLinksSection } from "@/components/referral-links-section";

export const Route = createFileRoute("/_app/credit-card-refer")({
  component: () => (
    <ReferralLinksSection
      pageTitle="Credit Card Refer"
      pageDescription="Share your credit card referral links — copy or send in one tap"
      categoryFilter="Credit Card"
    />
  ),
});