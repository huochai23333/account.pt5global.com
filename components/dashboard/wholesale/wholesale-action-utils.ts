export function getWholesaleOrderRpcPayload(formData: FormData) {
  // 订单写入接口共用同一组字段，避免页面和数据库看到的修改内容不一致。
  return {
    p_courier_company: optionalString(formData.get("courier_company")),
    p_customer_id: requiredString(formData.get("customer_id")),
    p_customer_payment_amount: nonnegativeNumber(
      formData.get("customer_payment_amount"),
    ),
    p_customer_payment_currency:
      optionalString(formData.get("customer_payment_currency")) ?? "CNY",
    p_international_shipping_fee: nonnegativeNumber(
      formData.get("international_shipping_fee"),
    ),
    p_notes: optionalString(formData.get("notes")),
    p_order_month: normalizeMonth(formData.get("order_month")),
    p_other_fee: nonnegativeNumber(formData.get("other_fee")),
    p_payment_platform: optionalString(formData.get("payment_platform")),
    p_product_purchase_amount: nonnegativeNumber(
      formData.get("product_purchase_amount"),
    ),
    p_referral_commission_fee: nonnegativeNumber(
      formData.get("referral_commission_fee"),
    ),
    p_sales_user_id: optionalString(formData.get("sales_user_id")),
    p_small_order_count: nonnegativeInteger(formData.get("small_order_count")),
  };
}

export function getWholesaleOrderCreateRpcPayload(formData: FormData) {
  return {
    ...getWholesaleOrderRpcPayload(formData),
    // 这个随机编号只描述一次保存动作，不包含客户或金额等业务信息。
    p_creation_request_id: requiredString(
      formData.get("creation_request_id"),
    ),
  };
}

export function optionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function requiredString(value: FormDataEntryValue | null) {
  const normalized = optionalString(value);

  if (!normalized) {
    throw new Error("required");
  }

  return normalized;
}

