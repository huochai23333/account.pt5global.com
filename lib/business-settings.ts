import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getOrderDiscountTypeOptions,
  getServiceFeeTypeOptions,
  getServiceOrderPriceOptions,
  getServiceOrderTypeOptions,
  type OrderDiscountTypeOption,
  type ServiceOrderPriceOption,
  type ServiceOrderTypeOption,
} from "./admin-orders";
import {
  listBusinessParameterSettings,
  type BusinessParameterSetting,
} from "./commission-settings";
import { getCurrentSessionContext } from "./current-session-context";
import type { ServiceFeeTypeOption } from "./service-fee-types";
import type { WorkspaceBusinessKey } from "./workspace-business-modules";
import { parseEnabledWorkspaceBusinessKey } from "./workspace-business-availability";

export type BusinessSettingsPageData = {
  business: WorkspaceBusinessKey;
  canManageCommissionSettings: boolean;
  businessParameterSettings: BusinessParameterSetting[];
  hasPermission: boolean;
  orderDiscountOptions: OrderDiscountTypeOption[];
  serviceFeeTypeOptions: ServiceFeeTypeOption[];
  serviceOrderPriceOptions: ServiceOrderPriceOption[];
  serviceOrderTypeOptions: ServiceOrderTypeOption[];
};

export async function getBusinessSettingsPageData(
  supabase: SupabaseClient,
  business: WorkspaceBusinessKey,
): Promise<BusinessSettingsPageData> {
  const enabledBusiness = parseEnabledWorkspaceBusinessKey(business);
  const { user, role, status } = await getCurrentSessionContext(supabase);

  if (!user || role !== "administrator" || status !== "active") {
    return createEmptyBusinessSettingsPageData(enabledBusiness);
  }

  const [
    serviceFeeTypeOptions,
    serviceOrderTypeOptions,
    serviceOrderPriceOptions,
    orderDiscountOptions,
    businessParameterSettings,
  ] = await Promise.all([
    getServiceFeeTypeOptions(supabase),
    getServiceOrderTypeOptions(supabase),
    getServiceOrderPriceOptions(supabase),
    getOrderDiscountTypeOptions(supabase),
    listBusinessParameterSettings(supabase),
  ]);

  return {
    business: enabledBusiness,
    canManageCommissionSettings: true,
    businessParameterSettings,
    hasPermission: true,
    orderDiscountOptions,
    serviceFeeTypeOptions,
    serviceOrderPriceOptions,
    serviceOrderTypeOptions,
  };
}

function createEmptyBusinessSettingsPageData(
  business: WorkspaceBusinessKey,
): BusinessSettingsPageData {
  return {
    business,
    canManageCommissionSettings: false,
    businessParameterSettings: [],
    hasPermission: false,
    orderDiscountOptions: [],
    serviceFeeTypeOptions: [],
    serviceOrderPriceOptions: [],
    serviceOrderTypeOptions: [],
  };
}
