"use client";

import { Inbox, Settings2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export type MailWorkspaceView = "inbox" | "quarantine" | "rules" | "settings";

export function MailWorkspaceTabs(props: {
  value: MailWorkspaceView;
  isAdmin: boolean;
  quarantineCount: number;
  onChange: (value: MailWorkspaceView) => void;
}) {
  const t = useTranslations("MailWorkspace");
  const items = [
    { value: "inbox" as const, label: t("workspaceInbox"), icon: Inbox },
    ...(props.isAdmin ? [
      { value: "quarantine" as const, label: `${t("quarantine")} ${props.quarantineCount}`, icon: ShieldCheck },
      { value: "rules" as const, label: t("intakeRules"), icon: SlidersHorizontal },
    ] : []),
    { value: "settings" as const, label: props.isAdmin ? t("mailSettings") : t("mySenderSettings"), icon: Settings2 },
  ];
  return (
    <nav aria-label={t("workspaceNavigation")} className="flex min-w-0 flex-wrap gap-2" data-testid="mail-workspace-tabs">
      {items.map((item) => <Button className="shrink-0" key={item.value} onClick={() => props.onChange(item.value)} type="button" variant={props.value === item.value ? "primary" : "outline"}><item.icon className="size-4" />{item.label}</Button>)}
    </nav>
  );
}
