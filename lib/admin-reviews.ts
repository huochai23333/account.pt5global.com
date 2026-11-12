// 审核列表先校验会话，再分别读取三类待审数据。审核写入在独立文件中。
import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { mapWithConcurrencyLimit } from "./async-collection";
import { withRequestTimeout } from "./request-timeout";
import {
  getCurrentSessionContext,
  type AppRole,
  type MediaKind,
  type PrivacyRequestStatus,
} from "./user-self-service";
import {
  getPendingProfileChangeReviews,
  type PendingProfileChangeReviewRow,
} from "./profile-change-requests";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CONCURRENCY = 4;
const PENDING_MEDIA_REVIEW_SELECT =
  "asset_id,user_id,name,email,kind,bucket_name,storage_path,original_name,mime_type,file_size_bytes,status,created_at,ai_review_status,ai_review_decision,ai_review_risk_score,ai_review_reasons,ai_review_provider,ai_review_model,ai_review_completed_at,ai_review_error_message";

export type AiImageReviewStatus = "queued" | "processing" | "completed" | "failed";
export type AiImageReviewDecision = "auto_pass" | "manual_review";

export type PendingPrivacyReviewRow = {
  request_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  passport_requests: string | null;
  id_card_requests: string | null;
  status: PrivacyRequestStatus;
  type: boolean;
  created_at: string;
};

export type PendingMediaReviewRow = {
  asset_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  kind: MediaKind;
  bucket_name: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: PrivacyRequestStatus;
  created_at: string;
  ai_review_status: AiImageReviewStatus | null;
  ai_review_decision: AiImageReviewDecision | null;
  ai_review_risk_score: number | null;
  ai_review_reasons: string[] | null;
  ai_review_provider: string | null;
  ai_review_model: string | null;
  ai_review_completed_at: string | null;
  ai_review_error_message: string | null;
};

export type PendingMediaReviewWithPreview = PendingMediaReviewRow & {
  previewUrl: string | null;
};

export type AdminReviewsPageData = {
  hasPermission: boolean;
  privacyRows: PendingPrivacyReviewRow[];
  mediaRows: PendingMediaReviewWithPreview[];
  profileRows: PendingProfileChangeReviewRow[];
};

async function attachMediaPreviewUrls(supabase: SupabaseClient, rows: PendingMediaReviewRow[]) {
  return withRequestTimeout(
    mapWithConcurrencyLimit(rows, SIGNED_URL_CONCURRENCY, async (row) => {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(row.bucket_name)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

      return {
        ...row,
        previewUrl: signedUrlError ? null : (signedUrlData?.signedUrl ?? null),
      } satisfies PendingMediaReviewWithPreview;
    }),
  );
}

export async function getCurrentReviewerContext(
  supabase: SupabaseClient,
): Promise<{ user: User; role: AppRole | null } | null> {
  const { user, role } = await getCurrentSessionContext(supabase);

  if (!user) {
    return null;
  }

  return {
    user,
    role,
  };
}

export function canViewAdminReviews(role: AppRole | null) {
  return role === "administrator";
}

export async function getAdminReviewsPageData(
  supabase: SupabaseClient,
): Promise<AdminReviewsPageData> {
  const reviewer = await getCurrentReviewerContext(supabase);

  if (!reviewer || !canViewAdminReviews(reviewer.role)) {
    return {
      hasPermission: false,
      privacyRows: [],
      mediaRows: [],
      profileRows: [],
    };
  }

  const [privacyRows, mediaRows, profileRows] = await Promise.all([
    getPendingPrivacyReviews(supabase),
    getPendingMediaReviews(supabase),
    getPendingProfileChangeReviews(supabase),
  ]);

  return {
    hasPermission: true,
    privacyRows,
    mediaRows,
    profileRows,
  };
}

export async function getPendingPrivacyReviews(
  supabase: SupabaseClient,
): Promise<PendingPrivacyReviewRow[]> {
  const { data, error } = await queryCompleteDashboardRows(
    supabase
      .from("pending_user_privacy_requests")
      .select(
        "request_id,user_id,name,email,passport_requests,id_card_requests,status,type,created_at",
      )
      .order("created_at", { ascending: false })
      .order("request_id", { ascending: false })
      .returns<PendingPrivacyReviewRow[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPendingMediaReviews(
  supabase: SupabaseClient,
): Promise<PendingMediaReviewWithPreview[]> {
  const { data, error } = await queryCompleteDashboardRows(
    supabase
      .from("pending_user_media_assets")
      .select(PENDING_MEDIA_REVIEW_SELECT)
      .order("created_at", { ascending: false })
      .order("asset_id", { ascending: false })
      .returns<PendingMediaReviewRow[]>(),
  );

  if (error) {
    throw error;
  }

  return attachMediaPreviewUrls(supabase, data ?? []);
}
