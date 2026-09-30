"use client";

import { useMemo, useState } from "react";

import { Copy, KeyRound, Link as LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isSalesStaffRole } from "@/lib/sales-staff-roles";
import type { SalesmanBusinessBoard } from "@/lib/salesman-business-access";
import { cn } from "@/lib/utils";

import {
  buildInviteLinkActions,
  buildInviteLinkValue,
  writeInviteValueToClipboard,
} from "./dashboard-home-invite-links";
import { InviteActionButton } from "./dashboard-home-invite-action-button";

type HomeInviteNotice = {
  message: string;
  tone: "error" | "success";
};

export type HomeInviteCopy = {
  businessBoards: Record<SalesmanBusinessBoard, string>;
  codeLabel: string;
  copiedBoardLink: (board: string) => string;
  copiedCode: string;
  copiedLink: string;
  copyBoardLink: (board: string) => string;
  copyCode: string;
  copyFailed: string;
  copyLink: string;
  description: string;
  noCodeDescription: string;
  noCodeTitle: string;
  noLinkAccess: string;
  title: string;
};

type HomeInviteSectionProps = {
  businessBoards: readonly SalesmanBusinessBoard[];
  copy: HomeInviteCopy;
  density?: "comfortable" | "compact" | "mini";
  referralCode: string | null;
  role: string | null;
};

