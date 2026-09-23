"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { PersonPrivateNoteDialog } from "@/components/dashboard/person-notes/person-private-note-dialog";
import type { AdminPeoplePageData } from "@/lib/admin-people";

import { AdminPeopleAccountDialog } from "./admin-people-account-dialog";
import {
  AdminPeopleDirectorySection,
  AdminPeopleHeaderSection,
  AdminPeopleNoPermissionSection,
  AdminPeopleRecentChangesSection,
} from "./admin-people-sections";
import { useAdminPeopleViewModel } from "./use-admin-people-view-model";

export function AdminPeopleClient({
  initialData,
}: {
  initialData: AdminPeoplePageData;
}) {
  const { locale } = useLocale();
  const viewModel = useAdminPeopleViewModel({ initialData });

  return (
    <DashboardPageShell
      feedback={viewModel.feedback}
      header={<AdminPeopleHeaderSection summary={viewModel.summary} />}
    >
      {!viewModel.hasPermission ? (
        <AdminPeopleNoPermissionSection />
      ) : (
        <>
          <AdminPeopleDirectorySection
            currentViewerId={viewModel.currentViewerId}
            filteredPeople={viewModel.filteredPeople}
            onAdjustPerson={viewModel.openAccountDialog}
            onEditPersonNote={viewModel.personNoteEditor.openNoteDialog}
            onReset={() => {
              viewModel.setSearchText("");
              viewModel.handleRoleFilterChange("all");
              viewModel.handleStatusFilterChange("all");
            }}
            onRoleFilterChange={viewModel.handleRoleFilterChange}
            onSearchTextChange={viewModel.setSearchText}
            onStatusFilterChange={viewModel.handleStatusFilterChange}
            roleFilter={viewModel.roleFilter}
            roleLabels={viewModel.roleLabels}
            roleOptions={viewModel.roleOptions}
            searchText={viewModel.searchText}
            statusFilter={viewModel.statusFilter}
            statusLabels={viewModel.statusLabels}
            statusOptions={viewModel.statusOptions}
          />

          <AdminPeopleRecentChangesSection
            changes={viewModel.recentChanges}
            locale={locale}
            roleLabels={viewModel.roleLabels}
            statusLabels={viewModel.statusLabels}
          />

          <AdminPeopleAccountDialog
            canSaveDraft={viewModel.canSaveDraft}
            draftCity={viewModel.draftCity}
            draftNote={viewModel.draftNote}
            draftRole={viewModel.draftRole}
            draftStatus={viewModel.draftStatus}
            locale={locale}
            onClose={viewModel.closeAccountDialog}
            onDraftCityChange={viewModel.handleDraftCityChange}
            onDraftNoteChange={viewModel.setDraftNote}
            onDraftRoleChange={viewModel.handleDraftRoleChange}
            onDraftStatusChange={viewModel.handleDraftStatusChange}
            onSave={() => void viewModel.handleSaveAccountChange()}
            onRetryAuthSync={() => void viewModel.handleRetryAuthSync()}
            open={viewModel.dialogOpen}
            person={viewModel.selectedPerson}
            roleLabels={viewModel.roleLabels}
            roleOptions={viewModel.roleOptions}
            saving={viewModel.saving}
            selectedPersonIsCurrentViewer={
              viewModel.selectedPersonIsCurrentViewer
            }
            selectedPersonAuthSyncPending={viewModel.selectedPersonAuthSyncPending}
            selectedPersonName={viewModel.selectedPersonName}
            statusLabels={viewModel.statusLabels}
            statusOptions={viewModel.statusOptions}
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
