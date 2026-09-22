"use client";

import { Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Surface } from "@/components/ui/surface";
import type { MailAgentProfile } from "@/lib/mail/mail-types";

import { MailAgentProfileCard } from "./mail-agent-profile-card";

export function MailOwnSettingsPanel(props: {
  profile: MailAgentProfile | null;
  busy: boolean;
  onChange: (profile: MailAgentProfile) => void;
  onSave: (resetToGenerated?: boolean) => void;
}) {
  const t = useTranslations("MailWorkspace");
  return (
    <Surface>
      <h2 className="flex items-center gap-2 text-xl font-bold text-content-strong"><Settings2 className="size-5" />{t("mySenderSettings")}</h2>
      <p className="mt-1 text-sm leading-6 text-content-muted">{t("mySenderSettingsDescription")}</p>
      <div className="mt-5 max-w-3xl">
        {props.profile
          ? <MailAgentProfileCard busy={props.busy} canToggle={false} onChange={props.onChange} onSave={props.onSave} profile={props.profile} />
          : <p className="text-sm text-content-muted">{t("senderSettingsUnavailable")}</p>}
      </div>
    </Surface>
  );
}
