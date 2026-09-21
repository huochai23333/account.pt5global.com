"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";
import type { FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";
import {
  cancelScheduledBusinessParameterVersion,
  listBusinessParameterSettings,
  publishBusinessParameterVersion,
  verifyPublishedBusinessParameterVersion,
  type BusinessParameterSetting,
  type BusinessParameterVersion,
  type CommissionRuleConfig,
} from "@/lib/commission-settings";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import {
  COMMISSION_RULE_DEFINITIONS,
  formatCommissionSettingInput,
  getRuleConfigValue,
  type CommissionRuleDefinition,
  type CommissionRuleField,
} from "./commission-settings-display";

export type BusinessParameterDraft = Record<string, string>;
export type EffectiveMode = "immediate" | "scheduled";
export type SettingsFeedback = { message: string; tone: FeedbackTone } | null;

export type BusinessParameterEditor = {
  definition: CommissionRuleDefinition;
  draft: BusinessParameterDraft;
  effectiveLocal: string;
  effectiveMode: EffectiveMode;
  reason: string;
  requestId: string;
  setting: BusinessParameterSetting;
  sourceVersion: BusinessParameterVersion | null;
};

export function useBusinessParameterSettingsViewModel({
  onRowsChange,
  rows,
}: {
  onRowsChange?: (rows: BusinessParameterSetting[]) => void;
  rows: BusinessParameterSetting[];
}) {
  const supabase = getBrowserSupabaseClient();
  const confirm = useDashboardConfirm();
  const t = useTranslations("Commission.settings");
  const ruleText = useTranslations("Commission");
  const [settings, setSettings] = useState(rows);
  const [editor, setEditor] = useState<BusinessParameterEditor | null>(null);
  const [historySetting, setHistorySetting] =
    useState<BusinessParameterSetting | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SettingsFeedback>(null);

  useEffect(() => {
    if (!editor && !pendingKey) setSettings(rows);
  }, [editor, pendingKey, rows]);

  const definitionsByCode = useMemo(
    () => new Map(COMMISSION_RULE_DEFINITIONS.map((item) => [item.code, item])),
    [],
  );

  function openEditor(
    setting: BusinessParameterSetting,
    sourceVersion: BusinessParameterVersion | null = null,
  ) {
    const definition = definitionsByCode.get(setting.parameterCode);
    if (!definition) return;
    const sourceConfig = sourceVersion?.config ?? setting.currentVersion.config;
    const monthlyOnly =
      setting.parameterCode === "wholesale_referral_waybill_bonus";

    setEditor({
      definition,
      draft: createDraft(definition, sourceConfig),
      effectiveLocal: monthlyOnly ? getNextShanghaiMonthStartLocal() : "",
      effectiveMode: monthlyOnly ? "scheduled" : "immediate",
      reason: sourceVersion
        ? t("restore.defaultReason", { version: sourceVersion.versionNumber })
        : "",
      requestId: crypto.randomUUID(),
      setting,
      sourceVersion,
    });
    setFeedback(null);
  }

  function updateEditor(patch: Partial<BusinessParameterEditor>) {
    setEditor((current) => (current ? { ...current, ...patch } : null));
  }

  async function publish() {
    if (!editor || !supabase || pendingKey) return;
    const parsed = parseDraft(editor.definition, editor.draft);
    if (!parsed.ok) {
      setFeedback({ message: t(parsed.messageKey), tone: "error" });
      return;
    }
    if (editor.reason.trim().length < 2) {
      setFeedback({ message: t("validation.reason"), tone: "error" });
      return;
    }

    const effectiveFrom =
      editor.effectiveMode === "scheduled"
        ? shanghaiLocalInputToIso(editor.effectiveLocal)
        : null;
    if (editor.effectiveMode === "scheduled" && !effectiveFrom) {
      setFeedback({ message: t("validation.effectiveTime"), tone: "error" });
      return;
    }

    const accepted = await confirm({
      confirmLabel: t("actions.confirmPublish"),
      description: t("publish.confirmDescription", {
        name: ruleText(editor.definition.labelKey),
        timing:
          editor.effectiveMode === "immediate"
            ? t("effective.immediate")
            : formatDateTime(effectiveFrom),
      }),
      title: t("publish.confirmTitle"),
      tone: "warning",
    });
    if (!accepted) return;

    setPendingKey(`publish:${editor.setting.parameterCode}`);
    setFeedback(null);
    try {
      const receipt = await publishBusinessParameterVersion(supabase, {
        changeReason: editor.reason.trim(),
        config: parsed.config,
        effectiveFrom,
        expectedRevision: editor.setting.currentRevision,
        parameterCode: editor.setting.parameterCode,
        requestId: editor.requestId,
      });
      await verifyPublishedBusinessParameterVersion(supabase, receipt);
      const refreshed = await listBusinessParameterSettings(supabase);
      const refreshedSetting = refreshed.find(
        (item) => item.parameterCode === receipt.parameterCode,
      );
      const refreshedVersion = refreshedSetting?.history.find(
        (item) => item.versionId === receipt.versionId,
      );
      if (
        !refreshedSetting ||
        !refreshedVersion ||
        refreshedVersion.versionNumber !== receipt.versionNumber ||
        refreshedVersion.effectiveFrom !== receipt.effectiveFrom
      ) {
        throw new Error("business_parameter_final_list_mismatch");
      }

      setSettings(refreshed);
      onRowsChange?.(refreshed);
      setEditor(null);
      setFeedback({
        message: t("feedback.publishSuccess", {
          id: receipt.versionId,
          version: receipt.versionNumber,
        }),
        tone: "success",
      });
    } catch (error) {
      setFeedback({ message: toSettingsErrorMessage(error, t), tone: "error" });
    } finally {
      setPendingKey(null);
    }
  }

  async function cancelSchedule(setting: BusinessParameterSetting) {
    if (!setting.scheduledVersion || !supabase || pendingKey) return;
    const accepted = await confirm({
      confirmLabel: t("actions.confirmCancelSchedule"),
      description: t("cancelSchedule.confirmDescription", {
        version: setting.scheduledVersion.versionNumber,
      }),
      title: t("cancelSchedule.confirmTitle"),
      tone: "warning",
    });
    if (!accepted) return;

    setPendingKey(`cancel:${setting.parameterCode}`);
    setFeedback(null);
    try {
      const receipt = await cancelScheduledBusinessParameterVersion(supabase, {
        expectedRevision: setting.currentRevision,
        versionId: setting.scheduledVersion.versionId,
      });
      const refreshed = await listBusinessParameterSettings(supabase);
      const cancelled = refreshed
        .find((item) => item.parameterCode === setting.parameterCode)
        ?.history.find((item) => item.versionId === receipt.version_id);
      if (!cancelled || cancelled.status !== "cancelled") {
        throw new Error("business_parameter_cancel_readback_mismatch");
      }
      setSettings(refreshed);
      onRowsChange?.(refreshed);
      setFeedback({ message: t("feedback.cancelSuccess"), tone: "success" });
    } catch (error) {
      setFeedback({ message: toSettingsErrorMessage(error, t), tone: "error" });
    } finally {
      setPendingKey(null);
    }
  }

  return {
    cancelSchedule,
    closeEditor: () => setEditor(null),
    closeHistory: () => setHistorySetting(null),
    editor,
    feedback,
    historySetting,
    openEditor,
    openHistory: setHistorySetting,
    pendingKey,
    publish,
    settings,
    updateEditor,
  };
}

function createDraft(
  definition: CommissionRuleDefinition,
  config: CommissionRuleConfig,
) {
  return definition.fields.reduce<BusinessParameterDraft>((result, field) => {
    result[field.configKey] = formatCommissionSettingInput(
      field.kind,
      getRuleConfigValue(config, field.configKey),
    );
    return result;
  }, {});
}

function parseDraft(
  definition: CommissionRuleDefinition,
  draft: BusinessParameterDraft,
):
  | { config: CommissionRuleConfig; ok: true }
  | {
      messageKey:
        | "validation.amount"
        | "validation.count"
        | "validation.rate"
        | "validation.tierOrder";
      ok: false;
    } {
  const config: CommissionRuleConfig = {};
  for (const field of definition.fields) {
    const value = parseFieldValue(field, draft[field.configKey] ?? "");
    if (value === null) {
      return {
        messageKey:
          field.kind === "rate"
            ? "validation.rate"
            : field.kind === "count"
              ? "validation.count"
              : "validation.amount",
        ok: false,
      };
    }
    config[field.configKey] = value;
  }

  if (definition.code === "wholesale_referral_waybill_bonus") {
    if (
      config.tier_1_threshold >= config.tier_2_threshold ||
      config.tier_2_threshold >= config.tier_3_threshold
    )
      return { messageKey: "validation.tierOrder", ok: false };
  }
  return { config, ok: true };
}

function parseFieldValue(field: CommissionRuleField, rawValue: string) {
  const parsed = Number(rawValue.trim());
  if (!Number.isFinite(parsed)) return null;
  if (field.kind === "rate") {
    const ratio = parsed > 1 ? parsed / 100 : parsed;
    return ratio > 0 && ratio <= 1 ? Math.round(ratio * 10000) / 10000 : null;
  }
  if (field.kind === "count") {
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

function getNextShanghaiMonthStartLocal() {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01T00:00`;
}

function shanghaiLocalInputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

function toSettingsErrorMessage(error: unknown, t: (key: string) => string) {
  const message = String(
    (error as { message?: string })?.message ?? "",
  ).toLowerCase();
  if (message.includes("permission") || message.includes("42501"))
    return t("errors.permission");
  if (message.includes("revision_conflict")) return t("errors.conflict");
  if (message.includes("schedule_exists")) return t("errors.scheduleExists");
  if (message.includes("monthly_next_month_only"))
    return t("errors.monthlyTiming");
  if (message.includes("requesttimeout") || message.includes("超时"))
    return t("errors.timeout");
  if (
    message.includes("readback") ||
    message.includes("receipt") ||
    message.includes("mismatch")
  ) {
    return t("errors.finalCheck");
  }
  return t("errors.unknown");
}
