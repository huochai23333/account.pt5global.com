"use client";

import { useState } from "react";

import { BriefcaseBusiness, Copy, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { buildBoardInviteLink } from "@/lib/business-referrals";
import type { SalesmanBusinessBoard } from "@/lib/salesman-business-access";
import { isSalesStaffRole } from "@/lib/sales-staff-roles";
import { useDashboardBusinessReferrals } from "./use-dashboard-business-referrals";

import { Button } from "../../ui/button";

type DashboardBusinessReferralPanelProps = {
  referralCode: string | null;
  role: string | null;
};

type LocalNotice = {
  message: string;
  tone: "error" | "success";
};

const BOARD_COPY_KEYS = {
  tourism: "businessReferralTourism",
  wholesale: "businessReferralWholesale",
} as const satisfies Record<SalesmanBusinessBoard, string>;

export function DashboardBusinessReferralPanel({
  referralCode,
  role,
}: DashboardBusinessReferralPanelProps) {
  const t = useTranslations("DashboardMy");
  const {
    boards: salesmanBoards,
    loading,
    loadFailed,
    retry,
  } = useDashboardBusinessReferrals(role);
  const [notice, setNotice] = useState<LocalNotice | null>(null);

  if (!isSalesStaffRole(role)) {
    return null;
  }

  const boardLabel = (board: SalesmanBusinessBoard) =>
    t(BOARD_COPY_KEYS[board]);

  const copyInviteLink = async (board: SalesmanBusinessBoard) => {
    if (!referralCode || typeof window === "undefined") {
      setNotice({ message: t("businessInviteNoCode"), tone: "error" });
      return;
    }

    const inviteLink = buildBoardInviteLink({
      board,
      origin: window.location.origin,
      referralCode,
    });

    try {
      await navigator.clipboard.writeText(inviteLink);
      setNotice({
        message: t("businessInviteCopied", { board: boardLabel(board) }),
        tone: "success",
      });
    } catch {
      setNotice({ message: t("businessInviteCopyFailed"), tone: "error" });
    }
  };

  return (
    <div className="mt-6 border-t border-border-subtle pt-6">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-surface-interactive text-primary">
          <BriefcaseBusiness className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold text-content-muted">
            {t("businessInviteTitle")}
          </h4>
          <p className="mt-1 text-sm leading-6 text-content-muted">
            {t("businessInviteDescription")}
          </p>
        </div>
      </div>

      {notice ? (
        <p
          className={
            notice.tone === "success"
              ? "mt-4 text-sm leading-6 text-status-success"
              : "mt-4 text-sm leading-6 text-content-muted"
          }
        >
          {notice.message}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-content-muted">
          <LoaderCircle className="size-4 animate-spin" />
          {t("businessReferralLoading")}
        </p>
      ) : null}

      {loadFailed ? (
        <div className="mt-4 space-y-3" role="status">
          <p className="text-sm text-status-danger">
            {t("businessInviteLoadFailed")}
          </p>
          <Button
            onClick={retry}
            size="default"
            type="button"
            variant="outline"
          >
            {t("businessInviteRetry")}
          </Button>
        </div>
      ) : null}

      {!loading && !loadFailed ? (
        <SalesmanInviteActions
          boards={salesmanBoards}
          boardLabel={boardLabel}
          copyInviteLink={copyInviteLink}
          referralCode={referralCode}
          t={t}
        />
      ) : null}
    </div>
  );
}

function SalesmanInviteActions({
  boards,
  boardLabel,
  copyInviteLink,
  referralCode,
  t,
}: {
  boards: SalesmanBusinessBoard[];
  boardLabel: (board: SalesmanBusinessBoard) => string;
  copyInviteLink: (board: SalesmanBusinessBoard) => Promise<void>;
  referralCode: string | null;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  if (!referralCode) {
    return (
      <p className="mt-4 text-sm text-content-muted">
        {t("businessInviteNoCode")}
      </p>
    );
  }

  if (boards.length === 0) {
    return (
      <p className="mt-4 text-sm text-content-muted">
        {t("businessInviteNoAccess")}
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {boards.map((board) => (
        <Button
          size="default"
          key={board}
          onClick={() => void copyInviteLink(board)}
          type="button"
          variant="outline"
          wrap
        >
          <Copy className="size-4" />
          <span className="whitespace-normal text-left">
            {t("businessInviteCopyBoardLink", { board: boardLabel(board) })}
          </span>
        </Button>
      ))}
    </div>
  );
}
