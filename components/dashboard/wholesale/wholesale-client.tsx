"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { FeedbackNotice } from "@/components/dashboard/dashboard-shared-ui";
import { Button } from "@/components/ui/button";
import type { WholesalePageData } from "@/lib/wholesale";
import {
  canAssignWholesaleSalesUser,
  getWholesaleRoleCapabilities,
  canManageEveryWholesaleCustomer,
  canManageEveryWholesaleOrder,
} from "@/lib/wholesale-role-permissions";
import { WholesaleClaimsSection } from "./wholesale-claims-section";
import { WholesaleCommissionSection } from "./wholesale-commission-section";
import { WholesaleCustomersSection } from "./wholesale-customers-section";
import { WholesaleLogisticsSection } from "./wholesale-logistics-section";
import { WholesaleOrdersSection } from "./wholesale-orders-section";
import { WholesalePeopleSection } from "./wholesale-people-section";
import { WholesaleReferralsSection } from "./wholesale-referrals-section";
import { WholesaleActionFeedbackNotice } from "./wholesale-action-feedback";
import { useWholesaleActions } from "./use-wholesale-actions";
export function WholesaleClient({
  initialData,
}: {
  initialData: WholesalePageData;
}) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_client",
  );
  const actions = useWholesaleActions();
  const customersById = new Map(
    initialData.customers.map((customer) => [customer.id, customer]),
  );
  const profilesById = new Map(
    initialData.profiles.map((profile) => [profile.user_id, profile]),
  );
  const salesAccounts = initialData.profiles.filter(
    (profile) => profile.role === "salesman",
  );
  // 账号合并和追加业务都只使用数据库确认过资格的客户候选列表。
  const registeredAccounts = initialData.registeredCandidates;
  const canAdmin = initialData.currentRole === "administrator";
  const capabilities = getWholesaleRoleCapabilities(initialData.currentRole);
  const canEdit = capabilities.canManageEveryOrder;
  const canManageClaims = capabilities.canManageClaims;
  const canManageWholesaleCustomers = canManageEveryWholesaleCustomer(
    initialData.currentRole,
  );
  const canLinkCustomerAccount = canManageWholesaleCustomers;
  return (
    <div className="space-y-6">
      <WholesaleActionFeedbackNotice feedback={actions.feedback} />

      {initialData.section === "orders" && initialData.orderPage ? (
        <WholesaleOrdersSection
          canEdit={canEdit}
          canManageEveryOrder={canManageEveryWholesaleOrder(
            initialData.currentRole,
          )}
          canReassignOrder={canAssignWholesaleSalesUser(
            initialData.currentRole,
          )}
          currentRole={initialData.currentRole}
          currentUserId={initialData.currentUserId}
          customers={initialData.customers}
          customersById={customersById}
          exchangeRates={initialData.exchangeRates}
          initialPage={initialData.orderPage}
          onMarkOrderSettled={actions.markOrderSettled}
          onCreateOrder={actions.createOrder}
          onDeleteOrderListAttachment={actions.deleteOrderListAttachment}
          onUpdateOrder={actions.updateOrder}
          onUploadOrderListAttachments={actions.uploadOrderListAttachments}
          pendingKey={actions.pendingKey}
          profilesById={profilesById}
          salesAccounts={salesAccounts}
        />
      ) : null}

      {initialData.section === "orders" && !initialData.orderPage ? (
        <div className="space-y-4">
          <FeedbackNotice tone="error">
            {initialData.orderPageError ??
              "批发订单暂时没有加载成功，请稍后重试。"}
          </FeedbackNotice>
          <Button
            variant="primary"
            size="default"
            onClick={() => window.location.reload()}
            type="button"
          >
            <UiMessage id="components_dashboard_wholesale_wholesale_client.text001" />
          </Button>
        </div>
      ) : null}

      {initialData.section === "order-claims" && initialData.claimPage ? (
        <WholesaleClaimsSection
          actions={actions}
          canAdmin={canAdmin}
          canManageClaims={canManageClaims}
          customers={initialData.customers}
          initialPage={initialData.claimPage}
          pendingKey={actions.pendingKey}
        />
      ) : null}

      {initialData.section === "order-claims" && !initialData.claimPage ? (
        <FeedbackNotice tone="error">
          {uiText("claimsLoadError")}
        </FeedbackNotice>
      ) : null}

      {initialData.section === "logistics" ? (
        initialData.logisticsPage && initialData.logisticsFilters ? (
          <WholesaleLogisticsSection
            currentRole={initialData.currentRole}
            customers={initialData.customers}
            initialAssignments={initialData.logisticsAssignments}
            initialFilters={initialData.logisticsFilters}
            initialPage={initialData.logisticsPage}
            initialStoreOptions={initialData.logisticsStoreOptions}
            profiles={initialData.profiles}
          />
        ) : (
          <FeedbackNotice tone="error">{uiText("text002")}</FeedbackNotice>
        )
      ) : null}

      {initialData.section === "customers" ? (
        <WholesaleCustomersSection
          canAddRegisteredCustomer={canAdmin}
          canAssignSalesUser={canAssignWholesaleSalesUser(
            initialData.currentRole,
          )}
          canEdit={canManageWholesaleCustomers}
          canLinkCustomerAccount={canLinkCustomerAccount}
          currentUserId={initialData.currentUserId}
          customers={initialData.customers}
          onAddCustomerOtherName={actions.addCustomerOtherName}
          onAddRegisteredCustomer={actions.addRegisteredCustomer}
          onCreateCustomer={actions.createCustomer}
          onDeleteCustomer={actions.deleteCustomer}
          onLinkCustomerAccount={actions.linkCustomerAccount}
          onUpdateCustomer={actions.updateCustomer}
          pendingKey={actions.pendingKey}
          profilesById={profilesById}
          registeredAccounts={registeredAccounts}
          salesAccounts={salesAccounts}
        />
      ) : null}

      {initialData.section === "people" ? (
        <WholesalePeopleSection salesAccounts={salesAccounts} />
      ) : null}

      {initialData.section === "referrals" ? (
        <WholesaleReferralsSection
          canEdit={canEdit}
          customers={initialData.customers}
          customersById={customersById}
          onCreateReferral={actions.createReferral}
          pendingKey={actions.pendingKey}
          referrals={initialData.referrals}
        />
      ) : null}

      {initialData.section === "commission" ||
      initialData.section === "incentives" ? (
        <WholesaleCommissionSection
          canAdmin={canAdmin}
          commissionRuleSettings={initialData.commissionRuleSettings}
          commissions={initialData.commissions}
          customersById={customersById}
          onSettleCommission={actions.settleCommission}
          orders={initialData.orders}
          pendingKey={actions.pendingKey}
          profilesById={profilesById}
          referralRows={initialData.referralCommissionRows}
          variant={initialData.section}
        />
      ) : null}
    </div>
  );
}
