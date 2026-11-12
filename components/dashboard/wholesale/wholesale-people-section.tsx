"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { UserCog } from "lucide-react";
import type { WholesaleProfile } from "@/lib/wholesale";
import { WholesaleAccountDialog } from "./wholesale-account-dialog";
import { WholesaleSalesAccountPeopleTab } from "./wholesale-people-tabs";
import { WholesalePageShell } from "./wholesale-ui";
import { ALL_DIRECTORY_ITEMS as ALL, filterWholesaleSalesAccounts } from "./wholesale-people-filters";
type WholesalePeopleSectionProps = {
  salesAccounts: WholesaleProfile[];
};
export function WholesalePeopleSection({
  salesAccounts,
}: WholesalePeopleSectionProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_people_section",
  );
  const [selectedProfile, setSelectedProfile] =
    useState<WholesaleProfile | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountRoleFilter, setAccountRoleFilter] = useState(ALL);
  const [accountStatusFilter, setAccountStatusFilter] = useState(ALL);
  const filteredAccounts = useMemo(
    () => filterWholesaleSalesAccounts(salesAccounts, {
      search: accountSearch,
      role: accountRoleFilter,
      status: accountStatusFilter,
    }),
    [accountRoleFilter, accountSearch, accountStatusFilter, salesAccounts],
  );
  const hasAccountFilters =
    accountSearch || accountRoleFilter !== ALL || accountStatusFilter !== ALL;
  return (
    <WholesalePageShell
      title={uiText("attribute003")}
    >
      <div className="inline-flex w-fit items-center gap-2 rounded-full bg-status-info-soft px-3 py-1 text-xs font-semibold text-primary">
        <UserCog className="size-4" />
        <UiMessage id="components_dashboard_wholesale_wholesale_people_section.text001" />
      </div>

      <WholesaleSalesAccountPeopleTab
        accountRoleFilter={accountRoleFilter}
        accountSearch={accountSearch}
        accountStatusFilter={accountStatusFilter}
        filteredAccounts={filteredAccounts}
        hasAccountFilters={Boolean(hasAccountFilters)}
        onAccountRoleFilterChange={setAccountRoleFilter}
        onAccountSearchChange={setAccountSearch}
        onAccountStatusFilterChange={setAccountStatusFilter}
        onResetAccountFilters={() => {
          setAccountSearch("");
          setAccountRoleFilter(ALL);
          setAccountStatusFilter(ALL);
        }}
        onSelectProfile={setSelectedProfile}
        salesAccounts={salesAccounts}
      />

      <WholesaleAccountDialog
        onSelectedProfileChange={setSelectedProfile}
        selectedProfile={selectedProfile}
      />
    </WholesalePageShell>
  );
}
