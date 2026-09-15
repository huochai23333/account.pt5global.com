"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import type {
  SystemHealthAlert,
  SystemOperationHealth,
  SystemOperationSummary,
} from "@/lib/system-operation-health";
import { cn } from "@/lib/utils";

type SystemHealthSectionsProps = {
  data: SystemOperationHealth;
  error: string | null;
  locale: string;
  onAcknowledge: (alertId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  pending: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  failed: "bg-status-danger-soft text-status-danger",
  needs_attention: "bg-status-danger-soft text-status-danger",
  partial_failed: "bg-status-warning-soft text-status-warning",
  queued: "bg-status-info-soft text-brand-hover",
  running: "bg-status-info-soft text-brand-hover",
  skipped: "bg-surface-inset text-content-muted",
  succeeded: "bg-status-success-soft text-status-success",
  never_run: "bg-surface-inset text-content-muted",
};

export function SystemHealthSections({
  data,
  error,
  locale,
  onAcknowledge,
  onRefresh,
  pending,
}: SystemHealthSectionsProps) {
  const t = useTranslations("SystemHealth");
  const runningCount = data.operations.filter((item) =>
    item.status === "queued" || item.status === "running"
  ).length;

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-5">
      <Surface className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-hover">{t("eyebrow")}</p>
          <h2 className="mt-1 text-2xl font-bold text-primary sm:text-3xl">{t("title")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-content-muted">{t("description")}</p>
        </div>
        <DesignButton
          className="min-h-11 shrink-0 rounded-2xl bg-primary px-4 text-white"
          disabled={pending === "refresh"}
          onClick={() => void onRefresh()}
          type="button"
        >
          {pending === "refresh" ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {t("refresh")}
        </DesignButton>
      </Surface>

      {error ? <p className="rounded-2xl bg-status-danger-soft p-4 text-sm text-status-danger">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={AlertTriangle} label={t("attention")} value={data.attentionCount} />
        <SummaryCard icon={Clock3} label={t("processing")} value={runningCount} />
        <SummaryCard icon={CheckCircle2} label={t("registered")} value={data.operations.length} />
      </section>

      <AlertSection alerts={data.alerts} onAcknowledge={onAcknowledge} pending={pending} />
      <OperationSection locale={locale} operations={data.operations} />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof AlertTriangle; label: string; value: number }) {
  return (
    <Surface as="div" className="flex items-center gap-3" padding="compact">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-inset text-brand-hover"><Icon className="size-5" /></span>
      <div className="min-w-0"><p className="truncate text-sm text-content-muted">{label}</p><p className="text-2xl font-bold text-primary">{value}</p></div>
    </Surface>
  );
}

function AlertSection({ alerts, onAcknowledge, pending }: { alerts: SystemHealthAlert[]; onAcknowledge: (id: string) => Promise<void>; pending: string | null }) {
  const t = useTranslations("SystemHealth");
  return (
    <Surface>
      <h3 className="text-lg font-bold text-primary">{t("alertsTitle")}</h3>
      <div className="mt-4 grid gap-3">
        {alerts.length === 0 ? <p className="rounded-2xl bg-status-success-soft p-4 text-sm text-status-success">{t("noAlerts")}</p> : alerts.map((alert) => (
          <article className="flex flex-col gap-3 rounded-2xl border border-border-subtle p-4 sm:flex-row sm:items-start sm:justify-between" key={alert.id}>
            <div className="min-w-0"><p className="font-semibold text-primary">{alert.title}</p><p className="mt-1 break-words text-sm leading-6 text-content-muted">{alert.message}</p><p className="mt-1 text-xs text-content-muted">{t("occurrences", { count: alert.occurrenceCount })}</p></div>
            {alert.status === "open" ? <DesignButton className="min-h-10 shrink-0 rounded-xl border border-border-subtle px-3" disabled={pending === alert.id} onClick={() => void onAcknowledge(alert.id)} type="button">{pending === alert.id ? <LoaderCircle className="size-4 animate-spin" /> : null}{t("acknowledge")}</DesignButton> : <span className="shrink-0 text-sm text-content-muted">{t("acknowledged")}</span>}
          </article>
        ))}
      </div>
    </Surface>
  );
}

function OperationSection({ locale, operations }: { locale: string; operations: SystemOperationSummary[] }) {
  const t = useTranslations("SystemHealth");
  return (
    <Surface>
      <h3 className="text-lg font-bold text-primary">{t("operationsTitle")}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {operations.map((operation) => (
          <article className="min-w-0 rounded-2xl border border-border-subtle p-4" key={operation.operationKey}>
            <div className="flex min-w-0 items-start justify-between gap-3"><h4 className="min-w-0 break-words font-semibold text-primary">{operation.displayName}</h4><span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[operation.status] ?? STATUS_STYLE.never_run)}>{t(`status.${operation.status}`)}</span></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><Metric label={t("attempts")} value={String(operation.attemptCount)} /><Metric label={t("resultCount")} value={`${operation.succeededCount}/${operation.expectedCount ?? "—"}`} /><Metric label={t("failedCount")} value={String(operation.failedCount)} /><Metric label={t("completedAt")} value={formatDate(operation.completedAt, locale, t("notCompleted"))} /></dl>
            {operation.lastErrorMessage ? <p className="mt-3 break-words rounded-xl bg-status-danger-soft p-3 text-sm leading-6 text-status-danger">{operation.lastErrorMessage}</p> : null}
          </article>
        ))}
      </div>
    </Surface>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-content-muted">{label}</dt><dd className="mt-1 break-words font-medium text-primary">{value}</dd></div>;
}

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
