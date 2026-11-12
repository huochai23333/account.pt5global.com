"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { createWholesaleBusinessActions } from "./wholesale-business-actions";
import { createWholesaleCustomerAccountActions } from "./wholesale-customer-account-actions";
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
  const orderT = useTranslations("WholesaleBusiness.ordersUi");
  const customerT = useTranslations("WholesaleBusiness.customerWrite");
  const commissionT = useTranslations("WholesaleBusiness.commissionBoards");
  const aliasT = useTranslations("UiText.components_dashboard_wholesale_wholesale_customer_other_names");
  const runner = useWholesaleActionRunner();

  const customerActions = useMemo(
    () =>
      createWholesaleCustomerActions({
        recordFeedback: {
          created: customerT("created"),
          updated: customerT("updated"),
          editConflict: customerT("editConflict"),
          editUnconfirmed: customerT("editUnconfirmed"),
          deleted: customerT("deleted"),
        },
        deleteFeedback: (key) => customerT(key),
        aliasFeedback: {
          saved: aliasT("saved"),
          alreadyPresent: aliasT("alreadyPresent"),
          failed: aliasT("failed"),
        },
        runAction: runner.runAction,
      }),
    [aliasT, customerT, runner.runAction],
  );
  const customerAccountActions = useMemo(
    () => createWholesaleCustomerAccountActions({
      runAction: runner.runAction,
      addedMessage: accessT("success", { business: accessT("businesses.wholesale") }),
      addFeedback: (key) => accessT(key),
      linkedMessage: customerT("linked"),
      unconfirmedMessage: customerT("linkUnconfirmed"),
    }),
    [accessT, customerT, runner.runAction],
  );
  const orderActions = useMemo(
    () => createWholesaleOrderActions(runner.runAction, {
      created: orderT("writeFeedback.created"),
      updated: orderT("writeFeedback.updated"),
      settlementSaved: orderT("writeFeedback.settlementSaved"),
      settlementUnconfirmed: orderT("writeFeedback.settlementUnconfirmed"),
      settlementConflict: orderT("writeFeedback.settlementConflict"),
      settlementRateMissing: orderT("writeFeedback.settlementRateMissing"),
      refreshPending: orderT("writeFeedback.refreshPending"),
    }),
    [orderT, runner.runAction],
  );
  const orderListActions = useMemo(
    () => createWholesaleOrderListActions(runner.runAction, {
      uploaded: orderT("orderList.uploadSaved"),
      deleted: orderT("orderList.deleteSaved"),
      uploadUnconfirmed: orderT("orderList.uploadUnconfirmed"),
      uploadFailed: orderT("orderList.uploadFailed"),
      deleteIncomplete: orderT("orderList.deleteIncomplete"),
      deleteFailed: orderT("orderList.deleteFailed"),
    }),
    [orderT, runner.runAction],
  );
  const businessActions = useMemo(
    () => createWholesaleBusinessActions(runner.runAction, {
      saved: commissionT("settlementSaved"),
      changed: commissionT("settlementChanged"),
      unconfirmed: commissionT("settlementUnconfirmed"),
    }),
    [commissionT, runner.runAction],
  );

  return {
    ...businessActions,
    ...customerActions,
    ...customerAccountActions,
    ...orderActions,
    ...orderListActions,
    feedback: runner.feedback,
    pendingKey: runner.pendingKey,
  };
}
