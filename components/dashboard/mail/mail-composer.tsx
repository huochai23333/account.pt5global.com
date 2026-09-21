"use client";

import { Bot, LoaderCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";

import type { ComposerState } from "./use-mail-workspace";

export function MailComposer(props: {
  value: ComposerState;
  busy: string | null;
  canSuggest: boolean;
  aiDraft: string;
  onChange: (value: ComposerState) => void;
  onFiles: (files: File[]) => void;
  onSend: () => void;
  onSuggest: () => void;
}) {
  const t = useTranslations("MailWorkspace");
  const set = (key: keyof ComposerState, value: string) => props.onChange({ ...props.value, [key]: value });
  const hasUnsafeAttachment = props.value.attachments.some((item) => item.status !== "clean");
  return (
    <section className="border-t border-border-subtle p-3 sm:p-4" data-testid="mail-composer">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field label={t("recipient")}><Input onChange={(event) => set("to", event.target.value)} placeholder={t("recipientPlaceholder")} value={props.value.to} /></Field>
        <Field label={t("cc")}><Input onChange={(event) => set("cc", event.target.value)} placeholder={t("multipleEmails")} value={props.value.cc} /></Field>
      </div>
      <details className="mt-3 text-sm text-content-muted"><summary className="cursor-pointer font-semibold">{t("addBcc")}</summary><Field className="mt-2" label={t("addBcc")} labelHidden><Input onChange={(event) => set("bcc", event.target.value)} placeholder={t("bccPlaceholder")} value={props.value.bcc} /></Field></details>
      <Field className="mt-3" label={t("subject")}><Input disabled={props.value.mode === "reply"} onChange={(event) => set("subject", event.target.value)} value={props.value.subject} /></Field>
      <Field className="mt-3" label={t("body")}><Textarea className="min-h-40" onChange={(event) => set("body", event.target.value)} value={props.value.body} /></Field>
      {props.value.attachments.length > 0 ? <ul className="mt-3 space-y-1 text-xs text-content-muted">{props.value.attachments.map((item) => <li className="break-all" key={item.id}>{item.name} · {item.status === "clean" ? t("attachmentReady") : t("attachmentChecking")}</li>)}</ul> : null}
      <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <DashboardFilePicker disabled={props.busy !== null} label={t("addAttachment")} multiple onFiles={props.onFiles} />
        {props.canSuggest ? <Button disabled={props.busy !== null} onClick={props.onSuggest} type="button" variant="outline">{props.busy === "ai-reply" ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}{t("suggestReply")}</Button> : null}
        <Button className="sm:ml-auto" disabled={props.busy !== null || hasUnsafeAttachment || !props.value.to.trim() || !props.value.subject.trim() || !props.value.body.trim()} onClick={props.onSend} type="button">
          {props.busy === "send" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{props.busy === "send" ? t("confirmingSend") : t("sendMail")}
        </Button>
      </div>
      {props.aiDraft ? <p className="mt-3 text-xs leading-5 text-content-muted">{t("editableSuggestion")}</p> : null}
    </section>
  );
}