export function HomeInviteSection({
  businessBoards,
  copy,
  density = "comfortable",
  referralCode,
  role,
}: HomeInviteSectionProps) {
  const [notice, setNotice] = useState<HomeInviteNotice | null>(null);
  const [pendingCopyId, setPendingCopyId] = useState<string | null>(null);
  const mini = density === "mini";
  const compact = density === "compact";
  const normalizedReferralCode = referralCode?.trim().toUpperCase() ?? "";
  const linkActions = useMemo(
    () =>
      buildInviteLinkActions({
        businessBoards,
        copy,
        role,
      }),
    [businessBoards, copy, role],
  );

  const handleCopy = async (id: string, value: string, successMessage: string) => {
    if (pendingCopyId) return;
    if (!value) {
      setNotice({ message: copy.copyFailed, tone: "error" });
      return;
    }

    // 剪贴板权限可能需要等待；当前按钮一直转圈到浏览器确认复制结果。
    setPendingCopyId(id);
    try {
      await writeInviteValueToClipboard(value);
      setNotice({ message: successMessage, tone: "success" });
    } catch {
      setNotice({ message: copy.copyFailed, tone: "error" });
    } finally {
      setPendingCopyId(null);
    }
  };

  if (mini) {
    return (
      <section
        className="flex h-full min-h-0 flex-col overflow-hidden"
        data-testid="home-invite-section"
      >
        <InviteHeading compact copy={copy} mini />
        <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-control-large border border-border-subtle bg-surface-inset">
          <p
            className="min-w-0 flex-1 truncate px-2 font-mono text-sm font-bold text-content-strong"
            data-testid="home-invite-code"
          >
            {normalizedReferralCode || copy.noCodeTitle}
          </p>
          {normalizedReferralCode ? (
            <Button
              aria-label={copy.copyCode}
              className="shrink-0"
              // 迷你卡片和普通卡片使用同一个测试标识，保证响应式切换后仍能验证复制行为。
              data-testid="home-invite-copy-code"
              loading={pendingCopyId === "home-invite-copy-code"}
              onClick={() =>
                void handleCopy("home-invite-copy-code", normalizedReferralCode, copy.copiedCode)
              }
              size="icon"
              type="button"
              variant="ghost"
            >
              <Copy className="size-4" />
            </Button>
          ) : null}
        </div>
        {notice ? (
          <p aria-live="polite" className="sr-only" role="status">
            {notice.message}
          </p>
        ) : null}
      </section>
    );
  }

  if (!normalizedReferralCode) {
    return (
      <section
        className="flex h-full min-h-0 flex-col justify-between"
        data-testid="home-invite-section"
      >
        <InviteHeading compact={compact} copy={copy} mini={mini} />
        <div className="mt-4 rounded-surface-inset border border-border-subtle bg-surface-inset p-4">
          <h4 className="break-words text-sm font-semibold text-content-muted">
            {copy.noCodeTitle}
          </h4>
          <p className="mt-2 break-words text-sm leading-6 text-content-muted">
            {copy.noCodeDescription}
          </p>
        </div>
      </section>
    );
  }

  if (compact) {
    return (
      <section
        className="flex h-full min-h-0 flex-col overflow-hidden"
        data-testid="home-invite-section"
      >
        <InviteHeading compact copy={copy} mini={false} />
        <div className="mt-3 flex min-w-0 items-center gap-2 rounded-control-large border border-border-subtle bg-surface-inset p-2">
          <div className="min-w-0 flex-1 px-1">
            <span className="block text-xs font-semibold text-content-muted">
              {copy.codeLabel}
            </span>
            <p
              className="mt-0.5 truncate font-mono text-lg font-bold leading-tight text-content-strong"
              data-testid="home-invite-code"
            >
              {normalizedReferralCode}
            </p>
          </div>
          <Button
            aria-label={copy.copyCode}
            className="shrink-0"
            data-testid="home-invite-copy-code"
            loading={pendingCopyId === "home-invite-copy-code"}
            onClick={() =>
              void handleCopy("home-invite-copy-code", normalizedReferralCode, copy.copiedCode)
            }
            size="icon"
            title={copy.copyCode}
            type="button"
            variant="ghost"
          >
            <Copy className="size-4" />
          </Button>
        </div>

        <div
          className={cn(
            "mt-3 grid gap-2",
            linkActions.length > 1 && "grid-cols-2",
          )}
        >
          {linkActions.map((action) => (
            <InviteActionButton
              icon={<LinkIcon className="size-4" />}
              iconOnly={false}
              key={action.testId}
              label={action.label}
              loading={pendingCopyId === action.testId}
              miniLabel={action.miniLabel}
              onClick={() =>
                void handleCopy(
                  action.testId,
                  buildInviteLinkValue(action, normalizedReferralCode),
                  action.successMessage,
                )
              }
              testId={action.testId}
            />
          ))}
        </div>

        {isSalesStaffRole(role) && linkActions.length === 0 ? (
          <p className="mt-3 break-words text-xs leading-5 text-content-muted">
            {copy.noLinkAccess}
          </p>
        ) : null}

        {notice ? (
          <p
            aria-live="polite"
            className={cn(
              "mt-2 line-clamp-1 break-words text-xs leading-5",
              notice.tone === "success"
                ? "text-status-success"
                : "text-content-muted",
            )}
            role="status"
          >
            {notice.message}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="home-invite-section"
    >
      <InviteHeading compact={false} copy={copy} mini={false} />

      <div
        className={cn(
          "rounded-control-large border border-border-subtle bg-surface-inset",
          mini ? "mt-3 p-2" : compact ? "mt-4 p-3" : "mt-4 p-4",
        )}
      >
        {!mini ? (
          <span className="text-xs font-semibold text-content-muted">
            {copy.codeLabel}
          </span>
        ) : null}
        <p
          className={cn(
            "break-words font-mono font-bold leading-tight text-content-strong",
            mini ? "text-sm" : compact ? "mt-1 text-lg" : "mt-1 text-2xl",
          )}
          data-testid="home-invite-code"
        >
          {normalizedReferralCode}
        </p>
      </div>

      <div
        className={cn(
          "grid gap-2",
          mini ? "grid-cols-3" : compact ? "grid-cols-1" : "sm:grid-cols-2",
          mini ? "mt-3" : "mt-4",
        )}
      >
        <InviteActionButton
          icon={<Copy className="size-4" />}
          iconOnly={mini}
          label={copy.copyCode}
          loading={pendingCopyId === "home-invite-copy-code"}
          onClick={() =>
            void handleCopy("home-invite-copy-code", normalizedReferralCode, copy.copiedCode)
          }
          testId="home-invite-copy-code"
        />
        {linkActions.map((action) => (
          <InviteActionButton
            icon={<LinkIcon className="size-4" />}
            iconOnly={mini}
            key={action.testId}
            label={action.label}
            loading={pendingCopyId === action.testId}
            miniLabel={action.miniLabel}
            onClick={() =>
              void handleCopy(
                action.testId,
                buildInviteLinkValue(action, normalizedReferralCode),
                action.successMessage,
              )
            }
            testId={action.testId}
          />
        ))}
      </div>

      {isSalesStaffRole(role) && linkActions.length === 0 ? (
        <p className="mt-3 break-words text-xs leading-5 text-content-muted">
          {copy.noLinkAccess}
        </p>
      ) : null}

      {notice ? (
        <p
          aria-live="polite"
          className={cn(
            "mt-3 break-words text-sm leading-6",
            mini && "line-clamp-1 text-xs leading-5",
            notice.tone === "success"
              ? "text-status-success"
              : "text-content-muted",
          )}
          role="status"
        >
          {notice.message}
        </p>
      ) : null}
    </section>
  );
}

function InviteHeading({
  compact,
  copy,
  mini,
}: {
  compact: boolean;
  copy: HomeInviteCopy;
  mini: boolean;
}) {
  return (
    <div className="min-w-0">
      <h3
        className={cn(
          "flex items-center gap-2 font-bold tracking-tight text-content-strong",
          mini ? "text-base" : compact ? "text-lg" : "text-xl",
        )}
      >
        <KeyRound className="size-5 shrink-0 text-primary" />
        <span className="min-w-0 break-words">
          {mini ? copy.codeLabel : copy.title}
        </span>
      </h3>
      {!mini && !compact ? (
        <p className="mt-2 break-words text-sm leading-7 text-content-muted">
          {copy.description}
        </p>
      ) : null}
    </div>
  );
}
