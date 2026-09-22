"use client";

import { RotateCcw, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ChoiceField, Field, Input, Textarea } from "@/components/ui/form-controls";
import type { MailAgentProfile } from "@/lib/mail/mail-types";

export function MailAgentProfileCard(props: {
  profile: MailAgentProfile;
  busy: boolean;
  canToggle: boolean;
  onChange: (profile: MailAgentProfile) => void;
  onSave: (resetToGenerated?: boolean) => void;
}) {
  const t = useTranslations("MailWorkspace");
  const profile = props.profile;
  return (
    <article className="min-w-0 rounded-surface-inset border border-border-subtle bg-surface-inset p-4" data-testid={`mail-agent-${profile.memberId}`}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="break-words font-bold text-content-strong">{profile.displayName}</h3>
          <span className="rounded-full border border-border-subtle bg-surface px-2 py-0.5 text-xs text-content-muted">
            {t(profile.role === "administrator" ? "administratorRole" : "salespersonRole")}
          </span>
        </div>
        {props.canToggle ? <ChoiceField checked={profile.enabled} label={t("enabled")} onChange={(event) => props.onChange({ ...profile, enabled: event.target.checked })} rootClassName="min-h-0 border-0 bg-transparent px-0 py-0" /> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={t("plusAlias")}><Input onChange={(event) => props.onChange({ ...profile, aliasLocalPart: event.target.value })} value={profile.aliasLocalPart} /></Field>
        <Field label={t("refPrefix")}><Input onChange={(event) => props.onChange({ ...profile, refPrefix: event.target.value })} value={profile.refPrefix} /></Field>
      </div>
      <p className="mt-2 break-all text-xs leading-5 text-content-muted">{t("replyToPreview", { alias: profile.aliasLocalPart || profile.suggestedAliasLocalPart })}</p>
      <p className="break-all text-xs leading-5 text-content-muted">{t("refPreview", { prefix: profile.refPrefix || profile.suggestedRefPrefix, year: new Date().getUTCFullYear() })}</p>
      <Field className="mt-3" label={t("senderDisplayName")}><Input onChange={(event) => props.onChange({ ...profile, senderDisplayName: event.target.value })} value={profile.senderDisplayName} /></Field>
      <Field className="mt-3" label={t("signature")}><Textarea className="min-h-24" onChange={(event) => props.onChange({ ...profile, signatureHtml: event.target.value })} value={profile.signatureHtml} /></Field>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs ${profile.feishuBound ? "text-status-success" : "text-status-warning"}`}>{profile.feishuBound ? t("feishuBound") : t("feishuUnbound")}</span>
        <div className="flex flex-wrap gap-2">
          <Button disabled={props.busy} onClick={() => props.onSave(true)} size="compact" type="button" variant="outline"><RotateCcw className="size-4" />{t("restoreSuggested")}</Button>
          <Button disabled={props.busy} onClick={() => props.onSave(false)} size="compact" type="button"><Save className="size-4" />{t("save")}</Button>
        </div>
      </div>
    </article>
  );
}
