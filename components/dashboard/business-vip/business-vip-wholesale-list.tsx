/** 批发订单与费用：组合或展示本模块已准备的数据；交互回调沿上层状态与服务处理，不在展示中重新实现业务规则。 */
"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import { BadgePlus, Clock3, FileClock, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardTableFrame } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { RecordCard } from "@/components/ui/data-display";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import type { BusinessVipMembershipAction, BusinessVipRow } from "@/lib/business-vip-management";
import type { Locale } from "@/lib/locale";

import { BusinessVipCustomerCell, BusinessVipStatusBlock } from "./business-vip-row-shared";

type WholesaleVipCustomerListProps = {
  canManage: boolean;
  locale: Locale;
  onOpenAction: (row: BusinessVipRow, action: BusinessVipMembershipAction) => void;
  onOpenRecords: (row: BusinessVipRow) => void;
  pendingActionKey: string | null;
  rows: BusinessVipRow[];
};

export function BusinessVipWholesaleCustomerList({
  canManage,
  locale,
  onOpenAction,
  onOpenRecords,
  pendingActionKey,
  rows,
}: WholesaleVipCustomerListProps) {
  const t = useTranslations("BusinessVip");

  return (
    <ResponsiveDataView
      breakpoint="lg"
      desktop={
        <DashboardTableFrame innerClassName="overflow-x-visible">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[44%]" />
              <col className="w-[32%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead className="bg-surface-inset text-xs font-semibold text-content-muted">
              <tr>
                <th className="px-4 py-3">{t("directory.columns.customer")}</th>
                <th className="px-4 py-3">{t("directory.columns.status")}</th>
                <th className="px-4 py-3 text-right">{t("directory.columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <tr className="align-top" key={row.targetId}>
                  <td className="px-4 py-4">
                    <WholesaleVipCustomerRecordButton onOpenRecords={onOpenRecords} row={row} />
                  </td>
                  <td className="px-4 py-4">
                    <BusinessVipStatusBlock locale={locale} row={row} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end">
                      <WholesaleVipActionButton
                        canManage={canManage}
                        onOpenAction={onOpenAction}
                        pendingActionKey={pendingActionKey}
                        row={row}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardTableFrame>
      }
      mobile={
        <>
          {rows.map((row) => (
            <RecordCard key={row.targetId}>
              <div className="flex flex-col gap-3">
                <WholesaleVipCustomerRecordButton onOpenRecords={onOpenRecords} row={row} />
              </div>
              <div className="mt-4">
                <BusinessVipStatusBlock locale={locale} row={row} />
              </div>
              <div className="mt-4">
                <WholesaleVipActionButton
                  canManage={canManage}
                  onOpenAction={onOpenAction}
                  pendingActionKey={pendingActionKey}
                  row={row}
                />
              </div>
            </RecordCard>
          ))}
        </>
      }
    />
  );
}

function WholesaleVipCustomerRecordButton({
  onOpenRecords,
  row,
}: {
  onOpenRecords: (row: BusinessVipRow) => void;
  row: BusinessVipRow;
}) {
  const t = useTranslations("BusinessVip");

  return (
    <DesignButton
      aria-label={t("actions.viewCustomerRecords", {
        name: row.customerLabel,
      })}
      className="group block w-full min-w-0 rounded-control-default p-2 text-left transition-colors hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
      onClick={() => onOpenRecords(row)}
      type="button"
    >
      <BusinessVipCustomerCell row={row} />
      <span className="mt-2 inline-flex min-h-7 items-center gap-1.5 rounded-full bg-status-info-soft px-2.5 text-xs font-semibold text-primary transition-colors group-hover:bg-surface-inset">
        <FileClock className="size-3.5" />
        {t("actions.viewRecords")}
      </span>
    </DesignButton>
  );
}

function WholesaleVipActionButton({
  canManage,
  onOpenAction,
  pendingActionKey,
  row,
}: {
  canManage: boolean;
  onOpenAction: (row: BusinessVipRow, action: BusinessVipMembershipAction) => void;
  pendingActionKey: string | null;
  row: BusinessVipRow;
}) {
  const t = useTranslations("BusinessVip");
  const action = getWholesaleVipAction(row);
  const actionKey = `wholesale:${action}:${row.targetId}`;
  const pending = pendingActionKey === actionKey;

  return (
    <Button
      variant="primary"
      size="compact"
      className="w-full sm:w-auto"
      disabled={!canManage || Boolean(pendingActionKey)}
      onClick={() => onOpenAction(row, action)}
      type="button"
    >
      {pending ? (
        <Clock3 className="size-4" />
      ) : action === "open" ? (
        <BadgePlus className="size-4" />
      ) : (
        <RotateCw className="size-4" />
      )}
      {action === "open" ? t("actions.open") : t("actions.directRenew")}
    </Button>
  );
}

function getWholesaleVipAction(row: BusinessVipRow): BusinessVipMembershipAction {
  return row.status === "active" || row.status === "expired" ? "renew" : "open";
}
