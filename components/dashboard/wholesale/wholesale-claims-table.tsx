"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import * as FormControls from "@/components/ui/form-controls";

import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import {
  formatCurrency,
  formatDateTime,
  formatNumber,
} from "./wholesale-display";
import type { WholesaleClaimRow } from "@/lib/wholesale-claims-page";
import {
  WholesaleTable,
  WholesaleTd,
  WholesaleTh,
  wholesaleStickyFirstTdClassName,
  wholesaleStickyFirstThClassName,
} from "./wholesale-ui";

const stickyOrderThClassName = `${wholesaleStickyFirstThClassName} min-w-[220px] whitespace-nowrap`;
const stickyOrderTdClassName = `${wholesaleStickyFirstTdClassName} min-w-[220px] whitespace-nowrap`;
const selectionThClassName =
  "sticky left-0 z-40 w-[56px] min-w-[56px] border-r border-border-subtle bg-surface-inset text-center";
const selectionTdClassName =
  "sticky left-0 z-30 w-[56px] min-w-[56px] border-r border-border-subtle bg-surface-interactive text-center group-hover:bg-surface-inset";

export type WholesaleClaimsTableSelection = {
  allSelected: boolean;
  hasPartialSelection: boolean;
  onToggleAll: () => void;
  onToggleOne: (purchaseOrderId: string) => void;
  selectedIds: Set<string>;
};

/** 待分类和认领大厅共用采购订单表；已认领数据由独立的认领组表展示。 */
export function WholesaleClaimsTable({
  canAdmin,
  canEdit,
  onDelete,
  onOpenClaim,
  pendingKey,
  rows,
  selection,
}: {
  canAdmin: boolean;
  canEdit: boolean;
  onDelete: (purchaseOrderId: string) => void;
  onOpenClaim: (row: WholesaleClaimRow) => void;
  pendingKey: string | null;
  rows: WholesaleClaimRow[];
  selection?: WholesaleClaimsTableSelection;
}) {
  return (
    <WholesaleTable minWidth={selection ? 1590 : 1534}>
      <thead>
        <tr>
          {selection ? (
            <WholesaleTh className={selectionThClassName}>
              <SelectionHeaderCheckbox selection={selection} />
            </WholesaleTh>
          ) : null}
          <WholesaleTh
            className={
              selection
                ? `${stickyOrderThClassName} left-[56px]`
                : stickyOrderThClassName
            }
          >
            <Header name="text001" />
          </WholesaleTh>
          <WholesaleTh>
            <Header name="text002" />
          </WholesaleTh>
          <WholesaleTh>
            <Header name="text003" />
          </WholesaleTh>
          <WholesaleTh className="min-w-[260px] whitespace-normal">
            <Header name="text007" />
          </WholesaleTh>
          <WholesaleTh>
            <Header name="text008" />
          </WholesaleTh>
          <WholesaleTh>
            <Header name="text009" />
          </WholesaleTh>
          <WholesaleTh>
            <Header name="text010" />
          </WholesaleTh>
          <WholesaleTh>
            <Header name="text012" />
          </WholesaleTh>
          <WholesaleTh>
            <Header name="text013" />
          </WholesaleTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <WholesaleClaimTableRow
            canAdmin={canAdmin}
            canEdit={canEdit}
            key={row.purchaseOrder.id}
            onDelete={onDelete}
            onOpenClaim={onOpenClaim}
            pendingKey={pendingKey}
            row={row}
            selection={selection}
          />
        ))}
      </tbody>
    </WholesaleTable>
  );
}

