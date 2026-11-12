/** 线索大厅：组合或展示本模块已准备的数据；交互回调沿上层状态与服务处理，不在展示中重新实现业务规则。 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  DashboardFormField,
  DashboardFormTextarea,
  FormDialog,
} from "@/components/dashboard/dashboard-form-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import type { SalesLeadPerson } from "@/lib/sales-leads-types";

import type { LeadAction, LeadActionInput } from "./use-sales-lead-actions";

const CHANNELS = ["phone", "email", "whatsapp", "social", "video", "other"] as const;
const OUTCOMES = [
  "reached",
  "no_reply",
  "interested",
  "follow_up",
  "not_interested",
  "invalid_contact",
  "other",
] as const;

export function SalesLeadActionDialog({
  action,
  errorCode,
  leadId,
  onClose,
  onSubmit,
  pending,
  salespeople,
}: {
  action: LeadAction | null;
  errorCode: string | null;
  leadId: string | null;
  onClose: () => void;
  onSubmit: (input: LeadActionInput) => Promise<boolean>;
  pending: boolean;
  salespeople: SalesLeadPerson[];
}) {
  const t = useTranslations("SalesLeads");
  const [reason, setReason] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("phone");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>("reached");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");

  useEffect(() => {
    setReason("");
    setNextFollowUpAt("");
    setAssigneeUserId(salespeople[0]?.user_id ?? "");
  }, [action, salespeople]);

  const peopleOptions = useMemo(
    () => salespeople.map((person) => ({ label: person.name, value: person.user_id })),
    [salespeople],
  );
  if (!action || !leadId) return null;

  const isContact = action === "contact";
  const title = t(`dialogs.${action}.title`);
  const noteLabel = isContact ? t("fields.contactNote") : t(`dialogs.${action}.reasonLabel`);
  const canSubmit = reason.trim().length >= 2 && (action !== "assign" || Boolean(assigneeUserId));

  return (
    <FormDialog
      cancelLabel={t("actions.cancel")}
      description={t(`dialogs.${action}.description`)}
      feedback={errorCode ? { message: t(`errors.${errorCode}`), tone: "error" } : null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={() =>
        void onSubmit({
          action,
          leadId,
          reason,
          assigneeUserId,
          contact: isContact
            ? {
                channel,
                outcome,
                note: reason,
                nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null,
              }
            : undefined,
        })
      }
      open
      pending={pending}
      submitDisabled={!canSubmit}
      submitLabel={t(`dialogs.${action}.submit`)}
      submitTestId={`submit-lead-${action}`}
      title={title}
    >
      {isContact ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <DashboardFormField label={t("fields.channel")} required>
            <Select
              onValueChange={setChannel}
              options={CHANNELS.map((value) => ({ value, label: t(`channels.${value}`) }))}
              value={channel}
            />
          </DashboardFormField>
          <DashboardFormField label={t("fields.outcome")} required>
            <Select
              onValueChange={setOutcome}
              options={OUTCOMES.map((value) => ({ value, label: t(`outcomes.${value}`) }))}
              value={outcome}
            />
          </DashboardFormField>
          <DashboardFormField className="sm:col-span-2" label={t("fields.nextFollowUp")}>
            <DatePicker
              min={new Date().toISOString().slice(0, 16)}
              mode="datetime-local"
              onValueChange={setNextFollowUpAt}
              value={nextFollowUpAt}
            />
          </DashboardFormField>
        </div>
      ) : null}
      {action === "assign" ? (
        <DashboardFormField label={t("fields.assignee")} required>
          <Select
            onValueChange={setAssigneeUserId}
            options={peopleOptions}
            placeholder={t("dialogs.assign.personPlaceholder")}
            value={assigneeUserId || null}
          />
        </DashboardFormField>
      ) : null}
      <DashboardFormField label={noteLabel} required>
        <DashboardFormTextarea
          data-testid="sales-lead-action-note"
          maxLength={4000}
          minLength={2}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t(`dialogs.${action}.notePlaceholder`)}
          required
          value={reason}
        />
      </DashboardFormField>
    </FormDialog>
  );
}
