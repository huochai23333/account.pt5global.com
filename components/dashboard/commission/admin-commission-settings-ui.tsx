"use client";

import type { ReactNode } from "react";
import { History, Pencil, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardTableFrame } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { RecordCard } from "@/components/ui/data-display";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import type {
  BusinessParameterSetting,
  BusinessParameterVersion,
} from "@/lib/commission-settings";

import {
  COMMISSION_RULE_DEFINITIONS,
  formatCommissionSettingValue,
  getRuleConfigValue,
  type CommissionRuleDefinition,
} from "./commission-settings-display";

export function BusinessParameterSettingsTable({
  locale,
  onCancelSchedule,
  onEdit,
  onHistory,
  pendingKey,
  settings,
}: {
  locale: string;
  onCancelSchedule: (setting: BusinessParameterSetting) => void;
  onEdit: (setting: BusinessParameterSetting) => void;
  onHistory: (setting: BusinessParameterSetting) => void;
  pendingKey: string | null;
  settings: BusinessParameterSetting[];
}) {
  const t = useTranslations("Commission.settings");
  const rows = settings.flatMap((setting) => {
    const definition = COMMISSION_RULE_DEFINITIONS.find(
      (item) => item.code === setting.parameterCode,
    );
    return definition ? [{ definition, setting }] : [];
  });

  return (
    <ResponsiveDataView
      desktop={
        <DashboardTableFrame>
          <table className="w-full min-w-[1040px] table-fixed border-collapse">
            <thead className="bg-surface-inset">
              <tr className="border-b border-border-subtle">
                <HeaderCell className="w-[24%]">{t("table.rule")}</HeaderCell>
                <HeaderCell className="w-[27%]">{t("table.value")}</HeaderCell>
                <HeaderCell className="w-[27%]">
                  {t("table.schedule")}
                </HeaderCell>
                <HeaderCell className="w-[22%] text-right">
                  {t("table.actions")}
                </HeaderCell>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ definition, setting }) => (
                <tr
                  className="border-b border-border-subtle align-top last:border-b-0"
                  data-testid={`business-parameter-row-${setting.parameterCode}`}
                  key={setting.parameterCode}
                >
                  <td className="px-5 py-5">
                    <RuleIdentity definition={definition} />
                  </td>
                  <td className="px-5 py-5">
                    <VersionSummary
                      definition={definition}
                      locale={locale}
                      version={setting.currentVersion}
                    />
                  </td>
                  <td className="px-5 py-5">
                    {setting.scheduledVersion ? (
                      <VersionSummary
                        definition={definition}
                        locale={locale}
                        version={setting.scheduledVersion}
                      />
                    ) : (
                      <span className="text-sm text-content-subtle">
                        {t("schedule.none")}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-5">
                    <RuleActions
                      hasSchedule={Boolean(setting.scheduledVersion)}
                      onCancelSchedule={() => onCancelSchedule(setting)}
                      onEdit={() => onEdit(setting)}
                      onHistory={() => onHistory(setting)}
                      pending={pendingKey !== null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardTableFrame>
      }
      mobile={
        <div className="grid gap-4">
          {rows.map(({ definition, setting }) => (
            <RecordCard
              data-testid={`business-parameter-card-${setting.parameterCode}`}
              key={setting.parameterCode}
            >
              <RuleIdentity definition={definition} />
              <MobileField label={t("table.value")}>
                <VersionSummary
                  definition={definition}
                  locale={locale}
                  version={setting.currentVersion}
                />
              </MobileField>
              <MobileField label={t("table.schedule")}>
                {setting.scheduledVersion ? (
                  <VersionSummary
                    definition={definition}
                    locale={locale}
                    version={setting.scheduledVersion}
                  />
                ) : (
                  <span className="text-sm text-content-subtle">
                    {t("schedule.none")}
                  </span>
                )}
              </MobileField>
              <RuleActions
                hasSchedule={Boolean(setting.scheduledVersion)}
                onCancelSchedule={() => onCancelSchedule(setting)}
                onEdit={() => onEdit(setting)}
                onHistory={() => onHistory(setting)}
                pending={pendingKey !== null}
              />
            </RecordCard>
          ))}
        </div>
      }
    />
  );
}

export function ParameterValueList({
  config,
  definition,
  locale,
}: {
  config: BusinessParameterVersion["config"];
  definition: CommissionRuleDefinition;
  locale: string;
}) {
  const t = useTranslations("Commission.settings");
  const ruleText = useTranslations("Commission");
  return (
    <div className="grid min-w-0 gap-1.5 text-sm leading-6">
      {definition.fields.map((field) => {
        const value = getRuleConfigValue(config, field.configKey);
        return (
          <div
            className="flex min-w-0 justify-between gap-3"
            key={field.configKey}
          >
            <span className="break-words text-xs font-semibold text-content-muted">
              {ruleText(field.labelKey)}
            </span>
            <span className="break-words text-right font-semibold text-content-strong [overflow-wrap:anywhere]">
              {value === null
                ? t("table.missing")
                : formatCommissionSettingValue(field.kind, value, locale)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VersionSummary({
  definition,
  locale,
  version,
}: {
  definition: CommissionRuleDefinition;
  locale: string;
  version: BusinessParameterVersion;
}) {
  const t = useTranslations("Commission.settings");
  return (
    <div className="min-w-0 space-y-3">
      <ParameterValueList
        config={version.config}
        definition={definition}
        locale={locale}
      />
      <div className="space-y-1 break-words text-xs leading-5 text-content-muted [overflow-wrap:anywhere]">
        <p>{t("version.number", { version: version.versionNumber })}</p>
        <p>
          {t("version.effective", {
            time: formatShanghaiTime(version.effectiveFrom, locale),
          })}
        </p>
        <p>{t("version.reason", { reason: version.changeReason })}</p>
        <p>
          {t("version.publisher", {
            name:
              version.publisherName ||
              version.publisherEmail ||
              t("version.migrationPublisher"),
          })}
        </p>
      </div>
    </div>
  );
}

function RuleIdentity({
  definition,
}: {
  definition: CommissionRuleDefinition;
}) {
  const ruleText = useTranslations("Commission");
  return (
    <div className="min-w-0">
      <h3 className="break-words text-sm font-semibold leading-6 text-content-strong">
        {ruleText(definition.labelKey)}
      </h3>
      <p className="mt-1 break-words text-xs leading-5 text-content-muted">
        {ruleText(definition.descriptionKey)}
      </p>
    </div>
  );
}

function RuleActions({
  hasSchedule,
  onCancelSchedule,
  onEdit,
  onHistory,
  pending,
}: {
  hasSchedule: boolean;
  onCancelSchedule: () => void;
  onEdit: () => void;
  onHistory: () => void;
  pending: boolean;
}) {
  const t = useTranslations("Commission.settings");
  return (
    <div className="flex min-w-0 flex-wrap justify-end gap-2 max-sm:justify-start">
      <Button
        disabled={pending}
        onClick={onEdit}
        size="compact"
        type="button"
        variant="outline"
        wrap
      >
        <Pencil className="size-4" />
        {t("actions.edit")}
      </Button>
      <Button
        disabled={pending}
        onClick={onHistory}
        size="compact"
        type="button"
        variant="outline"
        wrap
      >
        <History className="size-4" />
        {t("actions.history")}
      </Button>
      {hasSchedule ? (
        <Button
          disabled={pending}
          onClick={onCancelSchedule}
          size="compact"
          type="button"
          variant="outline"
          wrap
        >
          <XCircle className="size-4" />
          {t("actions.cancelSchedule")}
        </Button>
      ) : null}
    </div>
  );
}

function MobileField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="mt-4 min-w-0">
      <p className="mb-2 font-label text-[10px] font-semibold tracking-[0.14em] text-content-muted uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function HeaderCell({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <th
      className={`px-5 py-4 text-left font-label text-[11px] font-semibold tracking-[0.18em] text-content-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}

export function formatShanghaiTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
