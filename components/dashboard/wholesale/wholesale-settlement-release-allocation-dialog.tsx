"use client";

import { AlertTriangle, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import * as FormControls from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type {
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleOrderSettlement,
} from "@/lib/wholesale";
import type {
  WholesaleSettlementRelease,
  WholesaleSettlementReleaseAllocation,
} from "@/lib/wholesale-settlement-releases";
import type { SettlementReleaseClearSubmission } from "@/lib/wholesale-settlement-release-clear";
import { formatCurrency } from "./wholesale-display";
import { formatSettlementReleaseSummary } from "./wholesale-settlement-release-display";
import type { SettlementReleaseAllocationSubmission } from "./use-wholesale-settlement-release-actions";
import { useWholesaleSettlementReleaseAllocationForm } from "./use-wholesale-settlement-release-allocation-form";
import { WholesaleSettlementReleaseAllocationOrderList } from "./wholesale-settlement-release-allocation-order-list";

type AllocationDialogProps = {
  allocations: WholesaleSettlementReleaseAllocation[];
  customers: WholesaleCustomer[];
  onClearAllocations: (
    submission: SettlementReleaseClearSubmission,
    onError: (message: string) => void,
  ) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  onSaveAllocations: (
    submission: SettlementReleaseAllocationSubmission,
  ) => Promise<boolean>;
  orderSettlements: WholesaleOrderSettlement[];
  orders: WholesaleOrder[];
  pendingAction: "clear" | "save" | null;
  release: WholesaleSettlementRelease;
};

export function WholesaleSettlementReleaseAllocationDialog({
  allocations,
  customers,
  onClearAllocations,
  onOpenChange,
  onSaveAllocations,
  orderSettlements,
  orders,
  pendingAction,
  release,
}: AllocationDialogProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_settlement_release_allocation_dialog",
  );
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const form = useWholesaleSettlementReleaseAllocationForm({
    allocations,
    orderSettlements,
    orders,
    release,
  });
  const [clearAllocationIds] = useState(() => form.activeAllocationIds);
  const hasFixedCustomer = Boolean(release.customer_id);
  const isPending = pendingAction !== null;

  return (
    <DashboardDialog
      description={uiText("description")}
      onOpenChange={onOpenChange}
      open
      title={getDialogTitle(release.status, uiText)}
    >
      <form
        className="grid min-w-0 gap-5"
        data-testid="settlement-allocation-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!form.canSubmit) return;

          const succeeded = await onSaveAllocations({
            allocations: form.submissionAllocations,
            customerId: form.customerId,
            expectedRevision: release.allocation_revision,
            releaseId: release.id,
          });
          // 数据库拒绝保存时保留草稿，业务员可以直接根据页面提示修改金额。
          if (succeeded) onOpenChange(false);
        }}
      >
        <div className="rounded-record-card border border-border-subtle bg-surface-panel p-4 sm:p-5">
          <p className="break-words text-sm font-semibold leading-6 text-content-strong [overflow-wrap:anywhere]">
            {formatSettlementReleaseSummary(release)}
          </p>
          <p className="mt-1 text-xs leading-5 text-content-muted">
            {release.note || uiText("noNote")}
          </p>
        </div>

        <FormControls.Field
          hint={
            hasFixedCustomer
              ? uiText("fixedCustomerHint")
              : uiText("temporaryCustomerHint")
          }
          label={uiText("customerLabel")}
          required
        >
          <Select
            aria-label={uiText("customerLabel")}
            disabled={hasFixedCustomer}
            onValueChange={form.setCustomerId}
            options={[
              { label: uiText("selectCustomer"), value: "" },
              ...customers.map((customer) => ({
                label: customer.unique_name,
                value: customer.id,
              })),
            ]}
            value={form.customerId}
          />
        </FormControls.Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <AmountSummary
            label={uiText("receiptAmount")}
            value={formatCurrency(
              release.release_amount,
              release.release_currency,
            )}
          />
          <AmountSummary
            label={uiText("allocatedAmount")}
            tone="success"
            value={formatCurrency(
              form.allocatedAmount,
              release.release_currency,
            )}
          />
          <AmountSummary
            label={uiText("remainingAmount")}
            tone={form.remainingAmount > 0 ? "warning" : "success"}
            value={formatCurrency(
              form.remainingAmount,
              release.release_currency,
            )}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-record-card border border-border-subtle bg-surface-panel p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-content-strong">
              {uiText("suggestionTitle")}
            </p>
            <p className="mt-1 text-xs leading-5 text-content-muted">
              {uiText("suggestionHint")}
            </p>
          </div>
          <Button
            disabled={!form.customerId || isPending}
            onClick={form.fillSuggestion}
            type="button"
            variant="outline"
            wrap
          >
            <Sparkles className="size-4" />
            {uiText("regenerateSuggestion")}
          </Button>
        </div>

        {form.customerId ? (
          <WholesaleSettlementReleaseAllocationOrderList
            currency={release.release_currency}
            onAmountChange={form.setAllocationAmount}
            onSearchTextChange={form.setSearchText}
            searchText={form.searchText}
            visibleCandidates={form.visibleCandidates}
          />
        ) : (
          <div className="rounded-record-card border border-dashed border-border-subtle bg-surface-panel px-4 py-8 text-center text-sm text-content-muted">
            {uiText("selectCustomerFirst")}
          </div>
        )}

        {form.exceedsReleaseAmount ? (
          <InlineWarning text={uiText("releaseExceeded")} />
        ) : null}

        {confirmingClear ? (
          <div className="rounded-record-card border border-status-danger-border bg-status-danger-soft p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-danger" />
              <div className="min-w-0">
                <p className="font-semibold text-status-danger">
                  {uiText("clearConfirmTitle")}
                </p>
                <p className="mt-1 text-sm leading-6 text-content-muted">
                  {uiText("clearConfirmDescription")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                disabled={isPending}
                onClick={() => {
                  setClearError(null);
                  setConfirmingClear(false);
                }}
                type="button"
                variant="outline"
              >
                {uiText("keepAllocations")}
              </Button>
              <Button
                disabled={isPending}
                onClick={async () => {
                  setClearError(null);
                  // 保存点来自表单打开时的版本和分配编号，不能用最新列表覆盖这次确认。
                  const succeeded = await onClearAllocations({
                    releaseId: release.id,
                    expectedRevision: release.allocation_revision,
                    activeAllocationIds: clearAllocationIds,
                  }, setClearError);
                  if (succeeded) onOpenChange(false);
                }}
                type="button"
                variant="danger"
              >
                {pendingAction === "clear" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {uiText("confirmClear")}
              </Button>
            </div>
            {clearError ? <p role="alert" className="mt-3 text-sm text-status-danger">{clearError}</p> : null}
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col-reverse gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {clearAllocationIds.length > 0 && !confirmingClear ? (
              <Button
                disabled={isPending}
                onClick={() => setConfirmingClear(true)}
                type="button"
                variant="danger"
                wrap
              >
                <Trash2 className="size-4" />
                {uiText("clearAllocations")}
              </Button>
            ) : null}
          </div>
          <Button
            disabled={!form.canSubmit || isPending || confirmingClear}
            type="submit"
            variant="primary"
            wrap
          >
            {pendingAction === "save" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            {uiText("saveAllocations")}
          </Button>
        </div>
      </form>
    </DashboardDialog>
  );
}

function AmountSummary({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
  value: string;
}) {
  return (
    <div
      className="min-w-0 rounded-metric-card border border-border-subtle bg-surface-panel p-4"
      data-tone={tone}
    >
      <p className="text-xs font-semibold text-content-muted">{label}</p>
      <p
        className={
          tone === "success"
            ? "mt-1 break-words text-lg font-bold text-status-success [overflow-wrap:anywhere]"
            : tone === "warning"
              ? "mt-1 break-words text-lg font-bold text-status-warning [overflow-wrap:anywhere]"
              : "mt-1 break-words text-lg font-bold text-content-strong [overflow-wrap:anywhere]"
        }
      >
        {value}
      </p>
    </div>
  );
}

function InlineWarning({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-record-card border border-status-danger-border bg-status-danger-soft p-4 text-sm leading-6 text-status-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </p>
  );
}

function getDialogTitle(
  status: WholesaleSettlementRelease["status"],
  uiText: ReturnType<typeof useTranslations>,
) {
  if (status === "allocated") return uiText("adjustTitle");
  if (status === "partially_allocated") return uiText("continueTitle");
  return uiText("startTitle");
}