export function nonnegativeNumber(value: FormDataEntryValue | null) {
  const parsed = Number(optionalString(value) ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function optionalPositiveNumber(value: FormDataEntryValue | null) {
  const raw = optionalString(value);

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function positiveNumber(value: FormDataEntryValue | null) {
  const parsed = optionalPositiveNumber(value);

  if (parsed === null) {
    throw new Error("invalid exchange rate");
  }

  return parsed;
}

export function splitList(value: FormDataEntryValue | null) {
  const raw = optionalString(value);

  if (!raw) {
    return [];
  }

  return raw
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toWholesaleActionErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("wholesale_order_settlement_rate_missing")) {
    return "这个结汇日期没有对应汇率，请先到汇率设置中补充。";
  }

  if (normalized.includes("settlement_exchange_rate_repair_incomplete")) {
    return "这天的汇率还没有全部补齐，系统会继续处理，请稍后再保存。";
  }

  if (normalized.includes("wholesale_order_creation_request_conflict")) {
    return "这笔订单已经保存，请刷新订单列表后查看。";
  }

  if (normalized.includes("wholesale_order_creation_request_required")) {
    return "这次保存还没有准备好，请关闭弹窗后重新打开。";
  }

  if (normalized.includes("wholesale_order_settlement_amount_exceeds")) {
    return "本次结汇金额超过了这笔订单剩余可结汇金额。";
  }

  if (normalized.includes("wholesale_order_settlement_currency_locked")) {
    return "这笔订单已经有结汇记录，不能再修改客户支付币种。";
  }

  if (normalized.includes("wholesale_order_settlement_amount_invalid")) {
    return "请填写大于 0 的本次结汇金额。";
  }

  if (normalized.includes("wholesale_order_settlement_already_complete")) {
    return "这笔订单已经全部结汇，不能继续新增结汇记录。";
  }

  if (normalized.includes("wholesale_settlement_release_amount_invalid")) {
    return "请填写大于 0 的结汇金额。";
  }

  if (normalized.includes("wholesale_settlement_release_customer_name_required")) {
    return "请选择客户或填写客户名称。";
  }

  if (normalized.includes("wholesale_settlement_release_customer_not_found")) {
    return "没有找到这个客户，请刷新后再试。";
  }

  if (normalized.includes("wholesale_settlement_release_currency_required")) {
    return "请选择结汇币种。";
  }

  if (normalized.includes("wholesale_settlement_release_currency_mismatch")) {
    return "这条收款的币种和所选订单不一致。";
  }

  if (normalized.includes("wholesale_settlement_release_amount_exceeds")) {
    return "订单分配金额合计不能超过这笔实际收款。";
  }

  if (normalized.includes("wholesale_settlement_release_allocations_invalid")) {
    return "请至少选择一笔订单，并为每笔订单填写大于 0 的分配金额。";
  }

  if (normalized.includes("wholesale_settlement_release_revision_conflict")) {
    return "这笔收款刚刚被其他人调整过，请刷新后按最新金额重新分配。";
  }

  if (
    normalized.includes("wholesale_settlement_release_commission_already_paid")
  ) {
    return "相关订单的业务员提成已经发放，请先处理已发提成后再调整分配。";
  }

  if (
    normalized.includes("wholesale_settlement_release_not_available") ||
    normalized.includes("wholesale_settlement_release_allocation_target_invalid")
  ) {
    return "这笔收款当前不能分配，请刷新后查看最新状态。";
  }

  if (normalized.includes("wholesale_settlement_release_customer_mismatch")) {
    return "这笔收款已经确定客户，请只选择该客户的订单。";
  }

  if (normalized.includes("wholesale_settlement_release_not_pending")) {
    return "这条收款已经处理过，请刷新后查看最新状态。";
  }

  if (normalized.includes("wholesale_settlement_release_not_found")) {
    return "没有找到这条结汇收款，请刷新后再试。";
  }

  if (normalized.includes("exchange rate is not ready")) {
    return "这个币种的汇率还没有准备好，请先到汇率设置中补充。";
  }

  if (
    normalized.includes("daily order counter exceeded") ||
    normalized.includes("duplicate key")
  ) {
    return "订单编号暂时没有生成成功，请稍后再试。";
  }

  if (
    normalized.includes("wholesale_order_sales_user_forbidden") ||
    normalized.includes("wholesale_customer_assignment_forbidden")
  ) {
    return "请选择可以承接批发业务的业务员。";
  }

  if (
    normalized.includes("wholesale_customer_link_target_not_referred") ||
    normalized.includes("wholesale_customer_link_user_not_available")
  ) {
    return "请选择已通过你的批发注册链接注册的客户账号。";
  }

  if (normalized.includes("wholesale_customer_other_name_required")) {
    return "请填写要新增的客户其他名称。";
  }

  if (normalized.includes("wholesale_customer_name_required")) {
    return "请填写客户唯一标识名称。";
  }

  if (
    normalized.includes("wholesale_customer_unique_name_exists") ||
    normalized.includes("wholesale_customers_unique_name_key")
  ) {
    return "这个客户名称已经存在，请换一个名称。";
  }

  if (normalized.includes("wholesale_customer_delete_has_orders")) {
    return "这个客户已经有批发订单，不能删除。";
  }

  if (normalized.includes("wholesale_customer_not_found")) {
    return "没有找到这个客户，请刷新后再试。";
  }

  if (
    normalized.includes("_forbidden") ||
    normalized.includes("wholesale_customer_link_forbidden") ||
    normalized.includes("wholesale_order_forbidden") ||
    normalized.includes("permission denied")
  ) {
    return "当前账号没有保存这项内容的权限。";
  }

  if (normalized.includes("wholesale_order_not_found")) {
    return "没有找到这笔批发订单，请刷新后再试。";
  }

  if (normalized.includes("wholesale_order_settlement_locked")) {
    return "已结汇的订单不能直接改回未结汇。";
  }

  if (
    normalized.includes("wholesale_customer_link_already_linked") ||
    normalized.includes("wholesale_customer_link_user_already_linked")
  ) {
    return "这个客户或注册账号已经完成合并，不能重复合并。";
  }

  if (
    normalized.includes("wholesale_customer_link_user_not_found") ||
    normalized.includes("wholesale_customer_link_target_must_be_customer")
  ) {
    return "请选择客户本人注册的账号进行合并。";
  }

  if (normalized.includes("wholesale_customer_link_customer_not_found")) {
    return "没有找到这个批发客户，请刷新后再试。";
  }

  return "操作没有成功，请检查内容和权限后再试。";
}

function nonnegativeInteger(value: FormDataEntryValue | null) {
  return Math.trunc(nonnegativeNumber(value));
}

function normalizeMonth(value: FormDataEntryValue | null) {
  const raw = optionalString(value);

  if (!raw) {
    return new Date().toISOString().slice(0, 7) + "-01";
  }

  return raw.length === 7 ? `${raw}-01` : raw;
}
