import { formatCommissionSettingValue, getRuleConfigValue } from "@/components/dashboard/commission/commission-settings-display";
import type { CommissionRuleSetting } from "@/lib/commission-settings";

/** 这里只解释当前规则；每笔提成仍显示它自己锁定的版本及实际比例。 */
export function formatWholesaleOrderCommissionDescription(rows: CommissionRuleSetting[], locale: string) {
  const rule = rows.find((row) => row.ruleCode === "wholesale_salesman_customer_commission");
  const existingRate = rule ? getRuleConfigValue(rule.config, "existing_customer_rate") : null;
  const newRate = rule ? getRuleConfigValue(rule.config, "new_customer_service_fee_rate") : null;
  const isEnglish = locale.startsWith("en");
  if (existingRate === null || newRate === null) return isEnglish
    ? "A commission rule is required before these amounts can be calculated."
    : "当前缺少可用的提成规则，相关金额暂无法计算。";
  if (isEnglish) return `Commission is earned after full payment: existing customers use ${formatCommissionSettingValue("rate", existingRate, locale)} of positive gross profit; new customers use ${formatCommissionSettingValue("rate", newRate, locale)} of the service fee. Customer creation time is compared with 8 October 2026, 00:00 Shanghai time. Each order keeps the rule version assigned at creation.`;
  return `全款收齐后计提成：老客户按毛利 ${formatCommissionSettingValue("rate", existingRate, locale)}，新客户按服务费 ${formatCommissionSettingValue("rate", newRate, locale)}。客户按上海时间2026年10月8日零点的创建时间划分，订单使用创建时锁定的规则。`;
}
