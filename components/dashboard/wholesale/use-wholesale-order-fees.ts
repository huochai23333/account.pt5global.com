"use client";

import { useState } from "react";
import { calculateWholesaleOrderFees, type WholesaleOrderFeeInputs } from "@/lib/wholesale-order-fees";

/** 只管理费用预览；三个派生金额不提交，保存结果始终由数据库决定。 */
export function useWholesaleOrderFees(resetKey: string, initial?: WholesaleOrderFeeInputs) {
  const initialFees = () => calculateWholesaleOrderFees(initial ?? {
    smallOrderCount: 0, productPurchaseAmount: 0, internationalShippingFee: 0,
  });
  const [preview, setPreview] = useState(() => ({ resetKey, fees: initialFees() }));
  // 打开另一张订单或重新打开创建表单时重置；不把上次草稿的费用带入新表单。
  if (preview.resetKey !== resetKey) setPreview({ resetKey, fees: initialFees() });
  const updateFromForm = (form: HTMLFormElement) => {
    const values = new FormData(form);
    setPreview({ resetKey, fees: calculateWholesaleOrderFees({
      smallOrderCount: String(values.get("small_order_count") ?? "0"),
      productPurchaseAmount: String(values.get("product_purchase_amount") ?? "0"),
      internationalShippingFee: String(values.get("international_shipping_fee") ?? "0"),
    }) });
  };
  return { fees: preview.resetKey === resetKey ? preview.fees : initialFees(), updateFromForm };
}
