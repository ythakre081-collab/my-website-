import { createFileRoute } from "@tanstack/react-router";
import { ReferralLinksSection } from "@/components/referral-links-section";

export const Route = createFileRoute("/_app/bank-account-refer")({
  component: () => (
    <ReferralLinksSection
      pageTitle="Bank Account Refer"
      pageDescription="Share your bank account referral links — copy or send in one tap"
      categoryFilter="Bank Account"
    />
  ),
});