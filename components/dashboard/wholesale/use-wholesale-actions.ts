"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { createWholesaleBusinessActions } from "./wholesale-business-actions";
import { createWholesaleCustomerActions } from "./wholesale-customer-actions";
import { createWholesaleOrderActions } from "./wholesale-order-actions";
import { createWholesaleOrderListActions } from "./wholesale-order-list-actions";
import { useWholesaleActionRunner } from "./use-wholesale-action-runner";

/**
 * 批发页面 action 的组装入口。
 * 具体请求已经按业务域拆开，这里只负责共享执行器、文案和最终返回值。
 */
export function useWholesaleActions() {
  const accessT = useTranslations("ClientBusinessAccess");
  const runner = useWholesaleActionRunner();

  const customerActions = useMemo(
    () =>
      createWholesaleCustomerActions({
        addRegisteredCustomerSuccessMessage: accessT("success", {
          business: accessT("businesses.wholesale"),
        }),
        runAction: runner.runAction,
      }),
    [accessT, runner.runAction],
  );
  const orderActions = useMemo(
    () => createWholesaleOrderActions(runner.runAction),
    [runner.runAction],
  );
  const orderListActions = useMemo(
    () => createWholesaleOrderListActions(runner.runAction),
    [runner.runAction],
  );
  const businessActions = useMemo(
    () => createWholesaleBusinessActions(runner.runAction),
    [runner.runAction],
  );

  return {
    ...businessActions,
    ...customerActions,
    ...orderActions,
    ...orderListActions,
    feedback: runner.feedback,
    pendingKey: runner.pendingKey,
  };
}
