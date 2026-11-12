import type { CommissionRuleConfig } from "@/lib/commission-settings";
import {
  formatCommissionSettingInput,
  getRuleConfigValue,
  type CommissionRuleDefinition,
  type CommissionRuleField,
} from "./commission-settings-display";

export type BusinessParameterDraft = Record<string, string>;

export function createBusinessParameterDraft(
  definition: CommissionRuleDefinition,
  config: CommissionRuleConfig,
) {
  return Object.fromEntries(definition.fields.map((field) => [
    field.configKey,
    formatCommissionSettingInput(field.kind, getRuleConfigValue(config, field.configKey)),
  ]));
}

export function previewBusinessParameterDraft(
  definition: CommissionRuleDefinition,
  draft: BusinessParameterDraft,
) {
  const config: CommissionRuleConfig = {};
  for (const field of definition.fields) {
    const value = parseField(field, draft[field.configKey] ?? "");
    if (value !== null) config[field.configKey] = value;
  }
  return config;
}

export function parseBusinessParameterDraft(
  definition: CommissionRuleDefinition,
  draft: BusinessParameterDraft,
):
  | { config: CommissionRuleConfig; ok: true }
  | { messageKey: "validation.amount" | "validation.count" | "validation.rate" | "validation.tierOrder"; ok: false } {
  const config = previewBusinessParameterDraft(definition, draft);
  const invalidField = definition.fields.find((field) => config[field.configKey] === undefined);
  if (invalidField) {
    const { kind } = invalidField;
    return { messageKey: kind === "rate" ? "validation.rate" : kind === "count" ? "validation.count" : "validation.amount", ok: false };
  }
  if (
    definition.code === "wholesale_referral_waybill_bonus" &&
    (config.tier_1_threshold >= config.tier_2_threshold || config.tier_2_threshold >= config.tier_3_threshold)
  ) {
    return { messageKey: "validation.tierOrder", ok: false };
  }
  return { config, ok: true };
}

function parseField(field: CommissionRuleField, rawValue: string) {
  const parsed = Number(rawValue.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (field.kind === "rate") {
    // 表单始终用百分数，数据库用比例。预览和发布都沿用相同换算，1 对应 0.01。
    const ratio = Math.round(parsed * 100) / 10000;
    return parsed >= 0.01 && parsed <= 100 ? ratio : null;
  }
  if (field.kind === "count") return Number.isInteger(parsed) ? parsed : null;
  return Math.round(parsed * 100) / 100;
}
