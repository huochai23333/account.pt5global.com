"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import type { FeedbackTone } from "../dashboard-shared-ui";
import { updateServiceFeeType, type ServiceFeeTypeOption } from "@/lib/service-fee-types";
import { getServiceFeeRowsByScope, sortServiceFeeRows } from "./admin-orders-service-fee-display";
import { formatRatioForInput, parseServiceFeeInput, toServiceFeeErrorMessage } from "./admin-orders-service-fee-settings-utils";

type PageFeedback = { tone: FeedbackTone; message: string } | null;

// 费率编辑与保存留在 Hook。展示组件只接收当前费率、草稿及操作回调。
export function useAdminOrderServiceFeeSettings({
  initialRows,
  onRowsChange,
}: {
  initialRows: ServiceFeeTypeOption[];
  onRowsChange?: (rows: ServiceFeeTypeOption[]) => void;
}) {
  const supabase = getBrowserSupabaseClient();
  const t = useTranslations("Orders");
  const [rows, setRows] = useState<ServiceFeeTypeOption[]>(() =>
    sortServiceFeeRows(initialRows),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PageFeedback>(null);

  const retailRows = useMemo(
    () => getServiceFeeRowsByScope(rows, "retail"),
    [rows],
  );

  async function handleSave(row: ServiceFeeTypeOption) {
    if (!supabase || pendingAction !== null) {
      return;
    }

    const parsed = parseServiceFeeInput(editValue);

    if (!parsed.ok) {
      setFeedback({ tone: "error", message: t(parsed.messageKey) });
      return;
    }

    setPendingAction(`edit:${row.id}`);
    setFeedback(null);

    try {
      const updated = await updateServiceFeeType(
        supabase,
        row.id,
        parsed.value,
      );
      const nextRows = sortServiceFeeRows(
        rows.map((item) => (item.id === updated.id ? updated : item)),
      );
      setRows(nextRows);
      onRowsChange?.(nextRows);
      setEditingId(null);
      setEditValue("");
      setFeedback({
        tone: "success",
        message: t("settings.serviceFees.updateSuccess"),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: toServiceFeeErrorMessage(error, t),
      });
    } finally {
      setPendingAction(null);
    }
  }

  function startEditing(row: ServiceFeeTypeOption) {
    setEditingId(row.id);
    setEditValue(formatRatioForInput(row.fee_ratio));
    setFeedback(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditValue("");
  }

  return {
    retailRows,
    editValue,
    editingId,
    pendingAction,
    feedback,
    handleSave,
    startEditing,
    cancelEditing,
    setEditValue,
  };
}
