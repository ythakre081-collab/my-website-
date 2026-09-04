import { createFileRoute } from "@tanstack/react-router";
import { ReferralLinksSection } from "@/components/referral-links-section";

export const Route = createFileRoute("/_app/important-links")({
  component: () => (
    <ReferralLinksSection
      pageTitle="Demat Account Refer Link"
      pageDescription="Share your referral links — copy or send in one tap"
      allowCategoryEdit
    />
  ),
});
