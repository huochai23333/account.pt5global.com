import type {
  CommissionRuleCode,
  CommissionRuleConfig,
} from "@/lib/commission-settings";

export type CommissionRuleFieldKind = "amountRmb" | "amountUsd" | "count" | "rate";

export type CommissionRuleField = {
  configKey: string;
  kind: CommissionRuleFieldKind;
  labelKey: string;
};

export type CommissionRuleDefinition = {
  calculationKey: string;
  code: CommissionRuleCode;
  descriptionKey: string;
  fields: CommissionRuleField[];
  group: "order" | "referral" | "service";
  labelKey: string;
};

type FormulaTranslator = (
  key: string,
  values?: Record<string, string>,
) => string;

export const COMMISSION_RULE_DEFINITIONS: CommissionRuleDefinition[] = [
  {
    calculationKey: "settings.calculations.serviceEscortSalesman",
    code: "service_escort_salesman",
    descriptionKey: "settings.ruleDescriptions.serviceEscortSalesman",
    fields: [
      {
        configKey: "rate",
        kind: "rate",
        labelKey: "settings.fields.rate",
      },
    ],
    group: "service",
    labelKey: "settings.rules.serviceEscortSalesman",
  },
  {
    calculationKey: "settings.calculations.digitalSurvivalSalesman",
    code: "digital_survival_salesman",
    descriptionKey: "settings.ruleDescriptions.digitalSurvivalSalesman",
    fields: [
      {
        configKey: "rate",
        kind: "rate",
        labelKey: "settings.fields.rate",
      },
    ],
    group: "service",
    labelKey: "settings.rules.digitalSurvivalSalesman",
  },
  {
    calculationKey: "settings.calculations.serviceReferral",
    code: "service_referral_rate",
    descriptionKey: "settings.ruleDescriptions.serviceReferral",
    fields: [
      {
        configKey: "rate",
        kind: "rate",
        labelKey: "settings.fields.rate",
      },
    ],
    group: "referral",
    labelKey: "settings.rules.serviceReferral",
  },
  {
    calculationKey: "settings.calculations.vipFirstYearReferralBonus",
    code: "vip_first_year_referral_bonus",
    descriptionKey: "settings.ruleDescriptions.vipFirstYearReferralBonus",
    fields: [
      {
        configKey: "bonus_usd",
        kind: "amountUsd",
        labelKey: "settings.fields.bonusUsd",
      },
    ],
    group: "referral",
    labelKey: "settings.rules.vipFirstYearReferralBonus",
  },
  {
    calculationKey: "settings.calculations.wholesaleOrderSalesmanTier",
    code: "wholesale_salesman_customer_commission",
    descriptionKey: "settings.ruleDescriptions.wholesaleOrderSalesmanTier",
    fields: [
      { configKey: "existing_customer_rate", kind: "rate", labelKey: "settings.fields.existingCustomerRate" },
      { configKey: "new_customer_service_fee_rate", kind: "rate", labelKey: "settings.fields.newCustomerServiceFeeRate" },
    ],
    group: "order",
    labelKey: "settings.rules.wholesaleOrderSalesmanTier",
  },
  {
    calculationKey: "settings.calculations.wholesaleReferralOrderAmount",
    code: "wholesale_referral_order_amount_rate",
    descriptionKey: "settings.ruleDescriptions.wholesaleReferralOrderAmount",
    fields: [
      {
        configKey: "rate",
        kind: "rate",
        labelKey: "settings.fields.rate",
      },
    ],
    group: "referral",
    labelKey: "settings.rules.wholesaleReferralOrderAmount",
  },
  {
    calculationKey: "settings.calculations.wholesaleReferralWaybillBonus",
    code: "wholesale_referral_waybill_bonus",
    descriptionKey: "settings.ruleDescriptions.wholesaleReferralWaybillBonus",
    fields: [
      {
        configKey: "tier_1_threshold",
        kind: "count",
        labelKey: "settings.fields.tier1Count",
      },
      {
        configKey: "tier_1_bonus_usd",
        kind: "amountUsd",
        labelKey: "settings.fields.tier1BonusUsd",
      },
      {
        configKey: "tier_2_threshold",
        kind: "count",
        labelKey: "settings.fields.tier2Count",
      },
      {
        configKey: "tier_2_bonus_usd",
        kind: "amountUsd",
        labelKey: "settings.fields.tier2BonusUsd",
      },
      {
        configKey: "tier_3_threshold",
        kind: "count",
        labelKey: "settings.fields.tier3Count",
      },
      {
        configKey: "tier_3_bonus_usd",
        kind: "amountUsd",
        labelKey: "settings.fields.tier3BonusUsd",
      },
    ],
    group: "referral",
    labelKey: "settings.rules.wholesaleReferralWaybillBonus",
  },
];

export function formatCommissionSettingValue(
  kind: CommissionRuleFieldKind,
  value: number,
  locale: string,
) {
  if (kind === "rate") {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      style: "percent",
    }).format(value);
  }

  if (kind === "count") {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (kind === "amountUsd") {
    return new Intl.NumberFormat(locale, {
      currency: "USD",
      maximumFractionDigits: 2,
      style: "currency",
    }).format(value);
  }

  return new Intl.NumberFormat(locale, {
    currency: "CNY",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function formatCommissionCalculationFormula(
  definition: CommissionRuleDefinition,
  config: CommissionRuleConfig,
  locale: string,
  t: FormulaTranslator,
) {
  const missing = t("settings.table.missing");
  const formattedValue = (key: string, kind: CommissionRuleFieldKind) => {
    const value = getRuleConfigValue(config, key);

    return value === null
      ? missing
      : formatCommissionSettingValue(kind, value, locale);
  };

  switch (definition.code) {
    case "wholesale_salesman_customer_commission":
      return t(definition.calculationKey, {
        existingCustomerRate: formattedValue("existing_customer_rate", "rate"),
        newCustomerServiceFeeRate: formattedValue("new_customer_service_fee_rate", "rate"),
      });
    case "service_escort_salesman":
    case "digital_survival_salesman":
    case "service_referral_rate":
    case "wholesale_referral_order_amount_rate":
      return t(definition.calculationKey, {
        rate: formattedValue("rate", "rate"),
      });
    case "vip_first_year_referral_bonus":
      return t(definition.calculationKey, {
        bonusUsd: formattedValue("bonus_usd", "amountUsd"),
      });
    case "wholesale_referral_waybill_bonus":
      return t(definition.calculationKey, {
        tier1BonusUsd: formattedValue("tier_1_bonus_usd", "amountUsd"),
        tier1Count: formattedValue("tier_1_threshold", "count"),
        tier2BonusUsd: formattedValue("tier_2_bonus_usd", "amountUsd"),
        tier2Count: formattedValue("tier_2_threshold", "count"),
        tier3BonusUsd: formattedValue("tier_3_bonus_usd", "amountUsd"),
        tier3Count: formattedValue("tier_3_threshold", "count"),
      });
    default:
      return t(definition.calculationKey);
  }
}

export function formatCommissionSettingInput(
  kind: CommissionRuleFieldKind,
  value: number | null,
) {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  const normalized = kind === "rate" ? value * 100 : value;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: kind === "count" ? 0 : kind === "rate" ? 4 : 2,
    useGrouping: false,
  }).format(normalized);
}

export function getRuleConfigValue(
  config: CommissionRuleConfig,
  key: string,
) {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
