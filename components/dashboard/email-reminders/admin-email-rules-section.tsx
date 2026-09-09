"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardSectionPanel } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { ChoiceField, Field, Input, Textarea } from "@/components/ui/form-controls";
import type { EmailPlatformRule } from "@/lib/emailconnect/emailconnect-types";

function splitList(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export function AdminEmailRulesSection({
  busy,
  onSave,
  onUpdate,
  rules,
}: {
  busy: boolean;
  onSave: () => void;
  onUpdate: (ruleId: string, patch: Partial<EmailPlatformRule>) => void;
  rules: EmailPlatformRule[];
}) {
  const t = useTranslations("EmailReminders");
  return (
    <DashboardSectionPanel ariaLabel={t("rulesTitle")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-content-strong">{t("rulesTitle")}</h3>
          <p className="mt-1 text-sm leading-6 text-content-muted">{t("rulesDescription")}</p>
        </div>
        <Button className="w-full sm:w-auto" disabled={busy} onClick={onSave} wrap>
          <Save className="size-4" />
          {t("saveRules")}
        </Button>
      </div>
      <div className="mt-5 grid gap-4">
        {rules.map((rule) => (
          <article className="grid min-w-0 gap-4 rounded-surface-inset border border-border-subtle p-4" key={rule.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Field className="min-w-0 flex-1" label={t("ruleName")}>
                <Input disabled={busy} onChange={(event) => onUpdate(rule.id, { name: event.target.value })} value={rule.name} />
              </Field>
              <ChoiceField
                checked={rule.enabled}
                disabled={busy}
                label={t("ruleEnabled")}
                onChange={(event) => onUpdate(rule.id, { enabled: event.target.checked })}
                rootClassName="sm:self-end"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field hint={t("domainsHint")} label={t("senderDomains")}>
                <Textarea disabled={busy} onChange={(event) => onUpdate(rule.id, { senderDomains: splitList(event.target.value) })} rows={3} value={rule.senderDomains.join("\n")} />
              </Field>
              <Field hint={t("keywordsHint")} label={t("subjectKeywords")}>
                <Textarea disabled={busy} onChange={(event) => onUpdate(rule.id, { subjectKeywords: splitList(event.target.value) })} rows={3} value={rule.subjectKeywords.join("\n")} />
              </Field>
            </div>
          </article>
        ))}
      </div>
    </DashboardSectionPanel>
  );
}
