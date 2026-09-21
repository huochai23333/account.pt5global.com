"use client";

import {
  IdCard,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { LegalFooterLinks } from "@/components/legal/legal-footer-links";
import { DashboardAccountCenterSection } from "./dashboard-account-center-section";
import { AccountVerificationSection, PersonalCenterSection, ProfileInfoSection } from "./dashboard-my-content-sections";
import type { DashboardMyCopy } from "./dashboard-shared-my-copy";
import { DashboardAccountSwitcherSection } from "./dashboard-account-switcher-section";
import type { DashboardSharedMyState } from "./use-dashboard-shared-my-state";

type DashboardSharedMySectionsProps = {
  copy: DashboardMyCopy;
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
