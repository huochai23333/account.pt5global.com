"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { FeedbackTone } from "@/components/dashboard/dashboard-shared-ui";
import type {
  BusinessVipAdjustmentAction,
  BusinessVipMembershipAction,
  BusinessVipPageData,
  BusinessVipReviewAction,
} from "@/lib/business-vip-management";

type BusinessVipFeedback = { message: string; tone: FeedbackTone } | null;
type BusinessVipMutationPayload =
  | {
      business: BusinessVipPageData["business"];
      note: string;
      operation: "request";
      targetId: string;
    }
  | {
      action: BusinessVipReviewAction;
      business: BusinessVipPageData["business"];
      note: string;
      operation: "review";
      requestId: string;
    }
  | {
      action: BusinessVipAdjustmentAction;
      business: BusinessVipPageData["business"];
      nextExpiresAt: string | null;
      note: string;
      operation: "adjust";
      targetId: string;
    }
  | {
      action: BusinessVipMembershipAction;
      business: "wholesale";
      note: string;
      operation: "manageWholesale";
      targetId: string;
    };

export function useBusinessVipMutation(onConfirmed: () => void) {
  const t = useTranslations("BusinessVip");
  const router = useRouter();
  const [isRefreshing, startRefreshing] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [dialogFeedback, setDialogFeedback] = useState<BusinessVipFeedback>(null);
  const [pageFeedback, setPageFeedback] = useState<BusinessVipFeedback>(null);
  const inFlight = useRef(false);
  const [unconfirmedTargets, setUnconfirmedTargets] = useState<Set<string>>(() => new Set());
  const unconfirmedFeedback = { tone: "info", message: t("errors.unconfirmed") } as const;

  function markUnconfirmed(target: string) {
    // 续期可能已经落库。当前页面保留这个客户的待确认标记，刷新核对记录后再决定是否续期。
    setUnconfirmedTargets((targets) => new Set(targets).add(target));
    setDialogFeedback(unconfirmedFeedback);
  }

  async function submitMutation(
    actionKey: string,
    payload: BusinessVipMutationPayload,
    successMessage: string,
  ) {
    const target = "targetId" in payload ? `customer:${payload.targetId}` : `request:${payload.requestId}`;
    // 同一次浏览器事件里，第二个点击发生时按钮还可能没重绘。
    if (inFlight.current || isRefreshing || unconfirmedTargets.has(target)) return;
    inFlight.current = true;
    setPendingKey(actionKey);
    setDialogFeedback(null);
    setPageFeedback(null);

    try {
      const response = await fetch("/api/business-vip", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(60_000),
      });
      const result = await readBusinessVipMutationResponse(response);
      if (response.ok && result.ok) {
        onConfirmed();
        setPageFeedback({ tone: "success", message: successMessage });
        startRefreshing(() => router.refresh());
        return;
      }

      const errorCode = normalizeBusinessVipErrorCode(result.error);
      if (response.ok || (response.status >= 500 && errorCode !== "businessUnavailable")) {
        markUnconfirmed(target);
        return;
      }

      setDialogFeedback({ tone: "error", message: t(`errors.${errorCode}`) });
    } catch {
      markUnconfirmed(target);
    } finally {
      inFlight.current = false;
      setPendingKey(null);
    }
  }

  return {
    clearDialogFeedback: () => setDialogFeedback(null),
    clearPageFeedback: () => setPageFeedback(null),
    dialogFeedback,
    isCustomerUnconfirmed: (id: string) => unconfirmedTargets.has(`customer:${id}`),
    mutationPending: Boolean(pendingKey) || isRefreshing,
    pageFeedback,
    pendingActionKey: pendingKey ?? (isRefreshing ? "refresh" : null),
    submitMutation,
    unconfirmedFeedback,
  };
}

async function readBusinessVipMutationResponse(response: Response) {
  try {
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return {
      error: "error" in value && typeof value.error === "string" ? value.error : undefined,
      ok: "ok" in value && value.ok === true,
    };
  } catch {
    return {};
  }
}

function normalizeBusinessVipErrorCode(value: string | undefined) {
  switch (value) {
    case "businessUnavailable":
    case "forbidden":
    case "invalidInput":
    case "notFound":
    case "processed":
    case "serviceUnavailable":
      return value;
    default:
      return "unknown";
  }
}
