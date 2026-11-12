"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DashboardPagedRecords } from "../dashboard-paged-records";
import { Building2, Network, Plus, Search } from "lucide-react";
import { WholesaleReferralsDialog } from "./wholesale-referrals-dialog";
import {
  DashboardFilterField,
  DashboardListSection,
} from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import type { WholesaleCustomer, WholesaleReferral } from "@/lib/wholesale";
import { formatDate } from "./wholesale-display";
import {
  buildWholesaleReferralTree,
  filterWholesaleReferralTree,
  flattenWholesaleReferralDirectory,
  type WholesaleReferralTreeNode,
} from "./wholesale-referrals-display";
import {
  WholesaleEmptyState,
  WholesalePageShell,
} from "./wholesale-ui";
type WholesaleReferralsSectionProps = {
  canEdit: boolean;
  customers: WholesaleCustomer[];
  customersById: Map<string, WholesaleCustomer>;
  onCreateReferral: (formData: FormData) => Promise<boolean>;
  pendingKey: string | null;
  referrals: WholesaleReferral[];
};
export function WholesaleReferralsSection({
  canEdit,
  customers,
  customersById,
  onCreateReferral,
  pendingKey,
  referrals,
}: WholesaleReferralsSectionProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_referrals_section",
  );
  const t = useTranslations("WholesaleBusiness.referralsUi");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const tree = useMemo(
    () =>
      buildWholesaleReferralTree({
        companyBranchName: t("companyName"),
        customers,
        customersById,
        referrals,
      }),
    [customers, customersById, referrals, t],
  );
  const filteredTree = useMemo(
    () => filterWholesaleReferralTree(tree, searchText),
    [searchText, tree],
  );
  const directoryRows = useMemo(() => flattenWholesaleReferralDirectory(filteredTree), [filteredTree]);
  return (
    <WholesalePageShell
      actions={
        canEdit ? (
          <Button
            variant="primary"
            size="default"
            onClick={() => setDialogOpen(true)}
            type="button"
          >
            <Plus className="size-4" />
            <UiMessage id="components_dashboard_wholesale_wholesale_referrals_section.text001" />
          </Button>
        ) : null
      }
      title={uiText("attribute003")}
    >
      <DashboardListSection
        ariaLabel={uiText("attribute004")}
        description={t("summary", {
          customers: customers.length,
          referrals: referrals.length,
        })}
      >
        <div className="mb-5">
          <DashboardFilterField label={uiText("attribute005")}>
            <div className="flex items-center gap-3 rounded-record-card border border-border bg-surface-interactive px-4">
              <Search className="size-4 text-content-muted" />
              <FormControls.Input
                className="h-12 w-full bg-transparent text-sm text-content-strong outline-none placeholder:text-content-subtle"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={uiText("attribute006")}
                type="search"
                value={searchText}
              />
            </div>
          </DashboardFilterField>
        </div>

        <DashboardPagedRecords items={directoryRows} queryKey={searchText}>
          {(pageRows) => filteredTree.length === 0 ? (
            <WholesaleEmptyState
              description={uiText("attribute007")}
              icon={<Network className="size-5" />}
              title={uiText("attribute008")}
            />
          ) : (
            <div className="space-y-3">
              {pageRows.map(({ node, path }) => (
                <div key={node.id}>
                  <p className="mb-2 break-words text-xs text-content-muted">
                    {path.join(" → ")}
                  </p>
                  <ReferralDirectoryRow node={node} />
                </div>
              ))}
            </div>
          )}
        </DashboardPagedRecords>
      </DashboardListSection>

      <WholesaleReferralsDialog
        customers={customers}
        onCreateReferral={onCreateReferral}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        pending={pendingKey === "referral:create"}
      />
    </WholesalePageShell>
  );
}
// 分页已经决定本次显示哪些客户。此处只渲染一条记录。
function ReferralDirectoryRow({ node }: { node: WholesaleReferralTreeNode }) {
  const t = useTranslations("WholesaleBusiness.referralsUi");
  const isCompanyNode = node.kind === "company";
  return (
    <div
      className={[
        "rounded-control-large border bg-surface-interactive p-4",
        isCompanyNode
          ? "border-border-subtle bg-surface-inset"
          : "border-border-subtle",
      ].join(" ")}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-status-info-soft text-primary">
            {isCompanyNode ? (
              <Building2 className="size-5" />
            ) : (
              <Network className="size-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="break-words font-semibold text-content-strong">
              {node.name}
            </p>
            <p className="mt-1 text-sm leading-6 text-content-muted">
              {getReferralNodeHelper(node, t)}
            </p>
          </div>
        </div>
        <span
          className={[
            "inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold",
            isCompanyNode
              ? "bg-surface-inset text-primary"
              : "bg-status-info-soft text-primary",
          ].join(" ")}
        >
          {isCompanyNode
            ? t("mainBranch")
            : t("children", { count: node.children.length })}
        </span>
      </div>
    </div>
  );
}
function getReferralNodeHelper(
  node: WholesaleReferralTreeNode,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (node.kind === "company") {
    return t("companyDescription");
  }
  if (!node.createdAt) {
    return t("companyChild");
  }
  return t("referredAt", { value: formatDate(node.createdAt) });
}
