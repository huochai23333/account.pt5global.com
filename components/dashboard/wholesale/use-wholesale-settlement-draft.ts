"use client";

import { useRef, useState } from "react";
import { getBeijingDateString } from "@/lib/exchange-rates";

type SettlementDraft = {
  requestId: string;
  amount: string;
  date: string;
};

export function useWholesaleSettlementDraft(
  orderId: string,
  viewerId: string,
  onSettleOrder: (formData: FormData) => Promise<boolean>,
) {
  // 同一浏览器标签页刷新后仍能重试原登记。按当前账号及订单隔离暂存。
  const storageKey = `pt5:wholesale-settlement:${viewerId}:${orderId}`;
  const [initialDraft] = useState(() => readDraft(storageKey));
  const [amount, setAmount] = useState(initialDraft?.amount ?? "");
  const [date, setDate] = useState(initialDraft?.date ?? getBeijingDateString);
  const [submitting, setSubmitting] = useState(false);
  const request = useRef<SettlementDraft | null>(initialDraft);
  const submittingRef = useRef(false);

  async function submit(form: HTMLFormElement) {
    if (submittingRef.current) return false;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const formData = new FormData(form);
      if (!request.current) {
        request.current = { requestId: globalThis.crypto.randomUUID(), amount, date };
        writeDraft(storageKey, request.current);
      }
      formData.set("settlement_request_id", request.current.requestId);
      if (!(await onSettleOrder(formData))) return false;

      // 只有收到数据库凭证才结束本次登记，下一次同金额可以生成独立编号。
      request.current = null;
      writeDraft(storageKey, null);
      return true;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // 刷新后的剩余金额可能已经扣掉这笔登记。原金额和日期仍允许重试以取得回执。
  const matchesRestoredDraft = initialDraft?.amount === amount && initialDraft.date === date;
  return { amount, setAmount, date, setDate, matchesRestoredDraft, submitting, submit };
}

function readDraft(key: string): SettlementDraft | null {
  try {
    const raw = globalThis.sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return typeof value?.requestId === "string" &&
      typeof value.amount === "string" && typeof value.date === "string"
      ? value : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: SettlementDraft | null) {
  try {
    if (value) globalThis.sessionStorage.setItem(key, JSON.stringify(value));
    else globalThis.sessionStorage.removeItem(key);
  } catch {
    // 浏览器禁止暂存时，当前弹窗仍使用内存中的原请求编号。
  }
}
