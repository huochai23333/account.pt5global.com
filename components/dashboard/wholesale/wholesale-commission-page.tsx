"use client";

import { useTranslations } from "next-intl";
import { DashboardSegmentedTabs } from "@/components/dashboard/dashboard-segmented-tabs";
import { FeedbackNotice } from "@/components/dashboard/dashboard-shared-ui";
import { Button } from "@/components/ui/button";
import type { WholesalePageData } from "@/lib/wholesale";
import { WholesaleCommissionSection } from "./wholesale-commission-section";
import { WholesaleReferralCommissionSection } from "./wholesale-referral-commission-section";
import { useWholesaleCommissionBoard } from "./use-wholesale-commission-board";
import { WholesalePageShell } from "./wholesale-ui";

type Props = {
  initialData: WholesalePageData;
  onSettleCommission: (id: string) => void;
  pendingKey: string | null;
};

/** 页面只组装标签与业务区块，查询、结算和各自筛选继续由独立模块负责。 */
export function WholesaleCommissionPage({ initialData, onSettleCommission, pendingKey }: Props) {
  const t = useTranslations("WholesaleBusiness.commissionBoards");
  const { board, selectBoard } = useWholesaleCommissionBoard(initialData.commissionBoards);
  const customersById = new Map(initialData.customers.map((row) => [row.id, row]));
  const profilesById = new Map(initialData.profiles.map((row) => [row.user_id, row]));

  return <WholesalePageShell title={t("title")}>
    {initialData.commissionPageError ? <CommissionLoadError /> : <>
      {initialData.commissionBoards.length > 1 ? <DashboardSegmentedTabs
        options={initialData.commissionBoards.map((key) => ({ key, label: t(key) }))}
        onChange={selectBoard}
        value={board}
      /> : null}
      {/* 仅挂载获授权区块；用 hidden 保留非当前标签的本地筛选和分页状态。 */}
      {initialData.commissionBoards.includes("salesman") ? <div hidden={board !== "salesman"} data-commission-board="salesman">
        {initialData.commissionBoardErrors.salesman ? <CommissionLoadError board="salesman" /> : <WholesaleCommissionSection
          canAdmin={initialData.currentRole === "administrator"}
          commissionRuleSettings={initialData.commissionRuleSettings}
          commissions={initialData.commissions}
          customersById={customersById}
          onSettleCommission={onSettleCommission}
          orders={initialData.orders}
          pendingKey={pendingKey}
          profilesById={profilesById}
        />}
      </div> : null}
      {initialData.commissionBoards.includes("referrals") ? <div hidden={board !== "referrals"} data-commission-board="referrals">
        {initialData.commissionBoardErrors.referrals ? <CommissionLoadError board="referrals" /> : <WholesaleReferralCommissionSection customersById={customersById} referralRows={initialData.referralCommissionRows} />}
      </div> : null}
    </>}
  </WholesalePageShell>;
}

/** 加载失败与真正的空记录采用不同反馈，按钮重新请求服务端权威数据。 */
function CommissionLoadError({ board }: { board?: "salesman" | "referrals" }) {
  const t = useTranslations("WholesaleBusiness.commissionBoards");
  return <FeedbackNotice tone="error">
    {t(board ? `${board}Error` : "loadError")}
    <Button className="ml-3" variant="outline" type="button" onClick={() => window.location.reload()}>{t("retry")}</Button>
  </FeedbackNotice>;
}
