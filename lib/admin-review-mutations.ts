import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "./current-session-auth";
import { withRequestTimeout } from "./request-timeout";

export const adminReviewUnconfirmed = "admin_review_unconfirmed";

type ReviewTarget = { id: string; userId: string };
type ReviewAction = "approve" | "reject";
type ReviewExpectation = ReviewTarget & { reviewerId: string; status: "pass" | "denied" };
type ReviewResponse = { data: unknown; error: { message: string } | null; status: number };
type ReviewReadback = { data: unknown; error: unknown };

export async function reviewMediaAsset(supabase: SupabaseClient, target: ReviewTarget, action: ReviewAction) {
  const expected = await getReviewExpectation(supabase, target, action);
  const input = { _asset_id: target.id };
  return confirmReviewResult(
    expected,
    "reviewed_at",
    // verified-rpc: 共用确认函数检查返回记录，再独立核对已保存终态。
    action === "approve" ? supabase.rpc("approve_user_media_asset", input) : supabase.rpc("deny_user_media_asset", input),
    supabase.from("user_media_assets")
      .select("id,user_id,status,reviewer_user_id,reviewed_at")
      .eq("id", target.id)
      .maybeSingle(),
  );
}

export async function reviewPrivacyRequest(supabase: SupabaseClient, target: ReviewTarget, action: ReviewAction) {
  const expected = await getReviewExpectation(supabase, target, action);
  const input = { _request_id: target.id };
  return confirmReviewResult(
    expected,
    "review_at",
    // verified-rpc: 共用确认函数核对编号、状态、审核人和审核时间。
    action === "approve" ? supabase.rpc("approve_user_privacy_request", input) : supabase.rpc("deny_user_privacy_request", input),
    supabase.from("user_privacy_requests")
      .select("id,user_id,status,reviewer_user_id,review_at")
      .eq("id", target.id)
      .maybeSingle(),
  );
}

async function getReviewExpectation(supabase: SupabaseClient, target: ReviewTarget, action: ReviewAction): Promise<ReviewExpectation> {
  const actor = await getCurrentUser(supabase);
  if (!actor) throw new Error(adminReviewUnconfirmed);
  return { ...target, reviewerId: actor.id, status: action === "approve" ? "pass" : "denied" };
}

async function confirmReviewResult(
  expected: ReviewExpectation,
  timeField: "reviewed_at" | "review_at",
  request: PromiseLike<ReviewResponse>,
  readback: PromiseLike<ReviewReadback>,
) {
  const result = await withRequestTimeout(request).catch(() => null);
  // 数据库明确拒绝时停止。连接中断时，原事务仍可能已完成，只做独立读回。
  if (result?.error && result.status >= 400 && result.status < 500) throw result.error;
  const returnedTime = result && !result.error
    ? readReviewTime(result.data, expected, timeField)
    : null;
  if (result && !result.error && returnedTime === null) throw new Error(adminReviewUnconfirmed);

  const saved = await withRequestTimeout(readback).catch(() => null);
  const savedTime = saved && !saved.error ? readReviewTime(saved.data, expected, timeField) : null;
  if (savedTime === null || (returnedTime !== null && savedTime !== returnedTime)) {
    throw new Error(adminReviewUnconfirmed);
  }
}

function readReviewTime(value: unknown, expected: ReviewExpectation, timeField: "reviewed_at" | "review_at") {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const time = row[timeField];
  if (
    row.id !== expected.id || row.user_id !== expected.userId ||
    row.status !== expected.status || row.reviewer_user_id !== expected.reviewerId ||
    typeof time !== "string"
  ) return null;
  const parsedTime = Date.parse(time);
  return Number.isFinite(parsedTime) ? parsedTime : null;
}
