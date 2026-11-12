"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientBusinessAddDialog } from "@/components/dashboard/client-business-add-dialog";
import { useTranslations } from "next-intl";
import type { ClientBusinessCandidate } from "@/lib/client-business-access";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import { WholesaleCustomerDialogs } from "./wholesale-customer-dialogs";
import type { DeleteWholesaleCustomerAction, SubmitWholesaleCustomerForm } from "./wholesale-customer-actions";
import type { AddRegisteredWholesaleCustomer } from "./wholesale-customer-account-actions";
import { WholesaleCustomerPeopleTab } from "./wholesale-people-tabs";
import { WholesalePageShell } from "./wholesale-ui";
import { ALL_DIRECTORY_ITEMS as ALL, filterWholesaleCustomers } from "./wholesale-people-filters";
type WholesaleCustomersSectionProps = {
  businessAddCandidates: ClientBusinessCandidate[];
  businessAddCandidatesUnavailable: boolean;
  canAssignSalesUser: boolean;
  canAddRegisteredCustomer: boolean;
  canEdit: boolean;
  canLinkCustomerAccount: boolean;
  currentUserId: string | null;
  customers: WholesaleCustomer[];
  onAddCustomerOtherName: (formData: FormData) => Promise<boolean>;
  onAddRegisteredCustomer: AddRegisteredWholesaleCustomer;
  onCreateCustomer: (formData: FormData) => boolean | Promise<boolean>;
  onDeleteCustomer: DeleteWholesaleCustomerAction;
  onLinkCustomerAccount: SubmitWholesaleCustomerForm;
  onUpdateCustomer: SubmitWholesaleCustomerForm;
  pendingKey: string | null;
  profilesById: Map<string, WholesaleProfile>;
  registeredAccounts: WholesaleProfile[];
  salesAccounts: WholesaleProfile[];
};
export function WholesaleCustomersSection({
  businessAddCandidates,
  businessAddCandidatesUnavailable,
  canAssignSalesUser,
  canAddRegisteredCustomer,
  canEdit,
  canLinkCustomerAccount,
  currentUserId,
  customers,
  onAddCustomerOtherName,
  onAddRegisteredCustomer,
  onCreateCustomer,
  onDeleteCustomer,
  onLinkCustomerAccount,
  onUpdateCustomer,
  pendingKey,
  profilesById,
  registeredAccounts,
  salesAccounts,
}: WholesaleCustomersSectionProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_customers_section",
  );
  const accessT = useTranslations("ClientBusinessAccess");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [businessAddDialogOpen, setBusinessAddDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerKindFilter, setCustomerKindFilter] = useState(ALL);
  const [customerSalesFilter, setCustomerSalesFilter] = useState(ALL);
  const linkedRegisteredUserIds = useMemo(
    () =>
      new Set(
        customers
          .map((customer) => customer.registered_user_id)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    [customers],
  );
  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );
  const filteredCustomers = useMemo(
    () => filterWholesaleCustomers(customers, profilesById, {
      search: customerSearch,
      kind: customerKindFilter,
      owner: customerSalesFilter,
    }),
    [customerKindFilter, customerSalesFilter, customerSearch, customers, profilesById],
  );
  const hasCustomerFilters =
    customerSearch || customerKindFilter !== ALL || customerSalesFilter !== ALL;
  return (
    <WholesalePageShell
      actions={
        canEdit || canAddRegisteredCustomer ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canAddRegisteredCustomer ? (
              <Button
                size="default"
                onClick={() => setBusinessAddDialogOpen(true)}
                type="button"
                variant="outline"
              >
                <Plus className="size-4" />
                {accessT("add")}
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                variant="primary"
                size="default"
                onClick={() => setCreateDialogOpen(true)}
                type="button"
              >
                <Plus className="size-4" />
                <UiMessage id="components_dashboard_wholesale_wholesale_customers_section.text001" />
              </Button>
            ) : null}
          </div>
        ) : null
      }
      title={uiText("attribute003")}
    >
      <WholesaleCustomerPeopleTab
        customerKindFilter={customerKindFilter}
        customerSalesFilter={customerSalesFilter}
        customerSearch={customerSearch}
        customers={customers}
        filteredCustomers={filteredCustomers}
        hasCustomerFilters={Boolean(hasCustomerFilters)}
        onCustomerKindFilterChange={setCustomerKindFilter}
        onCustomerSalesFilterChange={setCustomerSalesFilter}
        onCustomerSearchChange={setCustomerSearch}
        onResetCustomerFilters={() => {
          setCustomerSearch("");
          setCustomerKindFilter(ALL);
          setCustomerSalesFilter(ALL);
        }}
        onSelectCustomer={(customer) => setSelectedCustomerId(customer.id)}
        profilesById={profilesById}
        salesAccounts={salesAccounts}
      />

      <WholesaleCustomerDialogs
        canAssignSalesUser={canAssignSalesUser}
        canLinkCustomerAccount={canLinkCustomerAccount}
        canEdit={canEdit}
        createDialogOpen={createDialogOpen}
        currentUserId={currentUserId}
        linkedRegisteredUserIds={linkedRegisteredUserIds}
        onAddCustomerOtherName={onAddCustomerOtherName}
        onCreateCustomer={onCreateCustomer}
        onCreateDialogOpenChange={setCreateDialogOpen}
        onDeleteCustomer={onDeleteCustomer}
        onLinkCustomerAccount={onLinkCustomerAccount}
        onSelectedCustomerIdChange={setSelectedCustomerId}
        onUpdateCustomer={onUpdateCustomer}
        pendingKey={pendingKey}
        profilesById={profilesById}
        registeredAccounts={registeredAccounts}
        salesAccounts={salesAccounts}
        selectedCustomer={selectedCustomer}
        selectedCustomerId={selectedCustomerId}
      />

      <ClientBusinessAddDialog
        business="wholesale"
        candidates={businessAddCandidates}
        error={businessAddCandidatesUnavailable ? accessT("serviceUnavailable") : null}
        onAdd={onAddRegisteredCustomer}
        onOpenChange={setBusinessAddDialogOpen}
        open={businessAddDialogOpen}
        pendingUserId={
          pendingKey?.startsWith("customer:add-business:")
            ? pendingKey.replace("customer:add-business:", "")
            : null
        }
      />
    </WholesalePageShell>
  );
}
