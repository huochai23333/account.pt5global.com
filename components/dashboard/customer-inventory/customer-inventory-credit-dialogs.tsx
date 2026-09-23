"use client";

import type { CustomerInventoryCreditApplication } from "@/lib/customer-inventory-types";

import { CustomerInventoryCreditApplicationDialog } from "./customer-inventory-credit-application-dialog";
import type { InventoryCreditDialogState } from "./customer-inventory-credit-dialog-types";
import { CustomerInventoryCreditLifecycleDialog } from "./customer-inventory-credit-lifecycle-dialogs";
import { CustomerInventoryCreditManageDialog } from "./customer-inventory-credit-manage-dialog";
import { CustomerInventoryCreditReviewDialog } from "./customer-inventory-credit-review-dialog";
import type { RunInventoryAction } from "./use-customer-inventory-actions";

export type { InventoryCreditDialogState } from "./customer-inventory-credit-dialog-types";

/**
 * 信贷弹窗入口只负责按业务动作调度独立弹窗。
 * 客户申请、后台审核、直接启用和延期还款分别维护自己的表单状态，
 * 避免一个文件同时承担所有信贷生命周期职责。
 */
export function CustomerInventoryCreditDialogs({
  credits,
  currentBusinessDate,
  dialog,
  onClose,
  pendingKey,
  runAction,
  usdToCurrencyRates,
}: {
  credits: CustomerInventoryCreditApplication[];
  currentBusinessDate: string;
  dialog: InventoryCreditDialogState;
  onClose: () => void;
  pendingKey: string | null;
  runAction: RunInventoryAction;
  usdToCurrencyRates: Record<string, number | null>;
}) {
  if (!dialog) return null;

  if (dialog.kind === "apply") {
    return (
      <CustomerInventoryCreditApplicationDialog
        credits={credits}
        onClose={onClose}
        order={dialog.order}
        pendingKey={pendingKey}
        runAction={runAction}
        usdToCurrencyRates={usdToCurrencyRates}
      />
    );
  }

  if (dialog.kind === "review") {
    return (
      <CustomerInventoryCreditReviewDialog
        credits={dialog.credits}
        onClose={onClose}
        order={dialog.order}
        pendingKey={pendingKey}
        runAction={runAction}
        usdToCurrencyRates={usdToCurrencyRates}
      />
    );
  }

  if (dialog.kind === "manage") {
    return (
      <CustomerInventoryCreditManageDialog
        credits={dialog.credits}
        onClose={onClose}
        order={dialog.order}
        pendingKey={pendingKey}
        runAction={runAction}
        usdToCurrencyRates={usdToCurrencyRates}
      />
    );
  }

  return (
    <CustomerInventoryCreditLifecycleDialog
      currentBusinessDate={currentBusinessDate}
      dialog={dialog}
      onClose={onClose}
      pendingKey={pendingKey}
      runAction={runAction}
    />
  );
}
