"use client";

import { RefreshCw, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, InteractiveButton } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import type { MailQuarantineItem, MailThreadDetail } from "@/lib/mail/mail-types";
import { cn } from "@/lib/utils";

import { formatMailTime } from "./mail-display";

export function MailQuarantinePanel(props: {
  items: MailQuarantineItem[];
  detail: MailThreadDetail | null;
  busy: string | null;
  onOpen: (threadId: string) => void;
  onRestore: (item: MailQuarantineItem) => void;
  onDelete: (item: MailQuarantineItem) => void;
  onRefresh: () => void;
}) {
  const t = useTranslations("MailWorkspace");
  const selectedItem = props.detail ? props.items.find((item) => item.id === props.detail?.id) ?? null : null;
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.6fr)]" data-testid="mail-quarantine-panel">
      <Surface className="flex min-h-[36rem] flex-col overflow-hidden" padding={null}>
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle p-3 sm:p-4">
          <div><h2 className="flex items-center gap-2 text-lg font-bold text-content-strong"><ShieldCheck className="size-5" />{t("quarantine")}</h2><p className="mt-1 text-xs leading-5 text-content-muted">{t("quarantineDescription")}</p></div>
          <Button aria-label={t("refreshQuarantine")} className="shrink-0" disabled={props.busy !== null} onClick={props.onRefresh} size="compact" type="button" variant="outline"><RefreshCw className={cn("size-4", props.busy === "quarantine:refresh" && "animate-spin")} /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {props.items.length === 0 ? <p className="p-8 text-center text-sm text-content-muted">{t("emptyQuarantine")}</p> : props.items.map((item) => (
            <InteractiveButton className={cn("mb-2 block w-full rounded-surface-inset border p-3 text-left", props.detail?.id === item.id ? "border-ring bg-surface-interactive" : "border-border-subtle hover:bg-surface-inset")} key={item.id} onClick={() => props.onOpen(item.id)} type="button">
              <p className="break-words text-sm font-bold text-content-strong">{item.subject}</p>
              <p className="mt-1 truncate text-xs text-content-muted">{item.customerEmail}</p>
              <p className="mt-2 break-words text-xs text-status-warning">{item.reason}</p>
              <time className="mt-2 block text-xs text-content-muted">{formatMailTime(item.quarantinedAt)}</time>
            </InteractiveButton>
          ))}
        </div>
      </Surface>
      <Surface className="flex min-h-[36rem] flex-col overflow-hidden" padding={null}>
        {!props.detail ? <div className="flex min-h-80 flex-1 items-center justify-center p-6 text-center text-sm text-content-muted">{t("selectQuarantine")}</div> : <>
          <header className="border-b border-border-subtle p-3 sm:p-4">
            <h2 className="break-words text-xl font-bold text-content-strong">{props.detail.subject}</h2>
            <p className="mt-1 break-all text-sm text-content-muted">{props.detail.customerEmail}</p>
            {selectedItem ? <div className="mt-3 flex flex-wrap gap-2"><Button disabled={props.busy !== null} onClick={() => props.onRestore(selectedItem)} size="compact" type="button"><RotateCcw className="size-4" />{t("restoreToWorkspace")}</Button><Button disabled={props.busy !== null} onClick={() => props.onDelete(selectedItem)} size="compact" type="button" variant="outline"><Trash2 className="size-4" />{t("deleteCopy")}</Button></div> : null}
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-inset/40 p-3 sm:p-4">
            {props.detail.messages.map((message) => <article className="max-w-[92%] rounded-surface-inset border border-border-subtle bg-surface-panel p-3 sm:max-w-[82%]" key={message.id}><div className="flex min-w-0 flex-wrap gap-2 text-xs text-content-muted"><span className="break-all font-semibold">{message.from}</span><time className="ml-auto">{formatMailTime(message.occurredAt)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-content-strong">{message.textBody || t("formattedOnly")}</p>{message.attachments.length > 0 ? <ul className="mt-3 space-y-1 text-xs text-content-muted">{message.attachments.map((attachment) => <li className="break-all" key={attachment.id}>{attachment.available ? <a className="font-semibold text-primary underline underline-offset-2" href={`/api/mail/attachments/${attachment.id}`}>{attachment.filename}</a> : attachment.filename}</li>)}</ul> : null}</article>)}
          </div>
        </>}
      </Surface>
    </div>
  );
}
