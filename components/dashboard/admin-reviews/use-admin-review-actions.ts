"use client";

import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { adminReviewUnconfirmed, reviewMediaAsset, reviewPrivacyRequest } from "@/lib/admin-review-mutations";
import { approveProfileChangeRequest, rejectProfileChangeRequest } from "@/lib/profile-change-requests";
import { useDashboardConfirm } from "../dashboard-confirm-provider";
import type { BusyAction, ReviewTab } from "./types";

type ReviewCommand = { tab: ReviewTab; id: string; userId: string; action: BusyAction };
type ReviewFeedback = { tone: "success" | "error"; message: string } | null;

export function useAdminReviewActions(
  supabase: SupabaseClient | null,
  onConfirmed: (tab: ReviewTab, id: string) => void,
  setFeedback: (feedback: ReviewFeedback) => void,
  formatError: (error: unknown) => string,
) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
  const t = useTranslations("Reviews");
  const active = useRef(new Set<string>());
  const [busyRows, setBusyRows] = useState<Record<string, BusyAction>>({});

  async function runReview(command: ReviewCommand) {
    const { tab, id, userId, action } = command;
    const rowKey = `${tab}:${id}`;
    if (!supabase || active.current.has(rowKey)) return;

    // 在打开确认框前锁住同一行，避免连击或另一按钮重复提交。
    active.current.add(rowKey);
    try {
      const accepted = await confirm({
        description: t(`confirm.${tab}`, { action: t(`actions.${action}`) }),
        title: confirmT("title"),
        tone: action === "reject" ? "warning" : "normal",
      });
      if (!accepted) return;
      setBusyRows((current) => ({ ...current, [rowKey]: action }));
      setFeedback(null);

      if (tab === "media") {
        await reviewMediaAsset(supabase, { id, userId }, action);
      } else if (tab === "privacy") {
        await reviewPrivacyRequest(supabase, { id, userId }, action);
      } else if (action === "approve") {
        await approveProfileChangeRequest(supabase, id);
      } else {
        await rejectProfileChangeRequest(supabase, id);
      }

      onConfirmed(tab, id);
      setFeedback({
        tone: "success",
        message: t(`feedback.${tab}${action === "approve" ? "Approved" : "Rejected"}`),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error && error.message === adminReviewUnconfirmed
          ? t("feedback.unconfirmed")
          : formatError(error),
      });
    } finally {
      active.current.delete(rowKey);
      setBusyRows((current) => {
        if (!current[rowKey]) return current;
        const next = { ...current };
        delete next[rowKey];
        return next;
      });
    }
  }

  return { busyRows, runReview };
}
