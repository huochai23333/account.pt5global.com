"use client";

import * as FormControls from "@/components/ui/form-controls";
import { Select } from "@/components/ui/select";

import { LoaderCircle, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import {
  ADMIN_PEOPLE_CITY_MAX_LENGTH,
  type AdminPersonRow,
} from "@/lib/admin-people";
import type { Locale } from "@/lib/locale";

import { AdminPeopleAccountDetails } from "./admin-people-account-details";
import type { useAdminPeopleViewModel } from "./use-admin-people-view-model";

type AdminPeopleViewModel = ReturnType<typeof useAdminPeopleViewModel>;

export function AdminPeopleAccountDialog({
  canSaveDraft,
  draftCity,
  draftNote,
  draftRole,
  draftStatus,
  locale,
  onClose,
  onDraftCityChange,
  onDraftNoteChange,
  onDraftRoleChange,
  onDraftStatusChange,
  onSave,
  onRetryAuthSync,
  open,
  person,
  roleLabels,
  roleOptions,
  saving,
  selectedPersonIsCurrentViewer,
  selectedPersonAuthSyncPending,
  selectedPersonName,
  statusLabels,
  statusOptions,
}: {
  canSaveDraft: boolean;
  draftCity: string;
  draftNote: string;
  draftRole: string;
  draftStatus: string;
  locale: Locale;
  onClose: () => void;
  onDraftCityChange: (value: string) => void;
  onDraftNoteChange: (value: string) => void;
  onDraftRoleChange: (value: string) => void;
  onDraftStatusChange: (value: string) => void;
  onSave: () => void;
  onRetryAuthSync: () => void;
  open: boolean;
  person: AdminPersonRow | null;
  roleLabels: AdminPeopleViewModel["roleLabels"];
  roleOptions: AdminPeopleViewModel["roleOptions"];
  saving: boolean;
  selectedPersonIsCurrentViewer: boolean;
  selectedPersonAuthSyncPending: boolean;
  selectedPersonName: string;
  statusLabels: AdminPeopleViewModel["statusLabels"];
  statusOptions: AdminPeopleViewModel["statusOptions"];
}) {
  const t = useTranslations("AdminPeople");

  return (
    <DashboardDialog
      actions={
        <>
          <Button
            variant="outline"
            size="compact"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            size="compact"
            disabled={!canSaveDraft}
            onClick={onSave}
            type="button"
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? t("actions.saving") : t("actions.save")}
          </Button>
        </>
      }
      description={t("dialog.description")}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={open}
      title={t("dialog.title", {
        name: selectedPersonName || t("fallback.unnamedUser"),
      })}
    >
      {person ? (
        <div className="min-w-0 space-y-6">
          <AdminPeopleAccountDetails
            locale={locale}
            person={person}
            roleLabels={roleLabels}
            statusLabels={statusLabels}
          />

          {selectedPersonAuthSyncPending ? (
            <div className="rounded-control-default border border-border-subtle bg-surface-inset p-3">
              <p className="mb-3 text-sm text-content-muted">{t("feedback.authSyncPending")}</p>
              <Button disabled={saving} onClick={onRetryAuthSync} size="compact" type="button" variant="outline">
                {t("dialog.retryAuthSync")}
              </Button>
            </div>
          ) : null}

          <section className="min-w-0 border-t border-border-subtle pt-6">
            <div className="mb-4">
              <p className="text-sm font-semibold text-content-strong">
                {t("dialog.adjustTitle")}
              </p>
              <p className="mt-1 text-xs leading-6 text-content-muted">
                {t("dialog.adjustDescription")}
              </p>
            </div>

            <div className="min-w-0 space-y-5">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <FormControls.Field
                  className="min-w-0"
                  label={t("dialog.nextRole")}
                  required
                >
                  <Select
                    disabled={selectedPersonIsCurrentViewer || saving}
                    onValueChange={onDraftRoleChange}
                    options={roleOptions.map((role) => ({
                      label: roleLabels[role],
                      value: role,
                    }))}
                    value={draftRole}
                  />
                </FormControls.Field>

                <FormControls.Field
                  className="min-w-0"
                  label={t("dialog.nextStatus")}
                  required
                >
                  <Select
                    disabled={selectedPersonIsCurrentViewer || saving}
                    onValueChange={onDraftStatusChange}
                    options={statusOptions.map((status) => ({
                      label: statusLabels[status],
                      value: status,
                    }))}
                    value={draftStatus}
                  />
                </FormControls.Field>

                <FormControls.Field
                  className="min-w-0 sm:col-span-2"
                  label={t("dialog.nextCity")}
                >
                  <FormControls.Input
                    disabled={selectedPersonIsCurrentViewer || saving}
                    maxLength={ADMIN_PEOPLE_CITY_MAX_LENGTH}
                    onChange={(event) => onDraftCityChange(event.target.value)}
                    placeholder={t("dialog.cityPlaceholder")}
                    value={draftCity}
                  />
                </FormControls.Field>
              </div>

              <FormControls.Field className="min-w-0" label={t("dialog.note")}>
                <FormControls.Textarea
                  className="min-h-28"
                  disabled={selectedPersonIsCurrentViewer || saving}
                  maxLength={500}
                  onChange={(event) => onDraftNoteChange(event.target.value)}
                  placeholder={t("dialog.notePlaceholder")}
                  value={draftNote}
                />
              </FormControls.Field>
            </div>
          </section>
        </div>
      ) : null}
    </DashboardDialog>
  );
}
