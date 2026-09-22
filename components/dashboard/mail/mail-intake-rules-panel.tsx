"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ChoiceField, Field, Input } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/select";
import { Surface } from "@/components/ui/surface";
import type { MailIntakeRule, MailIntakeRuleAction, MailIntakeRuleMatcher } from "@/lib/mail/mail-types";

export function MailIntakeRulesPanel(props: {
  rules: MailIntakeRule[];
  busy: string | null;
  onRules: (rules: MailIntakeRule[]) => void;
  onCreate: (rule: { matchType: MailIntakeRuleMatcher; action: MailIntakeRuleAction; pattern: string }) => void;
  onSave: (rule: MailIntakeRule) => void;
  onDelete: (rule: MailIntakeRule) => void;
}) {
  const t = useTranslations("MailWorkspace");
  const [matchType, setMatchType] = useState<MailIntakeRuleMatcher>("sender");
  const [action, setAction] = useState<MailIntakeRuleAction>("quarantine");
  const [pattern, setPattern] = useState("");
  const matchOptions = [
    { value: "sender" as const, label: t("ruleSender") },
    { value: "domain" as const, label: t("ruleDomain") },
    { value: "subject_contains" as const, label: t("ruleSubject") },
  ];
  const actionOptions = [
    { value: "quarantine" as const, label: t("ruleQuarantine") },
    { value: "allow" as const, label: t("ruleAllow") },
  ];
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]" data-testid="mail-intake-rules-panel">
      <Surface>
        <h2 className="text-xl font-bold text-content-strong">{t("createRule")}</h2>
        <p className="mt-1 text-sm leading-6 text-content-muted">{t("createRuleDescription")}</p>
        <div className="mt-4 space-y-3">
          <Field label={t("ruleMatchType")}><Select onValueChange={setMatchType} options={matchOptions} value={matchType} /></Field>
          <Field label={t("rulePattern")}><Input onChange={(event) => setPattern(event.target.value)} placeholder={matchType === "sender" ? "newsletter@example.com" : matchType === "domain" ? "example.com" : t("ruleSubjectPlaceholder")} type={matchType === "sender" ? "email" : "text"} value={pattern} /></Field>
          <Field label={t("ruleAction")}><Select onValueChange={setAction} options={actionOptions} value={action} /></Field>
          <Button className="w-full sm:w-auto" disabled={props.busy !== null || !pattern.trim()} onClick={() => { props.onCreate({ matchType, action, pattern }); setPattern(""); }} type="button"><Plus className="size-4" />{t("addRule")}</Button>
        </div>
      </Surface>
      <Surface>
        <h2 className="text-xl font-bold text-content-strong">{t("intakeRules")}</h2>
        <p className="mt-1 text-sm leading-6 text-content-muted">{t("intakeRulesDescription")}</p>
        <div className="mt-4 grid min-w-0 gap-3">{props.rules.length === 0 ? <p className="text-sm text-content-muted">{t("emptyRules")}</p> : props.rules.map((rule, index) => (
          <article className="rounded-surface-inset border border-border-subtle bg-surface-inset p-4" key={rule.id}>
            <div className="grid min-w-0 gap-3 md:grid-cols-[0.8fr_1.4fr_0.8fr]">
              <Field label={t("ruleMatchType")}><Select onValueChange={(value) => props.onRules(props.rules.map((item, itemIndex) => itemIndex === index ? { ...item, matchType: value } : item))} options={matchOptions} value={rule.matchType} /></Field>
              <Field label={t("rulePattern")}><Input onChange={(event) => props.onRules(props.rules.map((item, itemIndex) => itemIndex === index ? { ...item, pattern: event.target.value } : item))} value={rule.pattern} /></Field>
              <Field label={t("ruleAction")}><Select onValueChange={(value) => props.onRules(props.rules.map((item, itemIndex) => itemIndex === index ? { ...item, action: value } : item))} options={actionOptions} value={rule.action} /></Field>
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2"><ChoiceField checked={rule.enabled} label={t("ruleEnabled")} onChange={(event) => props.onRules(props.rules.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} rootClassName="min-h-0 border-0 bg-transparent px-0 py-0" /><span className="text-xs text-content-muted">{t("ruleHits", { count: rule.hitCount })}</span><div className="ml-auto flex flex-wrap gap-2"><Button disabled={props.busy !== null} onClick={() => props.onDelete(rule)} size="compact" type="button" variant="outline"><Trash2 className="size-4" />{t("deleteRule")}</Button><Button disabled={props.busy !== null} onClick={() => props.onSave(rule)} size="compact" type="button"><Save className="size-4" />{t("save")}</Button></div></div>
          </article>
        ))}</div>
      </Surface>
    </div>
  );
}
