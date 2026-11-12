/** 个人中心、账号切换与媒体：组合或展示本模块已准备的数据；交互回调沿上层状态与服务处理，不在展示中重新实现业务规则。 */
"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import { useState } from "react";

import { LoaderCircle, Plus, RefreshCw, Trash2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/auth-routing";
import { cn } from "@/lib/utils";

import type { DashboardMyCopy } from "./dashboard-shared-my-copy";
import {
  DashboardAccountSwitcherConfirmDialog,
  type AccountSwitcherConfirmAction,
} from "./dashboard-account-switcher-confirm-dialog";
import type { DashboardSharedMyState } from "./use-dashboard-shared-my-state";

type DashboardAccountSwitcherSectionProps = {
  copy: DashboardMyCopy;
  state: DashboardSharedMyState["accountSwitcher"];
  ui: DashboardSharedMyState["ui"];
};

export function DashboardAccountSwitcherSection({
  copy,
  state,
  ui,
}: DashboardAccountSwitcherSectionProps) {
  const busyKey = ui.busyKey;
  const alternateAccount = state.alternateAccount;
  const [confirmAction, setConfirmAction] = useState<AccountSwitcherConfirmAction | null>(null);

  return (
    <>
      <section className="scroll-mt-28" id="common-account">
        {alternateAccount ? (
          <SavedAccountSwitchRow
            account={alternateAccount}
            busyKey={busyKey}
            copy={copy}
            needsReauthentication={state.alternateNeedsReauthentication}
            onRemove={() => setConfirmAction("remove")}
            onSwitch={() => {
              if (state.alternateNeedsReauthentication) {
                void state.actions.reauthenticateAlternateAccount();
                return;
              }

              void state.actions.switchToAlternateAccount();
            }}
          />
        ) : (
          <DesignButton
            className="group flex min-h-[76px] w-full items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-surface-panel px-4 py-3 text-primary shadow-surface-interactive transition-colors hover:border-border-subtle hover:bg-surface-interactive"
            disabled={busyKey !== null}
            onClick={() => void state.actions.addAlternateAccount()}
            type="button"
          >
            <span className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-content-muted">
                {copy.accountSwitcherAddHint}
              </span>
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-inset text-primary transition-colors group-hover:bg-surface-inset">
                {busyKey === "account-switcher-add" ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-5" />
                )}
              </span>
            </span>
          </DesignButton>
        )}

        {state.hasSavedCurrentAccount ? (
          <div className="mt-2 flex justify-center">
            <Button
              aria-label={copy.accountSwitcherClear}
              disabled={busyKey !== null}
              onClick={() => setConfirmAction("clear")}
              size="compact"
              variant="ghost"
            >
              <Trash2 className="size-3.5" />
              {copy.accountSwitcherClear}
            </Button>
          </div>
        ) : null}
      </section>

      <DashboardAccountSwitcherConfirmDialog
        action={confirmAction}
        copy={copy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction;

          setConfirmAction(null);

          if (action === "remove") {
            state.actions.removeAlternateAccount();
            return;
          }

          if (action === "clear") {
            state.actions.clearSavedAccounts();
          }
        }}
        open={confirmAction !== null}
      />
    </>
  );
}

function SavedAccountSwitchRow({
  account,
  busyKey,
  copy,
  needsReauthentication,
  onRemove,
  onSwitch,
}: {
  account: { displayName: string; email: string; role: AppRole | null };
  busyKey: string | null;
  copy: DashboardMyCopy;
  needsReauthentication: boolean;
  onRemove: () => void;
  onSwitch: () => void;
}) {
  const roleLabel = account.role ? getAccountSwitcherRoleLabel(copy, account.role) : null;
  const actionBusyKey = needsReauthentication
    ? "account-switcher-reauthenticate"
    : "account-switcher-switch";

  return (
    <article
      className={cn(
        "flex min-h-[88px] items-center justify-between gap-3 rounded-2xl border bg-surface-panel px-4 py-3 shadow-surface-interactive sm:px-5",
        needsReauthentication ? "border-border-subtle" : "border-border-subtle",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-inset text-primary">
          <UserRound className="size-5" />
        </div>
        <div className="min-w-0">
          {roleLabel ? (
            <p className="text-xs font-semibold text-content-muted">{roleLabel}</p>
          ) : null}
          <p className="mt-0.5 truncate text-base font-semibold text-content-muted">
            {account.displayName}
          </p>
          <p className="truncate text-sm text-content-muted">{account.email}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="primary" size="compact" disabled={busyKey !== null} onClick={onSwitch}>
          {busyKey === actionBusyKey ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {needsReauthentication ? copy.accountSwitcherReauthenticate : copy.accountSwitcherSwitch}
        </Button>
        <Button
          size="icon-compact"
          aria-label={copy.accountSwitcherRemove}
          disabled={busyKey !== null}
          onClick={onRemove}
          variant="outline"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </article>
  );
}

function getAccountSwitcherRoleLabel(copy: DashboardMyCopy, role: AppRole) {
  const roleLabels: Record<AppRole, string> = {
    administrator: copy.accountSwitcherRoleAdministrator,
    client: copy.accountSwitcherRoleClient,
    finance: copy.accountSwitcherRoleFinance,
    manager: copy.accountSwitcherRoleManager,
    operator: copy.accountSwitcherRoleOperator,
    promoter: copy.accountSwitcherRolePromoter,
    recruiter: copy.accountSwitcherRoleRecruiter,
    salesman: copy.accountSwitcherRoleSalesman,
  };

  return roleLabels[role];
}
