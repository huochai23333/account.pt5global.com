"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DashboardPagedRecords } from "../dashboard-paged-records";
import { Building2, Network, Plus, Search } from "lucide-react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import {
  DashboardFilterField,
  DashboardListSection,
} from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
  WholesaleSubmitButton,
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

        <DashboardPagedRecords items={directoryRows} queryKey={searchText}>{(pageRows) => filteredTree.length === 0 ? (
          <WholesaleEmptyState
            description={uiText("attribute007")}
            icon={<Network className="size-5" />}
            title={uiText("attribute008")}
          />
        ) : (
            <div className="space-y-3">
              {pageRows.map(({ node, path }) => <div key={node.id}>
                <p className="mb-2 break-words text-xs text-content-muted">{path.join(" → ")}</p>
                <ReferralTreeNode node={node} showChildren={false} />
              </div>)}
            </div>
        )}</DashboardPagedRecords>
      </DashboardListSection>

      <DashboardDialog
        description={uiText("attribute009")}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title={uiText("attribute010")}
      >
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const succeeded = await onCreateReferral(new FormData(form));
            // 保存失败时弹窗保持打开，两位客户的选择也继续保留。
            if (!succeeded) return;
            form.reset();
            setDialogOpen(false);
          }}
        >
          <DashboardFilterField label={uiText("attribute011")}>
            <Select
              aria-label={uiText("attribute011")}
              name="referrer_customer_id"
              options={[
                {
                  label: (
                    <UiMessage id="components_dashboard_wholesale_wholesale_referrals_section.text002" />
                  ),
                  value: "",
                },
                ...customers.map((customer) => ({
                  label: customer.unique_name,
                  value: customer.id,
                })),
              ]}
              required
            />
          </DashboardFilterField>
          <DashboardFilterField label={uiText("attribute012")}>
            <Select
              aria-label={uiText("attribute012")}
              name="referred_customer_id"
              options={[
                {
                  label: (
                    <UiMessage id="components_dashboard_wholesale_wholesale_referrals_section.text003" />
                  ),
                  value: "",
                },
                ...customers.map((customer) => ({
                  label: customer.unique_name,
                  value: customer.id,
                })),
              ]}
              required
            />
          </DashboardFilterField>
          <div className="flex justify-end md:col-span-2">
            <WholesaleSubmitButton pending={pendingKey === "referral:create"}>
              <UiMessage id="components_dashboard_wholesale_wholesale_referrals_section.text004" />
            </WholesaleSubmitButton>
          </div>
        </form>
      </DashboardDialog>
    </WholesalePageShell>
  );
}
function ReferralTreeNode({ node, showChildren = true }: {
  node: WholesaleReferralTreeNode;
  showChildren?: boolean;
}) {
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
      {showChildren && node.children.length > 0 ? (
        <div className="mt-3 space-y-3 border-l border-border pl-4">
          {node.children.map((child) => (
            <ReferralTreeNode key={child.id} node={child} />
          ))}
        </div>
      ) : null}
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
