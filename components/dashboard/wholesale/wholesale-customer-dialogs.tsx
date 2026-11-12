"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import { WholesaleCustomerDeleteDialog } from "./wholesale-customer-delete-dialog";
import type { DeleteWholesaleCustomerAction, SubmitWholesaleCustomerForm } from "./wholesale-customer-actions";
import { WholesaleCustomerDetails } from "./wholesale-customer-details";
import { WholesaleCustomerForm } from "./wholesale-customer-form";
type WholesaleCustomerDialogsProps = {
  canAssignSalesUser: boolean;
  canEdit: boolean;
  canLinkCustomerAccount: boolean;
  createDialogOpen: boolean;
  currentUserId: string | null;
  linkedRegisteredUserIds: Set<string>;
  onAddCustomerOtherName: (formData: FormData) => Promise<boolean>;
  onCreateCustomer: (formData: FormData) => boolean | Promise<boolean>;
  onCreateDialogOpenChange: (open: boolean) => void;
  onDeleteCustomer: DeleteWholesaleCustomerAction;
  onLinkCustomerAccount: SubmitWholesaleCustomerForm;
  onSelectedCustomerIdChange: (id: string | null) => void;
  onUpdateCustomer: SubmitWholesaleCustomerForm;
  pendingKey: string | null;
  profilesById: Map<string, WholesaleProfile>;
  registeredAccounts: WholesaleProfile[];
  salesAccounts: WholesaleProfile[];
  selectedCustomer: WholesaleCustomer | null;
  selectedCustomerId: string | null;
};
export function WholesaleCustomerDialogs({
  canAssignSalesUser,
  canEdit,
  canLinkCustomerAccount,
  createDialogOpen,
  currentUserId,
  linkedRegisteredUserIds,
  onAddCustomerOtherName,
  onCreateCustomer,
  onCreateDialogOpenChange,
  onDeleteCustomer,
  onLinkCustomerAccount,
  onSelectedCustomerIdChange,
  onUpdateCustomer,
  pendingKey,
  profilesById,
  registeredAccounts,
  salesAccounts,
  selectedCustomer,
  selectedCustomerId,
}: WholesaleCustomerDialogsProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_customer_dialogs",
  );
  const [customerToEdit, setCustomerToEdit] =
    useState<WholesaleCustomer | null>(null);
  const [customerToDelete, setCustomerToDelete] =
    useState<WholesaleCustomer | null>(null);
  return (
    <>
      <DashboardDialog
        description={uiText("attribute001")}
        onOpenChange={onCreateDialogOpenChange}
        open={createDialogOpen}
        title={uiText("attribute002")}
      >
        <WholesaleCustomerForm
          canAssignSalesUser={canAssignSalesUser}
          currentUserId={currentUserId}
          mode="create"
          onSaved={() => onCreateDialogOpenChange(false)}
          onSubmit={onCreateCustomer}
          pending={pendingKey === "customer:create"}
          profilesById={profilesById}
          salesAccounts={salesAccounts}
        />
      </DashboardDialog>

      <DashboardDialog
        onOpenChange={(open) => {
          if (!open) {
            onSelectedCustomerIdChange(null);
            setCustomerToEdit(null);
            setCustomerToDelete(null);
          }
        }}
        open={Boolean(selectedCustomerId)}
        title={selectedCustomer?.unique_name ?? uiText("detailsTitle")}
      >
        {selectedCustomer ? (
          <WholesaleCustomerDetails
            canEdit={canEdit}
            canLinkAccount={canLinkCustomerAccount}
            customer={selectedCustomer}
            linkedRegisteredUserIds={linkedRegisteredUserIds}
            onAddOtherName={onAddCustomerOtherName}
            onDeleteCustomer={() => setCustomerToDelete(selectedCustomer)}
            onEditCustomer={() => setCustomerToEdit(selectedCustomer)}
            onLinkRegisteredUser={onLinkCustomerAccount}
            pendingKey={pendingKey}
            profilesById={profilesById}
            registeredAccounts={registeredAccounts}
          />
        ) : null}
      </DashboardDialog>

      <DashboardDialog
        description={uiText("attribute003")}
        onOpenChange={(open) => {
          if (!open) setCustomerToEdit(null);
        }}
        open={Boolean(customerToEdit)}
        title={uiText("attribute004")}
      >
        {customerToEdit ? (
          <WholesaleCustomerForm
            canAssignSalesUser={canAssignSalesUser}
            currentUserId={currentUserId}
            customer={customerToEdit}
            mode="edit"
            onSaved={() => setCustomerToEdit(null)}
            onSubmit={onUpdateCustomer}
            pending={pendingKey === `customer:update:${customerToEdit.id}`}
            profilesById={profilesById}
            salesAccounts={salesAccounts}
          />
        ) : null}
      </DashboardDialog>

      <WholesaleCustomerDeleteDialog
        key={customerToDelete?.id}
        customer={customerToDelete}
        onDeleteCustomer={async (customerId, onError) => {
          const deleted = await onDeleteCustomer(customerId, onError);
          if (deleted) {
            onSelectedCustomerIdChange(null);
          }
          return deleted;
        }}
        onOpenChange={(open) => {
          if (!open) setCustomerToDelete(null);
        }}
        open={Boolean(customerToDelete)}
        pending={Boolean(
          customerToDelete &&
          pendingKey === `customer:delete:${customerToDelete.id}`,
        )}
      />
    </>
  );
}
