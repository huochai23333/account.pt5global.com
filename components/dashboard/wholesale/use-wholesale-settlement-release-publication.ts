"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  confirmSettlementPublication,
  fingerprintSettlementPublication,
  publicationDifferent,
  publicationUnconfirmed,
  publishSettlementRelease,
  SettlementPublicationRejected,
  type SettlementPublicationDraft,
  type SettlementPublicationInput,
} from "@/lib/wholesale-settlement-release-publication";
import { optionalString, positiveNumber, requiredString } from "./wholesale-action-utils";
import type { RunWholesaleAction } from "./use-wholesale-action-runner";

export type SettlementReleasePublicationActions = {
  create: (formData: FormData, onError: (message: string) => void) => Promise<boolean>;
  recover: (onError: (message: string) => void) => Promise<boolean>;
  hasPending: () => boolean;
};

export function useWholesaleSettlementReleasePublication(
  currentUserId: string | null,
  runAction: RunWholesaleAction,
): SettlementReleasePublicationActions {
  const t = useTranslations("UiText.components_dashboard_wholesale_wholesale_settlement_release_dialogs");
  const storageKey = currentUserId ? `pt5:settlement-publication:${currentUserId}` : null;
  const memory = useRef<{ key: string; draft: SettlementPublicationDraft | null } | null>(null);

  function readPending() {
    if (!storageKey) return null;
    if (memory.current?.key === storageKey) return memory.current.draft;
    try {
      const raw = sessionStorage.getItem(storageKey);
      const draft = raw ? JSON.parse(raw) : null;
      return typeof draft?.requestId === "string" && /^[a-f0-9-]{36}$/.test(draft.requestId) &&
        typeof draft.fingerprint === "string" && /^[a-f0-9]{64}$/.test(draft.fingerprint)
        ? draft as SettlementPublicationDraft : null;
    } catch {
      return null;
    }
  }

  function writePending(draft: SettlementPublicationDraft | null) {
    if (!storageKey) return;
    memory.current = { key: storageKey, draft };
    try {
      if (draft) sessionStorage.setItem(storageKey, JSON.stringify(draft));
      else sessionStorage.removeItem(storageKey);
    } catch {
      // 标签页禁止暂存时，仍在页面内存中沿用原请求编号。
    }
  }

  function run(onError: (message: string) => void, action: () => Promise<void>) {
    return runAction("settlement-release:create", t("publicationSuccess"), action, {
      onError,
      getErrorMessage(error) {
        if (error instanceof Error && error.message === publicationDifferent) return t("publicationDifferent");
        if (error instanceof Error && error.message === publicationUnconfirmed) return t("publicationUnconfirmed");
        return t("publicationFailed");
      },
    });
  }

  return {
    hasPending: () => Boolean(readPending()),
    create: (formData, onError) => run(onError, async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase || !currentUserId) throw new Error("client unavailable");
      const input = readInput(formData);
      const fingerprint = await fingerprintSettlementPublication(input);
      const pending = readPending();
      if (pending && pending.fingerprint !== fingerprint) throw new Error(publicationDifferent);

      // 共享执行器在进入这里前已经锁住提交，首帧连击也只能生成一个编号。
      const draft = pending ?? { requestId: crypto.randomUUID(), fingerprint };
      writePending(draft);
      try {
        await publishSettlementRelease(supabase, currentUserId, draft, input);
      } catch (error) {
        // 只有本次首次提交明确被拒绝，才可丢弃编号。此前不确定的请求可能已写入。
        if (!pending && error instanceof SettlementPublicationRejected) writePending(null);
        throw error;
      }
      writePending(null);
    }),
    recover: (onError) => run(onError, async () => {
      const supabase = getBrowserSupabaseClient();
      const draft = readPending();
      if (!supabase || !currentUserId || !draft) throw new Error(publicationUnconfirmed);
      await confirmSettlementPublication(supabase, currentUserId, draft);
      writePending(null);
    }),
  };
}

function readInput(formData: FormData): SettlementPublicationInput {
  const customerId = optionalString(formData.get("customer_id"));
  return {
    customerId,
    customerName: customerId ? null : requiredString(formData.get("customer_name")),
    note: optionalString(formData.get("note")),
    receivedOn: requiredString(formData.get("received_on")),
    amount: positiveNumber(formData.get("release_amount")),
    currency: requiredString(formData.get("release_currency")).toUpperCase(),
  };
}
