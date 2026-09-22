"use client";

import { Archive, Mail, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Surface } from "@/components/ui/surface";
import type { MailAgentProfile, MailThreadDetail, MailThreadState } from "@/lib/mail/mail-types";

import { formatMailTime } from "./mail-display";
import { MailComposer } from "./mail-composer";
import type { ComposerState } from "./use-mail-workspace";

export function MailThreadDetailPanel(props: {
  detail: MailThreadDetail | null;
  agents: MailAgentProfile[];
  composer: ComposerState;
  busy: string | null;
  aiDraft: string;
  canSend: boolean;
  onComposer: (value: ComposerState) => void;
  onFiles: (files: File[]) => void;
  onSend: () => void;
  onSuggest: () => void;
  onState: (state: MailThreadState) => void;
  onAssign: (memberId: string) => void;
  canDelete: boolean;
  onDelete: () => void;
  onQuarantine: () => void;
}) {
  const t = useTranslations("MailWorkspace");
  const stateLabel = (state: MailThreadState) => state === "waiting_pt5" ? t("waitingPt5") : state === "waiting_customer" ? t("waitingCustomer") : t("closed");
  if (!props.detail) {
    return (
      <Surface className="flex min-h-[36rem] flex-col" padding={null}>
        <div className="flex min-h-80 flex-1 flex-col items-center justify-center px-5 text-center text-content-muted"><Mail className="mb-3 size-9" /><h2 className="text-lg font-bold text-content-strong">{t("newTitle")}</h2><p className="mt-1 text-sm">{t("newDescription")}</p></div>
        <MailComposer aiDraft={props.aiDraft} busy={props.busy} canSend={props.canSend} canSuggest={false} onChange={props.onComposer} onFiles={props.onFiles} onSend={props.onSend} onSuggest={props.onSuggest} value={props.composer} />
      </Surface>
    );
  }
  return (
    <Surface className="flex min-h-[36rem] flex-col overflow-hidden" padding={null}>
      <header className="border-b border-border-subtle p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><h2 className="break-words text-xl font-bold text-content-strong">{props.detail.subject}</h2><p className="mt-1 break-all text-sm text-content-muted">{props.detail.customerEmail} · {props.detail.refCode}</p></div>
          <StatusBadge tone={props.detail.state === "waiting_pt5" ? "warning" : props.detail.state === "closed" ? "neutral" : "info"}>{stateLabel(props.detail.state)}</StatusBadge>
        </div>
        <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Field className="w-full sm:w-64" label={<span className="flex items-center gap-2"><UserRound className="size-4 shrink-0" />{t("assignee")}</span>}><Select disabled={props.busy !== null} onValueChange={props.onAssign} options={props.agents.map((agent) => ({ label: agent.displayName, value: agent.memberId }))} placeholder={t("selectAgent")} value={props.detail.assignedMemberId} /></Field>
          {(["waiting_pt5", "waiting_customer", "closed"] as MailThreadState[]).map((state) => <Button disabled={props.busy !== null || props.detail?.state === state} key={state} onClick={() => props.onState(state)} size="compact" type="button" variant="outline">{state === "closed" ? <Archive className="size-4" /> : null}{stateLabel(state)}</Button>)}
          {props.canDelete ? <Button disabled={props.busy !== null} onClick={props.onDelete} size="compact" type="button" variant="outline"><Trash2 className="size-4" />{t("deleteCopy")}</Button> : null}
          <Button disabled={props.busy !== null} onClick={props.onQuarantine} size="compact" type="button" variant="outline"><ShieldCheck className="size-4" />{t("moveToQuarantine")}</Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-inset/40 p-3 sm:p-4" data-testid="mail-messages">
        {props.detail.messages.map((message) => (
          <article className={`max-w-[92%] rounded-surface-inset border border-border-subtle p-3 sm:max-w-[82%] ${message.direction === "outbound" ? "ml-auto bg-surface-interactive" : "bg-surface-panel"}`} key={message.id}>
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-content-muted"><span className="break-all font-semibold">{message.from}</span><time className="ml-auto">{formatMailTime(message.occurredAt)}</time></div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-content-strong">{message.textBody || t("formattedOnly")}</p>
            {message.attachments.length > 0 ? <ul className="mt-3 space-y-1 text-xs text-content-muted">{message.attachments.map((item) => <li className="break-all" key={item.id}>{item.available ? <a className="font-semibold text-primary underline underline-offset-2" href={`/api/mail/attachments/${item.id}`}>{item.filename}</a> : item.filename} · {item.available ? t("downloadable") : t("securityChecking")}</li>)}</ul> : null}
          </article>
        ))}
      </div>
      <MailComposer aiDraft={props.aiDraft} busy={props.busy} canSend={props.canSend} canSuggest onChange={props.onComposer} onFiles={props.onFiles} onSend={props.onSend} onSuggest={props.onSuggest} value={props.composer} />
    </Surface>
  );
}