function WholesaleClaimTableRow({
  canAdmin,
  canEdit,
  onDelete,
  onOpenClaim,
  pendingKey,
  row,
  selection,
}: {
  canAdmin: boolean;
  canEdit: boolean;
  onDelete: (purchaseOrderId: string) => void;
  onOpenClaim: (row: WholesaleClaimRow) => void;
  pendingKey: string | null;
  row: WholesaleClaimRow;
  selection?: WholesaleClaimsTableSelection;
}) {
  const { purchaseOrder } = row;
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_claims_table",
  );

  return (
    <tr className="group">
      {selection ? (
        <WholesaleTd className={selectionTdClassName}>
          <FormControls.Checkbox
            aria-label={uiText("selectOrder", {
              orderNumber: purchaseOrder.external_order_number,
            })}
            checked={selection.selectedIds.has(purchaseOrder.id)}
            className="size-4 cursor-pointer accent-primary"
            onChange={() => selection.onToggleOne(purchaseOrder.id)}
          />
        </WholesaleTd>
      ) : null}
      <WholesaleTd
        className={
          selection
            ? `${stickyOrderTdClassName} left-[56px]`
            : stickyOrderTdClassName
        }
      >
        <div className="font-semibold whitespace-nowrap">
          {purchaseOrder.external_order_number}
        </div>
        <div className="mt-2">
          {canEdit ? (
            <Button
              variant="primary"
              size="compact"
              disabled={pendingKey === "1688:create-claim-group"}
              onClick={() => onOpenClaim(row)}
              type="button"
            >
              {uiText("text017")}
            </Button>
          ) : (
            <StatusBadge tone="warning">
              {uiText(row.board === "assisted" ? "text019" : "text016")}
            </StatusBadge>
          )}
        </div>
        <div className="mt-2 text-xs leading-5 text-content-muted">
          {purchaseOrder.order_status ?? uiText("missingStatus")}
        </div>
      </WholesaleTd>
      <WholesaleTd className="min-w-[150px] whitespace-normal">
        {row.recipientName}
      </WholesaleTd>
      <WholesaleTd className="min-w-[180px] whitespace-normal">
        {purchaseOrder.assisted_customer_id ? (
          <div>
            <div className="font-semibold text-content-strong">
              {row.assistedCustomerName}
            </div>
            <div className="mt-1 text-xs leading-5 text-content-muted">
              {uiText("text014")}
            </div>
          </div>
        ) : (
          uiText("notMatched")
        )}
      </WholesaleTd>
      <WholesaleTd className="min-w-[260px] whitespace-normal">
        <div>{purchaseOrder.item_summary ?? uiText("missingItem")}</div>
        {purchaseOrder.seller_name ? (
          <div className="mt-1 text-xs text-content-muted">
            {uiText("text015")}
            {purchaseOrder.seller_name}
          </div>
        ) : null}
      </WholesaleTd>
      <WholesaleTd>{formatNumber(purchaseOrder.quantity)}</WholesaleTd>
      <WholesaleTd>{formatCurrency(purchaseOrder.purchase_amount)}</WholesaleTd>
      <WholesaleTd>{formatDateTime(purchaseOrder.purchased_at)}</WholesaleTd>
      <WholesaleTd>{formatDateTime(purchaseOrder.created_at)}</WholesaleTd>
      <WholesaleTd>
        {canAdmin ? (
          <Button
            variant="danger"
            size="compact"
            disabled={pendingKey?.startsWith("1688:delete:")}
            loading={pendingKey === `1688:delete:${purchaseOrder.id}`}
            onClick={() => onDelete(purchaseOrder.id)}
            type="button"
          >
            <Trash2 className="size-3.5" />
            {uiText("text022")}
          </Button>
        ) : null}
      </WholesaleTd>
    </tr>
  );
}

function SelectionHeaderCheckbox({
  selection,
}: {
  selection: WholesaleClaimsTableSelection;
}) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_claims_table",
  );
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = selection.hasPartialSelection;
    }
  }, [selection.hasPartialSelection]);

  return (
    <FormControls.Checkbox
      aria-label={uiText("selectAll")}
      checked={selection.allSelected}
      className="size-4 cursor-pointer accent-primary"
      onChange={selection.onToggleAll}
      ref={checkboxRef}
    />
  );
}

function Header({ name }: { name: string }) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_claims_table",
  );
  return <>{uiText(name)}</>;
}
