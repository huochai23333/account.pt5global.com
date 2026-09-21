import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";

const BUSINESS_PARAMETER_VERSION_SELECT =
  "id,parameter_code,version_number,config,effective_from,published_at,published_by,change_reason,cancelled_at,cancelled_by";

export const COMMISSION_RULE_CODES = [
  "service_escort_salesman",
  "digital_survival_salesman",
  "service_referral_rate",
  "vip_first_year_referral_bonus",
  "wholesale_order_salesman_tier",
  "wholesale_referral_order_amount_rate",
  "wholesale_referral_waybill_bonus",
] as const;

export type CommissionRuleCode = (typeof COMMISSION_RULE_CODES)[number];

export type CommissionRuleConfig = Record<string, number>;

export type CommissionRuleSetting = {
  config: CommissionRuleConfig;
  ruleCode: CommissionRuleCode;
  sortOrder: number;
  updatedAt: string | null;
};

export type BusinessParameterVersionStatus =
  "cancelled" | "current" | "history" | "scheduled";

export type BusinessParameterVersion = {
  cancelledAt: string | null;
  cancelledBy: string | null;
  changeReason: string;
  config: CommissionRuleConfig;
  effectiveFrom: string;
  parameterCode: CommissionRuleCode;
  publishedAt: string;
  publishedBy: string | null;
  publisherEmail: string | null;
  publisherName: string | null;
  status: BusinessParameterVersionStatus;
  versionId: string;
  versionNumber: number;
};

export type BusinessParameterSetting = {
  currentRevision: number;
  currentVersion: BusinessParameterVersion;
  history: BusinessParameterVersion[];
  parameterCode: CommissionRuleCode;
  scheduledVersion: BusinessParameterVersion | null;
  sortOrder: number;
};

export type BusinessParameterPublishReceipt = {
  changeReason: string;
  config: CommissionRuleConfig;
  currentRevision: number;
  effectiveFrom: string;
  parameterCode: CommissionRuleCode;
  publishedAt: string;
  publishedBy: string;
  versionId: string;
  versionNumber: number;
};

type ActiveBusinessParameterRecord = {
  config: unknown;
  effective_from: string | null;
  parameter_code: string | null;
  version_id: string | null;
  version_number: number | string | null;
};

type BusinessParameterListRecord = {
  business_key: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  change_reason: string | null;
  config: unknown;
  current_revision: number | string | null;
  effective_from: string | null;
  parameter_code: string | null;
  published_at: string | null;
  published_by: string | null;
  publisher_email: string | null;
  publisher_name: string | null;
  sort_order: number | string | null;
  version_id: string | null;
  version_number: number | string | null;
  version_status: string | null;
};

type BusinessParameterPublishRecord = {
  change_reason: string | null;
  config: unknown;
  current_revision: number | string | null;
  effective_from: string | null;
  parameter_code: string | null;
  published_at: string | null;
  published_by: string | null;
  version_id: string | null;
  version_number: number | string | null;
};

type BusinessParameterVersionRecord = {
  cancelled_at: string | null;
  cancelled_by: string | null;
  change_reason: string | null;
  config: unknown;
  effective_from: string | null;
  id: string | null;
  parameter_code: string | null;
  published_at: string | null;
  published_by: string | null;
  version_number: number | string | null;
};

export async function getCommissionRuleSettings(
  supabase: SupabaseClient,
): Promise<CommissionRuleSetting[]> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("get_active_business_parameters"),
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as ActiveBusinessParameterRecord[]).flatMap(
    (row, index) => {
      const ruleCode = normalizeCommissionRuleCode(row.parameter_code);
      if (!ruleCode) return [];

      return [
        {
          config: normalizeRuleConfig(row.config),
          ruleCode,
          sortOrder: index,
          updatedAt: row.effective_from,
        },
      ];
    },
  );
}

/** 管理员设置页读取三组参数的当前版本、唯一预约版本和完整历史。 */
export async function listBusinessParameterSettings(
  supabase: SupabaseClient,
): Promise<BusinessParameterSetting[]> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("list_business_parameter_settings"),
  );

  if (error) throw error;

  const grouped = new Map<CommissionRuleCode, BusinessParameterSetting>();
  for (const record of (data ??
    []) as unknown as BusinessParameterListRecord[]) {
    const version = normalizeBusinessParameterVersion(record);
    const code = normalizeCommissionRuleCode(record.parameter_code);
    if (!version || !code) continue;

    const setting = grouped.get(code) ?? {
      currentRevision: parseNumber(record.current_revision) ?? 0,
      currentVersion: version,
      history: [],
      parameterCode: code,
      scheduledVersion: null,
      sortOrder: parseNumber(record.sort_order) ?? 0,
    };

    if (version.status === "current") setting.currentVersion = version;
    if (version.status === "scheduled") setting.scheduledVersion = version;
    setting.history.push(version);
    grouped.set(code, setting);
  }

  return [...grouped.values()].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
}

