import assert from "node:assert/strict";
import test from "node:test";
import { calculateWholesaleOrderFees } from "../lib/wholesale-order-fees.ts";

// 用业务确定的金额和舍入边界断言，不从实现重新拼装期望公式。
test("基数10000显示500、300、108", () => {
  assert.deepEqual(calculateWholesaleOrderFees({ smallOrderCount: "100", productPurchaseAmount: "8500", internationalShippingFee: "1200" }), {
    serviceFee: 500, cnTaxFee: 300, paymentProcessingFee: 108,
  });
});
test("半分钱正向四舍五入", () => {
  assert.deepEqual(calculateWholesaleOrderFees({ smallOrderCount: "0", productPurchaseAmount: "0.10", internationalShippingFee: "0" }), {
    serviceFee: 0.01, cnTaxFee: 0, paymentProcessingFee: 0,
  });
});
test("付款手续费使用已经舍入的服务费和税费", () => {
  assert.deepEqual(calculateWholesaleOrderFees({ smallOrderCount: "0", productPurchaseAmount: "2.31", internationalShippingFee: "0" }), {
    serviceFee: 0.12, cnTaxFee: 0.07, paymentProcessingFee: 0.03,
  });
});
test("零成本不产生费用", () => {
  assert.deepEqual(calculateWholesaleOrderFees({ smallOrderCount: 0, productPurchaseAmount: 0, internationalShippingFee: 0 }), {
    serviceFee: 0, cnTaxFee: 0, paymentProcessingFee: 0,
  });
});
