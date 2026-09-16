import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import {
  requireProfileRequestReceipt,
  requireProfileWriteReceipt,
} from "./profile-operation-receipts";
import type { UserProfileRow } from "./user-self-service";

export type ProfileChangeRequestStatus = "pending" | "approved" | "rejected";

export type UserProfileChangeRequestRow = {
  id: string;
  user_id: string;
  previous_name: string | null;
  requested_name: string;
  previous_city: string | null;
  requested_city: string;
  status: ProfileChangeRequestStatus;
  reviewer_user_id: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

export type PendingProfileChangeReviewRow = {
  request_id: string;
  user_id: string;
  current_name: string | null;
  email: string | null;
  current_city: string | null;
  previous_name: string | null;
  requested_name: string;
  previous_city: string | null;
  requested_city: string;
  status: "pending";
  created_at: string;
};

const PROFILE_MUTATION_TIMEOUT_MS = 20_000;
const PROFILE_MUTATION_TIMEOUT_MESSAGE =
  "Profile change timed out. Please try again.";

const USER_PROFILE_SELECT =
  "user_id,name,phone,email,status,city,referral_code,created_at";

export async function updateCurrentUserProfile(
  supabase: SupabaseClient,
  options: {
    city: string;
    name: string;
    userId: string;
  },
) {
  const normalizedName = options.name.trim();
  const normalizedCity = options.city.trim();

  if (!normalizedName || !normalizedCity) {
    throw new Error("Profile name and city are required.");
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("user_profiles")
      .update({
        city: normalizedCity,
        name: normalizedName,
      })
      .eq("user_id", options.userId)
      .select(USER_PROFILE_SELECT)
      .maybeSingle<UserProfileRow>(),
    {
      timeoutMs: PROFILE_MUTATION_TIMEOUT_MS,
      message: PROFILE_MUTATION_TIMEOUT_MESSAGE,
    },
  );

  if (error) {
    throw error;
  }

  requireProfileWriteReceipt(data, {
    city: normalizedCity,
    name: normalizedName,
    userId: options.userId,
  });

  return data;
}

export async function submitProfileChangeRequest(
  supabase: SupabaseClient,
  options: {
    city: string;
    name: string;
  },
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .rpc("submit_profile_change_request", {
        _requested_city: options.city,
        _requested_name: options.name,
      })
      .maybeSingle<UserProfileChangeRequestRow>(),
    {
      timeoutMs: PROFILE_MUTATION_TIMEOUT_MS,
      message: PROFILE_MUTATION_TIMEOUT_MESSAGE,
    },
  );

  if (error) {
    throw error;
  }

  requireProfileRequestReceipt(data, {
    city: options.city.trim(),
    name: options.name.trim(),
    status: "pending",
  });

  return data;
}

export async function getPendingProfileChangeReviews(
  supabase: SupabaseClient,
): Promise<PendingProfileChangeReviewRow[]> {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("pending_user_profile_change_requests")
      .select(
        "request_id,user_id,current_name,email,current_city,previous_name,requested_name,previous_city,requested_city,status,created_at",
      )
      .order("created_at", { ascending: false })
      .returns<PendingProfileChangeReviewRow[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function approveProfileChangeRequest(
  supabase: SupabaseClient,
  requestId: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .rpc("approve_profile_change_request", {
        _request_id: requestId,
      })
      .maybeSingle<UserProfileChangeRequestRow>(),
    {
      timeoutMs: PROFILE_MUTATION_TIMEOUT_MS,
      message: PROFILE_MUTATION_TIMEOUT_MESSAGE,
    },
  );

  if (error) {
    throw error;
  }

  requireProfileRequestReceipt(data, {
    requestId,
    status: "approved",
  });

  return data;
}

export async function rejectProfileChangeRequest(
  supabase: SupabaseClient,
  requestId: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .rpc("reject_profile_change_request", {
        _request_id: requestId,
      })
      .maybeSingle<UserProfileChangeRequestRow>(),
    {
      timeoutMs: PROFILE_MUTATION_TIMEOUT_MS,
      message: PROFILE_MUTATION_TIMEOUT_MESSAGE,
    },
  );

  if (error) {
    throw error;
  }

  requireProfileRequestReceipt(data, {
    requestId,
    status: "rejected",
  });

  return data;
}