export async function publishBusinessParameterVersion(
  supabase: SupabaseClient,
  input: {
    changeReason: string;
    config: CommissionRuleConfig;
    effectiveFrom: string | null;
    expectedRevision: number;
    parameterCode: CommissionRuleCode;
    requestId: string;
  },
): Promise<BusinessParameterPublishReceipt> {
  const { data, error } = await withRequestTimeout(
    supabase
      .rpc("publish_business_parameter_version", {
        p_change_reason: input.changeReason,
        p_config: input.config,
        p_effective_from: input.effectiveFrom,
        p_expected_revision: input.expectedRevision,
        p_parameter_code: input.parameterCode,
        p_request_id: input.requestId,
      })
      .single<BusinessParameterPublishRecord>(),
  );

  if (error) throw error;

  const receipt = normalizeBusinessParameterPublishReceipt(data);
  if (!receipt) throw new Error("business_parameter_receipt_missing");
  return receipt;
}

export async function cancelScheduledBusinessParameterVersion(
  supabase: SupabaseClient,
  input: { expectedRevision: number; versionId: string },
) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("cancel_scheduled_business_parameter_version", {
      p_expected_revision: input.expectedRevision,
      p_version_id: input.versionId,
    }),
  );

  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("business_parameter_cancel_receipt_missing");
  }
  return data[0] as { current_revision: number; version_id: string };
}

/**
 * 发布接口返回后必须直接回读版本表。调用方只有在版本编号、规则值和生效时间都一致时，
 * 才能把操作显示为成功，避免“接口返回成功但实际没有落库”的假成功。
 */
export async function verifyPublishedBusinessParameterVersion(
  supabase: SupabaseClient,
  receipt: BusinessParameterPublishReceipt,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("business_parameter_versions")
      .select(BUSINESS_PARAMETER_VERSION_SELECT)
      .eq("id", receipt.versionId)
      .maybeSingle<BusinessParameterVersionRecord>(),
  );

  if (error) throw error;
  if (!data) throw new Error("business_parameter_final_readback_missing");

  const sameVersion =
    parseNumber(data.version_number) === receipt.versionNumber;
  const sameConfig = stableJson(data.config) === stableJson(receipt.config);
  const sameEffectiveFrom = data.effective_from === receipt.effectiveFrom;

  if (!sameVersion || !sameConfig || !sameEffectiveFrom) {
    throw new Error("business_parameter_final_readback_mismatch");
  }

  return data;
}

function normalizeBusinessParameterPublishReceipt(
  row: BusinessParameterPublishRecord | null,
): BusinessParameterPublishReceipt | null {
  const parameterCode = normalizeCommissionRuleCode(row?.parameter_code);
  const versionNumber = parseNumber(row?.version_number);
  const currentRevision = parseNumber(row?.current_revision);

  if (
    !parameterCode ||
    !row?.version_id ||
    !row.effective_from ||
    !row.published_at ||
    !row.published_by ||
    !row.change_reason ||
    versionNumber === null ||
    currentRevision === null
  )
    return null;

  return {
    changeReason: row.change_reason,
    config: normalizeRuleConfig(row.config),
    currentRevision,
    effectiveFrom: row.effective_from,
    parameterCode,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    versionId: row.version_id,
    versionNumber,
  };
}

function normalizeBusinessParameterVersion(
  row: BusinessParameterListRecord,
): BusinessParameterVersion | null {
  const parameterCode = normalizeCommissionRuleCode(row.parameter_code);
  const versionNumber = parseNumber(row.version_number);
  const status = normalizeVersionStatus(row.version_status);

  if (
    !parameterCode ||
    !row.version_id ||
    !row.effective_from ||
    !row.published_at ||
    !row.change_reason ||
    versionNumber === null ||
    !status
  )
    return null;

  return {
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    changeReason: row.change_reason,
    config: normalizeRuleConfig(row.config),
    effectiveFrom: row.effective_from,
    parameterCode,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    publisherEmail: row.publisher_email,
    publisherName: row.publisher_name,
    status,
    versionId: row.version_id,
    versionNumber,
  };
}

function normalizeVersionStatus(value: string | null) {
  return ["cancelled", "current", "history", "scheduled"].includes(value ?? "")
    ? (value as BusinessParameterVersionStatus)
    : null;
}

function stableJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

function normalizeCommissionRuleCode(
  value: string | null | undefined,
): CommissionRuleCode | null {
  return COMMISSION_RULE_CODES.find((code) => code === value) ?? null;
}

function normalizeRuleConfig(value: unknown): CommissionRuleConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<CommissionRuleConfig>(
    (result, [key, item]) => {
      const parsed = parseNumber(item);

      if (parsed !== null) {
        result[key] = parsed;
      }

      return result;
    },
    {},
  );
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
