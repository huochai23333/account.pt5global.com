"use client";

import { ArrowLeft, BellRing } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { buttonVariants } from "@/components/ui/button-variants";
import type {
  AdminEmailConnectionHealth,
  EmailConnectionSummary,
  EmailPlatformRule,
} from "@/lib/emailconnect/emailconnect-types";
import { cn } from "@/lib/utils";

import { AdminEmailHealthSection } from "./admin-email-health-section";
import { AdminEmailRulesSection } from "./admin-email-rules-section";
import { EmailConnectionsSection } from "./email-connections-section";
import { useEmailRemindersViewModel } from "./use-email-reminders-view-model";

export function EmailRemindersClient(props: {
  backHref: string;
  initialAdminConnections: AdminEmailConnectionHealth[];
  initialLoadError: string | null;
  initialRules: EmailPlatformRule[];
  initialSummary: EmailConnectionSummary | null;
  isAdministrator: boolean;
  workspace: string;
}) {
  const t = useTranslations("EmailReminders");
  const state = useEmailRemindersViewModel({
    initialLoadError: props.initialLoadError,
    initialRules: props.initialRules,
    initialSummary: props.initialSummary,
    workspace: props.workspace,
  });
  return (
    <DashboardPageShell
      feedback={state.feedback ? { message: state.feedback, tone: state.feedbackTone } : null}
      header={
        <DashboardSectionHeader
          badge={t("badge")}
          badgeIcon={<BellRing className="size-4" />}
          actions={
            <Link className={cn(buttonVariants({ size: "default", variant: "outline", wrap: true }), "w-full sm:w-auto")} href={props.backHref}>
              <ArrowLeft className="size-4" />
              {t("back")}
            </Link>
          }
          description={t("description")}
          presentation="overview"
          title={t("title")}
        />
      }
    >
      <EmailConnectionsSection
        busyKey={state.busyKey}
        onConnect={() => void state.startConnection()}
        onDisconnect={(connectionId) => void state.disconnect(connectionId)}
        summary={state.summary}
      />
      {props.isAdministrator ? (
        <>
          <AdminEmailRulesSection
            busy={state.busyKey !== null}
            onSave={() => void state.saveRules()}
            onUpdate={state.updateRule}
            rules={state.rules}
          />
          <AdminEmailHealthSection connections={props.initialAdminConnections} />
        </>
      ) : null}
    </DashboardPageShell>
  );
}
