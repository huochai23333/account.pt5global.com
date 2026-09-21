"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import type {
  BusinessParameterSetting,
  BusinessParameterVersion,
} from "@/lib/commission-settings";

import { COMMISSION_RULE_DEFINITIONS } from "./commission-settings-display";
import {
  ParameterValueList,
  formatShanghaiTime,
} from "./admin-commission-settings-ui";

export function BusinessParameterHistoryDialog({
  locale,
  onClose,
  onRestore,
  pending,
  setting,
}: {
  locale: string;
  onClose: () => void;
  onRestore: (version: BusinessParameterVersion) => void;
  pending: boolean;
  setting: BusinessParameterSetting | null;
}) {
  const t = useTranslations("Commission.settings");
  const ruleText = useTranslations("Commission");
  if (!setting) return null;
  const definition = COMMISSION_RULE_DEFINITIONS.find(
    (item) => item.code === setting.parameterCode,
  );
  if (!definition) return null;

  return (
    <DashboardDialog
      actions={
        <Button onClick={onClose} type="button" variant="outline">
          {t("actions.close")}
        </Button>
      }
      description={t("history.description")}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("history.title", { name: ruleText(definition.labelKey) })}
    >
      <div className="grid gap-4">
        {setting.history.map((version) => (
          <article
            className="grid min-w-0 gap-4 rounded-surface-card border border-border-subtle p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
            data-testid={`business-parameter-history-${version.versionId}`}
            key={version.versionId}
          >
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-semibold text-content-strong">
                  {t("version.number", { version: version.versionNumber })}
                </span>
                <span className="rounded-full bg-surface-inset px-2.5 py-1 text-xs text-content-muted">
                  {t(`status.${version.status}`)}
                </span>
              </div>
              <ParameterValueList
                config={version.config}
                definition={definition}
                locale={locale}
              />
              <div className="mt-3 space-y-1 break-words text-xs leading-5 text-content-muted [overflow-wrap:anywhere]">
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
            <div>
              <Button
                disabled={
                  pending ||
                  version.status === "current" ||
                  version.status === "scheduled"
                }
                onClick={() => onRestore(version)}
                size="compact"
                type="button"
                variant="outline"
                wrap
              >
                <RotateCcw className="size-4" />
                {t("actions.restore")}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </DashboardDialog>
  );
}
