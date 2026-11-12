"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { PersonPrivateNoteDialog } from "@/components/dashboard/person-notes/person-private-note-dialog";
import type { SalesmanPeoplePageData } from "@/lib/salesman-people-contract";

import {
  SalesmanPeopleDirectorySection,
  SalesmanPeopleHeaderSection,
  SalesmanPeopleNoPermissionSection,
} from "./salesman-people-sections";
import { SalesmanCustomerTypeDialog } from "./salesman-customer-type-dialog";
import { useSalesmanPeopleViewModel } from "./use-salesman-people-view-model";

export function SalesmanPeopleClient({
  initialData,
}: {
  initialData: SalesmanPeoplePageData;
}) {
  const { locale } = useLocale();
  const viewModel = useSalesmanPeopleViewModel({ initialData });

  return (
    <DashboardPageShell
      feedback={viewModel.feedback}
      header={
        <SalesmanPeopleHeaderSection
          summary={viewModel.summary}
        />
      }
    >
      {!viewModel.hasPermission ? (
        <SalesmanPeopleNoPermissionSection />
      ) : (
        <>
          <SalesmanPeopleDirectorySection
            customerTypeLabels={viewModel.customerTypeLabels}
            filteredCustomers={viewModel.filteredCustomers}
            locale={locale}
            onAdjustCustomerType={viewModel.openCustomerTypeDialog}
            onEditCustomerNote={viewModel.personNoteEditor.openNoteDialog}
            onReset={() => viewModel.setSearchText("")}
            onSearchTextChange={viewModel.setSearchText}
            searchText={viewModel.searchText}
          />

          <SalesmanCustomerTypeDialog
            canSave={viewModel.canSaveDraft}
            customer={viewModel.selectedCustomer}
            customerTypeLabels={viewModel.customerTypeLabels}
            customerTypeOptions={viewModel.customerTypeOptions}
            draftType={viewModel.draftType}
            onClose={viewModel.closeCustomerTypeDialog}
            onDraftTypeChange={viewModel.handleDraftTypeChange}
            onSave={() => void viewModel.handleSaveCustomerType()}
            open={viewModel.dialogOpen}
            saving={viewModel.saving}
          />

          <PersonPrivateNoteDialog
            canSave={viewModel.personNoteEditor.canSave}
            draftNote={viewModel.personNoteEditor.draftNote}
            onClose={viewModel.personNoteEditor.closeNoteDialog}
            onDraftNoteChange={viewModel.personNoteEditor.handleDraftNoteChange}
            onSave={() => void viewModel.personNoteEditor.handleSaveNote()}
            open={viewModel.personNoteEditor.noteDialogOpen}
            saving={viewModel.personNoteEditor.saving}
            targetName={viewModel.personNoteEditor.selectedTargetName}
          />
        </>
      )}
    </DashboardPageShell>
  );
}
