"use client";

import { useState } from "react";

import type { BusinessSettingsPageData } from "@/lib/business-settings";

/**
 * 各规则区块保存后的最新行数据集中在 view-model。
 * 页面 Client 只把对应数据和更新函数传给规则区块，不直接维护表单状态。
 */
export function useBusinessSettingsViewModel(
  initialData: BusinessSettingsPageData,
) {
  const [serviceFeeTypeOptions, setServiceFeeTypeOptions] = useState(
    initialData.serviceFeeTypeOptions,
  );
  const [serviceOrderPriceOptions, setServiceOrderPriceOptions] = useState(
    initialData.serviceOrderPriceOptions,
  );
  const [orderDiscountOptions, setOrderDiscountOptions] = useState(
    initialData.orderDiscountOptions,
  );
  const [businessParameterSettings, setBusinessParameterSettings] = useState(
    initialData.businessParameterSettings,
  );
  return {
    businessParameterSettings,
    orderDiscountOptions,
    serviceFeeTypeOptions,
    serviceOrderPriceOptions,
    setBusinessParameterSettings,
    setOrderDiscountOptions,
    setServiceFeeTypeOptions,
    setServiceOrderPriceOptions,
  };
}
