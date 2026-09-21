"use client";

import { Inbox, MailOpen, Plus, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, InteractiveButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Surface } from "@/components/ui/surface";
import type { MailThreadListItem, MailThreadQuery, MailWorkspaceSummary } from "@/lib/mail/mail-types";
import { cn } from "@/lib/utils";

import { formatMailTime } from "./mail-display";

export function MailThreadList(props: {
  summary: MailWorkspaceSummary | null;
  threads: MailThreadListItem[];
  filters: MailThreadQuery;
  selectedId: string | null;
  isAdmin: boolean;
  busy: boolean;
  onFilter: (filters: MailThreadQuery) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const t = useTranslations("MailWorkspace");
  const stateLabel = (state: MailThreadListItem["state"]) => state === "waiting_pt5" ? t("waitingPt5") : state === "waiting_customer" ? t("waitingCustomer") : t("closed");
  const tabs = [
    { label: t("waitingPt5"), state: "waiting_pt5" as const, count: props.summary?.counts.waitingPt5 ?? 0 },
    { label: t("waitingCustomer"), state: "waiting_customer" as const, count: props.summary?.counts.waitingCustomer ?? 0 },
    { label: t("unread"), unread: true, count: props.summary?.counts.unread ?? 0 },
    { label: t("closed"), state: "closed" as const, count: props.summary?.counts.closed ?? 0 },
  ];
  return (
    <Surface className="flex min-h-[36rem] flex-col overflow-hidden" padding={null}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle p-3 sm:p-4">
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold text-content-strong"><Inbox className="size-5 shrink-0" />{t("threadTitle")}</h2>
        <Button onClick={props.onNew} size="compact" type="button"><Plus className="size-4" />{t("newMail")}</Button>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-border-subtle p-2" data-testid="mail-filters">
        {tabs.map((tab) => {
          const active = tab.state ? props.filters.state === tab.state : props.filters.unread === true;
          return (
            <Button
              className="shrink-0"
              key={tab.label}
              onClick={() => props.onFilter({ ...props.filters, state: tab.state, unread: tab.unread })}
              size="compact"
              type="button"
              variant={active ? "primary" : "outline"}
            >{tab.label} {tab.count}</Button>
          );
        })}
        {props.isAdmin ? (
          <Button className="shrink-0" onClick={() => props.onFilter({ scope: "unassigned", limit: 40 })} size="compact" type="button" variant={props.filters.scope === "unassigned" ? "primary" : "outline"}>
            {t("unassigned")} {props.summary?.counts.unassigned ?? 0}
          </Button>
        ) : null}
        <Button aria-label={t("refreshMail")} className="ml-auto shrink-0" disabled={props.busy} onClick={() => props.onFilter(props.filters)} size="compact" type="button" variant="outline"><RefreshCw className={cn("size-4", props.busy && "animate-spin")} /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {props.threads.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center text-content-muted"><MailOpen className="mb-3 size-8" /><p className="font-semibold">{t("emptyTitle")}</p><p className="mt-1 text-sm">{t("emptyDescription")}</p></div>
        ) : props.threads.map((thread) => (
          <InteractiveButton
            className={cn("mb-2 block w-full rounded-surface-inset border p-3 text-left", props.selectedId === thread.id ? "border-ring bg-surface-interactive" : "border-border-subtle hover:bg-surface-inset")}
            data-testid={`mail-thread-${thread.id}`}
            key={thread.id}
            onClick={() => props.onOpen(thread.id)}
            type="button"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className={cn("min-w-0 break-words text-sm text-content-strong", thread.unread ? "font-extrabold" : "font-semibold")}>{thread.subject}</p>
              {thread.unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={t("unread")} /> : null}
            </div>
            <p className="mt-1 truncate text-xs text-content-muted">{thread.customerEmail}</p>
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
              <StatusBadge tone={thread.state === "waiting_pt5" ? "warning" : thread.state === "closed" ? "neutral" : "info"}>{stateLabel(thread.state)}</StatusBadge>
              <span className="break-all text-xs text-content-muted">{thread.refCode}</span>
              <time className="ml-auto text-xs text-content-muted">{formatMailTime(thread.lastMessageAt)}</time>
            </div>
          </InteractiveButton>
        ))}
      </div>
    </Surface>
  );
}
