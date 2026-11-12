"use client";

import * as FormControls from "@/components/ui/form-controls";

import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { CustomerInventoryOrderItem } from "@/lib/customer-inventory-types";

export type EditableInventoryOrderItem = Pick<
  CustomerInventoryOrderItem,
  "product_name" | "quantity" | "source_url"
>;

type EditorRow = EditableInventoryOrderItem & { clientId: string };

const EMPTY_ITEM: EditableInventoryOrderItem = {
  product_name: "",
  quantity: 1,
  source_url: null,
};

/**
 * 动态商品编辑器只负责商品行的增删和字段状态。
 * 订单弹窗通过隐藏的 JSON 字段一次提交整组商品，数据库再做最终校验，
 * 因此不会出现订单保存成功但商品只保存了一半的情况。
 */
export function CustomerInventoryOrderItemEditor({
  initialItems,
}: {
  initialItems: EditableInventoryOrderItem[];
}) {
  const t = useTranslations("CustomerInventory");
  const nextId = useRef(1);
  const [rows, setRows] = useState<EditorRow[]>(() => {
    const source = initialItems.length > 0 ? initialItems : [EMPTY_ITEM];
    return source.map((item, index) => ({
      ...item,
      clientId: `initial-${index}`,
    }));
  });
  const serializedItems = rows.map(({ product_name, quantity, source_url }) => ({
    product_name: product_name.trim(),
    quantity,
    source_url: source_url?.trim() || null,
  }));

  function updateRow(clientId: string, changes: Partial<EditableInventoryOrderItem>) {
    setRows((current) =>
      current.map((row) => (row.clientId === clientId ? { ...row, ...changes } : row)),
    );
  }

  return (
    <fieldset className="grid min-w-0 gap-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <legend className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">
            {t("items.title")}
          </legend>
          <p className="mt-1 text-xs leading-5 text-content-muted">{t("items.editorHint")}</p>
        </div>
        <Button
          disabled={rows.length >= 100}
          onClick={() => {
            const id = nextId.current++;
            setRows((current) => [...current, { ...EMPTY_ITEM, clientId: `new-${id}` }]);
          }}
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t("items.add")}
        </Button>
      </div>

      <FormControls.Input name="items" type="hidden" value={JSON.stringify(serializedItems)} />

      <div className="grid min-w-0 gap-3">
        {rows.map((row, index) => (
          <div
            className="grid min-w-0 gap-4 rounded-record-card border border-border-subtle bg-surface-inset p-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.45fr)_minmax(0,1.5fr)_auto]"
            data-testid="inventory-product-row"
            key={row.clientId}
          >
            <FormControls.Field label={t("items.productNameLabel", { number: index + 1 })} required>
              <FormControls.Input
                maxLength={500}
                onChange={(event) =>
                  updateRow(row.clientId, {
                    product_name: event.currentTarget.value,
                  })
                }
                required
                value={row.product_name}
              />
            </FormControls.Field>
            <FormControls.Field label={t("items.quantity")} required>
              <FormControls.Input
                inputMode="numeric"
                max={2_147_483_647}
                min={1}
                onChange={(event) =>
                  updateRow(row.clientId, {
                    quantity: Number(event.currentTarget.value),
                  })
                }
                required
                step={1}
                type="number"
                value={Number.isFinite(row.quantity) ? row.quantity : ""}
              />
            </FormControls.Field>
            <FormControls.Field hint={t("items.linkHint")} label={t("items.sourceUrl")}>
              <FormControls.Input
                maxLength={2048}
                onChange={(event) =>
                  updateRow(row.clientId, {
                    source_url: event.currentTarget.value,
                  })
                }
                placeholder={t("placeholders.sourceUrl")}
                type="url"
                value={row.source_url ?? ""}
              />
            </FormControls.Field>
            <div className="flex items-end sm:pb-0.5">
              <Button
                aria-label={t("items.removeLabel", { number: index + 1 })}
                disabled={rows.length === 1}
                onClick={() =>
                  setRows((current) => current.filter((item) => item.clientId !== row.clientId))
                }
                type="button"
                variant="danger"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                <span className="sm:sr-only">{t("items.remove")}</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
