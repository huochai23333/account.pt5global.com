"use client";

import { Copy, KeyRound, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { DashboardMyCopy } from "./dashboard-shared-my-copy";
import { DashboardBusinessReferralPanel } from "./dashboard-business-referral-panel";
import {
  DashboardMySectionShell,
  DashboardMyStatGrid,
  type DashboardMyStatItem,
} from "./dashboard-my-section-ui";
import type { DashboardSharedMyState } from "./use-dashboard-shared-my-state";

export function DashboardAccountCenterSection({
  account,
  copy,
  onRefreshProfile,
  stats,
  ui,
}: {
  account: DashboardSharedMyState["account"];
  copy: DashboardMyCopy;
  onRefreshProfile: () => void;
  stats: readonly DashboardMyStatItem[];
  ui: DashboardSharedMyState["ui"];
}) {
  const passwordResetButtonLabel =
    account.passwordResetCooldownRemaining > 0
      ? copy.passwordResetCountdown(account.passwordResetCooldownRemaining)
      : copy.changePassword;

  return (
    <DashboardMySectionShell
      description={copy.accountCenterDescription}
      icon={<KeyRound className="size-5" />}
      id="account-center"
      title={copy.accountCenterTitle}
    >
      <DashboardMyStatGrid stats={stats} />

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          variant="primary"
          size="default"
          className="max-w-full"
          disabled={
            ui.busyKey !== null || account.passwordResetCooldownRemaining > 0
          }
          onClick={() => void account.sendPasswordReset()}
        >
          {ui.busyKey === "password" ? (
            <RefreshCw className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          <span className="min-w-0 truncate">{passwordResetButtonLabel}</span>
        </Button>
        <Button
          size="default"
          onClick={() => void account.copyInviteCode()}
          variant="outline"
        >
          <Copy className="size-4" />
          {copy.copyInviteCode}
        </Button>
        <Button
          size="default"
          disabled={ui.busyKey !== null}
          onClick={onRefreshProfile}
          variant="outline"
        >
          <RefreshCw
            className={cn("size-4", ui.busyKey === "refresh" && "animate-spin")}
          />
          {copy.refreshProfile}
        </Button>
      </div>

      <DashboardBusinessReferralPanel
        referralCode={account.referralCode}
        role={account.role}
      />
    </DashboardMySectionShell>
  );
}
