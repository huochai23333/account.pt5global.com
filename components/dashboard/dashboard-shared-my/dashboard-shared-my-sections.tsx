"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/data-display";

import {
  BadgeCheck,
  IdCard,
  KeyRound,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { LegalFooterLinks } from "@/components/legal/legal-footer-links";
import { getReviewStatusTone } from "@/components/dashboard/dashboard-shared-ui";
import { Button } from "@/components/ui/button";

import { DashboardAccountCenterSection } from "./dashboard-account-center-section";
import { EmailReminderEntryCard } from "./email-reminder-entry-card";
import type { DashboardMyCopy } from "./dashboard-shared-my-copy";
import { DashboardAccountSwitcherSection } from "./dashboard-account-switcher-section";
import {
  DashboardMySectionShell,
  DashboardMyStatGrid,
  type DashboardMyStatItem,
} from "./dashboard-my-section-ui";
import type { DashboardSharedMyState } from "./use-dashboard-shared-my-state";

type DashboardSharedMySectionsProps = {
  copy: DashboardMyCopy;
  emailReminderHref?: string | null;
  state: Pick<
    DashboardSharedMyState,
    | "account"
    | "accountSwitcher"
    | "assetDialog"
    | "page"
    | "profileDialog"
    | "ui"
  >;
};

const SECTION_ITEMS = [
  {
    href: "#personal-center",
    icon: UserRound,
    key: "personalCenterTitle",
  },
  {
    href: "#account-center",
    icon: KeyRound,
    key: "accountCenterTitle",
  },
  {
    href: "#profile-info",
    icon: IdCard,
    key: "profileInfoTitle",
  },
  {
    href: "#account-verification",
    icon: ShieldCheck,
    key: "accountVerificationTitle",
  },
] as const;

export function DashboardSharedMySections({
  copy,
  emailReminderHref,
  state,
}: DashboardSharedMySectionsProps) {
  const { account, accountSwitcher, assetDialog, page, profileDialog, ui } =
    state;
  const [
    phoneStat,
    emailStat,
    passwordStat,
    inviteCodeStat,
    accountStatusStat,
    lastLoginStat,
  ] = account.profileStats;
  const profileStats = [
    { label: copy.nameLabel, value: account.displayName },
    { label: copy.cityLabel, value: account.displayCity },
    phoneStat,
    emailStat,
  ];
  const accountStats = [
    passwordStat,
    inviteCodeStat,
    accountStatusStat,
    lastLoginStat,
  ];

  return (
    <>
      <SectionNavigation copy={copy} />

      <PersonalCenterSection account={account} copy={copy} />

      {emailReminderHref ? <EmailReminderEntryCard href={emailReminderHref} /> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <ProfileInfoSection
          copy={copy}
          onEditProfile={profileDialog.openDialog}
          stats={profileStats}
          ui={ui}
        />
        <DashboardAccountCenterSection
          account={account}
          copy={copy}
          onRefreshProfile={() => void page.refreshBundle({ quiet: false })}
          stats={accountStats}
          ui={ui}
        />
      </div>

      <AccountVerificationSection
        account={account}
        assetDialog={assetDialog}
        copy={copy}
      />

      <DashboardAccountSwitcherSection
        copy={copy}
        state={accountSwitcher}
        ui={ui}
      />

      <footer className="flex flex-col gap-4 border-t border-border-subtle px-1 pt-8 text-xs text-content-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{copy.copyright}</p>
        <LegalFooterLinks className="gap-6" copy={copy} />
      </footer>
    </>
  );
}

function SectionNavigation({ copy }: { copy: DashboardMyCopy }) {
  return (
    <nav
      aria-label={copy.sectionNavigationLabel}
      className="sticky top-[7.25rem] z-[5] grid grid-cols-2 gap-3 rounded-surface-panel bg-surface-inset/90 py-2 backdrop-blur lg:top-[5.75rem] lg:grid-cols-4"
    >
      {SECTION_ITEMS.map((item) => {
        const Icon = item.icon;

        return (
          <a
            className="flex min-h-14 items-center gap-3 rounded-surface-inset border border-border-subtle bg-surface-panel px-4 py-3 text-sm font-semibold text-primary shadow-surface-interactive transition-colors hover:bg-surface-inset"
            href={item.href}
            key={item.href}
          >
            <Icon className="size-4.5 text-content-muted" />
            {copy[item.key]}
          </a>
        );
      })}
    </nav>
  );
}

function PersonalCenterSection({
  account,
  copy,
}: {
  account: DashboardSharedMyState["account"];
  copy: DashboardMyCopy;
}) {
  return (
    <section
      className="scroll-mt-28 rounded-surface-panel border border-surface-panel-border bg-surface-inset/92 p-6 shadow-surface-interactive xl:p-8"
      id="personal-center"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-interactive text-primary">
          <UserRound className="size-5" />
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-primary">
          {copy.personalCenterTitle}
        </h3>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-surface-inset px-3 py-1 text-xs font-semibold text-status-success">
            {account.membershipLabel}
          </span>
          <h2 className="mt-4 break-words text-4xl font-bold tracking-tight text-content-strong">
            {account.displayName}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-content-muted">
            <MapPin className="size-4" />
            {account.displayCity}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-content-muted">
            {copy.personalCenterDescription}
          </p>
        </div>
      </div>
    </section>
  );
}

function ProfileInfoSection({
  copy,
  onEditProfile,
  stats,
  ui,
}: {
  copy: DashboardMyCopy;
  onEditProfile: () => void;
  stats: readonly DashboardMyStatItem[];
  ui: DashboardSharedMyState["ui"];
}) {
  return (
    <DashboardMySectionShell
      action={
        <Button
          size="default"
          disabled={ui.busyKey !== null}
          onClick={onEditProfile}
          variant="outline"
        >
          <UserRound className="size-4" />
          {copy.editProfile}
        </Button>
      }
      description={copy.profileInfoDescription}
      icon={<IdCard className="size-5" />}
      id="profile-info"
      title={copy.profileInfoTitle}
    >
      <DashboardMyStatGrid stats={stats} />
    </DashboardMySectionShell>
  );
}

function AccountVerificationSection({
  account,
  assetDialog,
  copy,
}: {
  account: DashboardSharedMyState["account"];
  assetDialog: DashboardSharedMyState["assetDialog"];
  copy: DashboardMyCopy;
}) {
  return (
    <DashboardMySectionShell
      description={copy.accountVerificationDescription}
      icon={<ShieldCheck className="size-5" />}
      id="account-verification"
      title={copy.accountVerificationTitle}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <VerificationStatusCard account={account} copy={copy} />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:col-span-8">
          {assetDialog.assets.map((asset) => (
            <DesignButton
              className="group rounded-surface-panel border border-border-subtle bg-surface-interactive p-4 text-left shadow-surface-interactive transition-all duration-300 hover:-translate-y-1 hover:shadow-surface-interactive active:scale-[0.985]"
              key={asset.key}
              onClick={() => assetDialog.openDialog(asset.key)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-content-strong">
                  {asset.title}
                </p>
                <StatusBadge size="md" tone={getReviewStatusTone(asset.tone)}>
                  {asset.status}
                </StatusBadge>
              </div>
              <div className="relative mt-4 aspect-[1.58/1] overflow-hidden rounded-record-card bg-surface-inset">
                {asset.body}
                <div className="absolute inset-0 flex items-center justify-center bg-surface-panel opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-overlay text-primary">
                    <Search className="size-5" />
                  </div>
                </div>
              </div>
            </DesignButton>
          ))}
        </div>
      </div>
    </DashboardMySectionShell>
  );
}

function VerificationStatusCard({
  account,
  copy,
}: {
  account: DashboardSharedMyState["account"];
  copy: DashboardMyCopy;
}) {
  const tone = account.certified
    ? "success"
    : account.verificationStatus === "pending"
      ? "warning"
      : "info";

  return (
    <MetricCard
      description={
        account.certified
          ? copy.verificationApprovedDescription
          : account.verificationStatus === "pending"
            ? copy.verificationPendingDescription
            : copy.verificationEmptyDescription
      }
      icon={
        account.certified ? (
          <BadgeCheck className="size-5" />
        ) : (
          <ShieldAlert className="size-5" />
        )
      }
      label={copy.verificationTitle}
      presentation="summary"
      tone={tone}
      value={
        account.certified
          ? copy.verificationApproved
          : account.verificationStatus === "pending"
            ? copy.verificationPending
            : copy.verificationEmpty
      }
    />
  );
}
