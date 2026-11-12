import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";

export type SettlementPublicationInput = {
  customerId: string | null;
  customerName: string | null;
  note: string | null;
  receivedOn: string;
  amount: number;
  currency: string;
};

export type SettlementPublicationDraft = {
  requestId: string;
  fingerprint: string;
};

export const publicationUnconfirmed = "settlement_publication_unconfirmed";
export const publicationDifferent = "settlement_publication_different";

const rejectedMessages = new Set([
  "wholesale_settlement_release_forbidden",
  "wholesale_settlement_release_amount_invalid",
  "wholesale_settlement_release_currency_required",
  "wholesale_settlement_release_customer_name_required",
  "wholesale_settlement_release_customer_not_found",
]);

export class SettlementPublicationRejected extends Error {}

export async function fingerprintSettlementPublication(input: SettlementPublicationInput) {
  // 标签页只暂存请求号和摘要。正式客户以编号识别，显示名称不进入摘要。
  const values = [
    input.customerId, input.customerId ? null : input.customerName,
    input.note, input.receivedOn, input.amount.toFixed(2), input.currency,
  ];
  const bytes = new TextEncoder().encode(JSON.stringify(values));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function publishSettlementRelease(
  supabase: SupabaseClient,
  actorId: string,
  draft: SettlementPublicationDraft,
  input: SettlementPublicationInput,
) {
  const { data, error, status } = await withRequestTimeout(
    supabase.rpc("create_wholesale_settlement_release", {
      p_customer_id: input.customerId,
      p_customer_name: input.customerName,
      p_note: input.note,
      p_publication_request_id: draft.requestId,
      p_received_on: input.receivedOn,
      p_release_amount: input.amount,
      p_release_currency: input.currency,
    }),
  ).catch((cause: unknown) => ({ data: null, error: cause, status: 0 }));

  const message = error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "";
  if (status >= 400 && status < 500 && rejectedMessages.has(message)) {
    throw new SettlementPublicationRejected(message);
  }
  if (message === "wholesale_settlement_release_request_conflict") {
    throw new Error(publicationDifferent);
  }

  // 即使响应丢失，也按发布人和原请求编号查权威记录。不会因为超时而自动重发。
  const receiptId = typeof data === "string" ? data : undefined;
  await confirmSettlementPublication(supabase, actorId, draft, receiptId);
}

export async function confirmSettlementPublication(
  supabase: SupabaseClient,
  actorId: string,
  draft: SettlementPublicationDraft,
  receiptId?: string,
) {
  const result = await withRequestTimeout(
    supabase.from("wholesale_settlement_releases")
      .select("id,customer_id,customer_name,note,received_on,release_amount,release_currency")
      .eq("published_by_user_id", actorId)
      .eq("publication_request_id", draft.requestId)
      .maybeSingle(),
  ).catch(() => null);

  const row = result?.data;
  if (result?.error || !row || !row.id || (receiptId !== undefined && row.id !== receiptId)) {
    throw new Error(publicationUnconfirmed);
  }
  const fingerprint = await fingerprintSettlementPublication({
    customerId: row.customer_id,
    customerName: row.customer_name,
    note: row.note,
    receivedOn: row.received_on,
    amount: Number(row.release_amount),
    currency: row.release_currency,
  });
  if (fingerprint !== draft.fingerprint) throw new Error(publicationDifferent);
}
