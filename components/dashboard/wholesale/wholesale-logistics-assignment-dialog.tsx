"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import * as FormControls from "@/components/ui/form-controls";

import { UserRoundCog } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { FeedbackNotice } from "@/components/dashboard/dashboard-shared-ui";
import {
  DashboardFilterField,
  DashboardSearchInput,
} from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import type {
  WholesaleLogisticsStoreAssignment,
  WholesaleLogisticsStoreOption,
} from "@/lib/wholesale-logistics-page";

import { getActiveSalesProfiles } from "./wholesale-logistics-display";
import { WholesaleLogisticsAssignmentHistory } from "./wholesale-logistics-assignment-history";

type AssignmentSaveInput = {
  assignmentId: string;
  customerId: string | null;
  effectiveFrom: string | null;
  salesUserId: string;
};

export function WholesaleLogisticsAssignmentDialog({
  assignments,
  customers,
  feedback,
  onAssign,
  onChange,
  onDismissFeedback,
  onEnd,
  onOpenChange,
  open,
  pendingKey,
  profiles,
  storeOptions,
}: {
  assignments: WholesaleLogisticsStoreAssignment[];
  customers: WholesaleCustomer[];
  feedback: { message: string; tone: "error" | "success" } | null;
  onAssign: (
    storeNames: string[],
    salesUserId: string,
    customerId: string | null,
  ) => Promise<boolean>;
  onChange: (input: AssignmentSaveInput) => Promise<boolean>;
  onDismissFeedback: () => void;
  onEnd: (assignmentId: string, effectiveTo: string) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingKey: string | null;
  profiles: WholesaleProfile[];
  storeOptions: WholesaleLogisticsStoreOption[];
}) {
  const t = useTranslations("WholesaleBusiness.logisticsArchive");
  const [editing, setEditing] =
    useState<WholesaleLogisticsStoreAssignment | null>(null);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [salesUserId, setSalesUserId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [splitFromDate, setSplitFromDate] = useState("");
  const [splitInterval, setSplitInterval] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const salesProfiles = getActiveSalesProfiles(profiles);

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setSelectedStores([]);
    setStoreSearch("");
    setSalesUserId("");
    setCustomerId("");
    setSplitFromDate("");
    setSplitInterval(false);
    // 弹窗打开时固定一个参考时间，渲染期间不再调用当前时间，保证列表判断稳定。
    setOpenedAt(Date.now());
  }, [open]);

  const currentlyAssignedStores = useMemo(() => {
    return new Set(
      assignments
        .filter((assignment) => {
          const from = assignment.effective_from
            ? new Date(assignment.effective_from).getTime()
            : Number.NEGATIVE_INFINITY;
          const to = assignment.effective_to
            ? new Date(assignment.effective_to).getTime()
            : Number.POSITIVE_INFINITY;
          return from <= openedAt && openedAt < to;
        })
        .map((assignment) => normalizeStoreName(assignment.store_name)),
    );
  }, [assignments, openedAt]);
  const selectableStores = storeOptions.filter((option) => {
    const normalized = normalizeStoreName(option.store_name);
    return (
      !currentlyAssignedStores.has(normalized) &&
      normalized.includes(normalizeStoreName(storeSearch))
    );
  });

  const startEditing = (assignment: WholesaleLogisticsStoreAssignment) => {
    setEditing(assignment);
    setSalesUserId(assignment.sales_user_id);
    setCustomerId(assignment.customer_id ?? "");
    setSplitFromDate("");
    setSplitInterval(false);
  };

  const save = async () => {
    if (!salesUserId) return;

    if (!editing) {
      if (selectedStores.length === 0) return;
      const succeeded = await onAssign(
        selectedStores,
        salesUserId,
        customerId || null,
      );
      if (succeeded) {
        setSelectedStores([]);
        setSalesUserId("");
        setCustomerId("");
      }
      return;
    }

    const effectiveFrom =
      splitInterval && splitFromDate
        ? new Date(`${splitFromDate}T00:00:00+08:00`).toISOString()
        : null;
    const succeeded = await onChange({
      assignmentId: editing.id,
      customerId: customerId || null,
      effectiveFrom,
      salesUserId,
    });
    if (succeeded) setEditing(null);
  };

  const saving = pendingKey === "assign" || pendingKey?.startsWith("change:");

  return (
    <DashboardDialog
      actions={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          {editing ? (
            <Button
              disabled={saving}
              onClick={() => setEditing(null)}
              type="button"
              variant="outline"
              size="compact"
              wrap
            >
              {t("assignments.back")}
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="default"
            disabled={
              saving ||
              !salesUserId ||
              (!editing && selectedStores.length === 0) ||
              (Boolean(editing) && splitInterval && !splitFromDate)
            }
            loading={Boolean(saving)}
            wrap
            onClick={() => void save()}
            type="button"
          >
            {saving ? t("assignments.saving") : t("assignments.save")}
          </Button>
        </div>
      }
      description={t("assignments.description")}
      onOpenChange={onOpenChange}
      open={open}
      title={t("assignments.title")}
    >
      <div className="space-y-6">
        {feedback ? (
          <FeedbackNotice tone={feedback.tone}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <span className="min-w-0 break-words">{feedback.message}</span>
              <DesignButton
                className="shrink-0 text-xs font-semibold underline underline-offset-2"
                onClick={onDismissFeedback}
                type="button"
              >
                {t("actions.dismiss")}
              </DesignButton>
            </div>
          </FeedbackNotice>
        ) : null}

        <section className="rounded-control-large border border-border-subtle bg-surface-interactive p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-2">
            <UserRoundCog className="size-5 shrink-0 text-primary" />
            <h4 className="break-words font-semibold text-content-strong">
              {editing
                ? t("assignments.adjustStore", { store: editing.store_name })
                : t("assignments.newAssignment")}
            </h4>
          </div>

          {!editing ? (
            <div className="mt-4 space-y-3">
              <DashboardFilterField label={t("assignments.chooseStores")}>
                <DashboardSearchInput
                  onChange={setStoreSearch}
                  placeholder={t("assignments.searchStores")}
                  value={storeSearch}
                />
              </DashboardFilterField>
              <div className="max-h-52 overflow-y-auto rounded-record-card border border-border-subtle bg-surface-inset p-2">
                {selectableStores.length === 0 ? (
                  <p className="p-3 text-sm leading-6 text-content-muted">
                    {t("assignments.noStores")}
                  </p>
                ) : (
                  selectableStores.map((option) => {
                    const checked = selectedStores.includes(option.store_name);
                    return (
                      <FormControls.ChoiceField
                        checked={checked}
                        key={option.store_name}
                        label={
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="min-w-0 flex-1 break-words">
                              {option.store_name}
                            </span>
                            <span className="shrink-0 text-xs text-content-muted">
                              {t("assignments.orderCount", {
                                count: option.order_count,
                              })}
                            </span>
                          </span>
                        }
                        onChange={() =>
                          setSelectedStores((current) =>
                            checked
                              ? current.filter(
                                  (name) => name !== option.store_name,
                                )
                              : [...current, option.store_name],
                          )
                        }
                      />
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <DashboardFilterField label={t("assignments.sales")}>
              <Select
                aria-label={t("assignments.sales")}
                onValueChange={setSalesUserId}
                options={[
                  { label: t("assignments.chooseSales"), value: "" },
                  ...salesProfiles.map((profile) => ({
                    label:
                      profile.name ||
                      profile.email ||
                      t("fallbacks.unnamedSales"),
                    value: profile.user_id,
                  })),
                ]}
                value={salesUserId}
              />
            </DashboardFilterField>
            <DashboardFilterField label={t("assignments.customer")}>
              <Select
                aria-label={t("assignments.customer")}
                onValueChange={setCustomerId}
                options={[
                  { label: t("assignments.noCustomer"), value: "" },
                  ...customers.map((customer) => ({
                    label: customer.unique_name,
                    value: customer.id,
                  })),
                ]}
                value={customerId}
              />
            </DashboardFilterField>
          </div>

          {editing ? (
            <div className="mt-4 rounded-record-card border border-border-subtle bg-surface-inset p-3 sm:p-4">
              <FormControls.ChoiceField
                checked={!splitInterval}
                label={
                  <span className="min-w-0 break-words">
                    {t("assignments.wholeInterval")}
                  </span>
                }
                name="assignment-interval"
                onChange={() => setSplitInterval(false)}
                type="radio"
              />
              <FormControls.ChoiceField
                checked={splitInterval}
                label={
                  <span className="min-w-0 flex-1 break-words">
                    {t("assignments.fromDate")}
                    {splitInterval ? (
                      <DatePicker
                        aria-label={t("assignments.fromDate")}
                        className="mt-2"
                        onValueChange={setSplitFromDate}
                        value={splitFromDate}
                      />
                    ) : null}
                  </span>
                }
                name="assignment-interval"
                onChange={() => setSplitInterval(true)}
                rootClassName="mt-3"
                type="radio"
              />
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-content-muted">
              {t("assignments.historyDefault")}
            </p>
          )}
        </section>

        {!editing ? (
          <WholesaleLogisticsAssignmentHistory
            assignments={assignments}
            customers={customers}
            onEdit={startEditing}
            onEnd={onEnd}
            pendingKey={pendingKey}
            profiles={profiles}
          />
        ) : null}
      </div>
    </DashboardDialog>
  );
}

function normalizeStoreName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
