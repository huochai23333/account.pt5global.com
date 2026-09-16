"use client";

import { useState } from "react";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  submitProfileChangeRequest,
  updateCurrentUserProfile,
} from "@/lib/profile-change-requests";
import type { AppRole, UserProfileRow } from "@/lib/user-self-service";
import { runVerifiedActionWithRefresh } from "@/lib/verified-action-outcome";

import {
  toErrorMessage,
  type FeedbackTone,
} from "../dashboard-shared-ui";
import type {
  DashboardSharedCopy,
  DashboardSharedMyStateCopy,
} from "./dashboard-shared-my-state-copy";

type ProfileNotice = {
  tone: FeedbackTone;
  message: string;
} | null;

type UseDashboardProfileDialogOptions = {
  authUser: User | null;
  copy: DashboardSharedMyStateCopy;
  profile: UserProfileRow | null;
  refreshBundle: (options?: {
    quiet?: boolean;
    throwOnError?: boolean;
  }) => Promise<void>;
  role: AppRole | null;
  setBusyKey: (value: string | null) => void;
  setPageNotice: (notice: ProfileNotice) => void;
  sharedCopy: DashboardSharedCopy;
  supabase: SupabaseClient | null;
};

export function useDashboardProfileDialog({
  authUser,
  copy,
  profile,
  refreshBundle,
  role,
  setBusyKey,
  setPageNotice,
  sharedCopy,
  supabase,
}: UseDashboardProfileDialogOptions) {
  const [notice, setNotice] = useState<ProfileNotice>(null);
  const [open, setOpen] = useState(false);
  const [cityDraft, setCityDraft] = useState("");
  const [nameDraft, setNameDraft] = useState("");

  const openDialog = () => {
    setNotice(null);
    setNameDraft(profile?.name ?? authUser?.user_metadata?.name ?? "");
    setCityDraft(profile?.city ?? authUser?.user_metadata?.city ?? "");
    setOpen(true);
  };

  const close = (nextOpen: boolean) => {
    if (nextOpen) {
      return;
    }

    setOpen(false);
    setNotice(null);
  };

  const saveProfile = async () => {
    if (!supabase || !authUser) {
      return;
    }

    if (!nameDraft.trim() || !cityDraft.trim()) {
      setNotice({ tone: "error", message: copy.profileRequired });
      return;
    }

    setBusyKey("profile-save");
    setNotice(null);

    try {
      if (role === "administrator") {
        const outcome = await runVerifiedActionWithRefresh(
          () =>
            updateCurrentUserProfile(supabase, {
              city: cityDraft,
              name: nameDraft,
              userId: authUser.id,
            }).then(() => undefined),
          () => refreshBundle({ quiet: true, throwOnError: true }),
        );
        if (outcome === "refreshing") {
          setNotice({ tone: "info", message: copy.profileSavedRefreshing });
          setPageNotice({ tone: "info", message: copy.profileSavedRefreshing });
          return;
        }
        setNotice({ tone: "success", message: copy.profileSaved });
        setPageNotice({ tone: "success", message: copy.profileSaved });
        return;
      }

      await submitProfileChangeRequest(supabase, {
        city: cityDraft,
        name: nameDraft,
      });
      setNotice({ tone: "success", message: copy.profileChangeSubmitted });
      setPageNotice({ tone: "success", message: copy.profileChangeSubmitted });
    } catch (error) {
      setNotice({ tone: "error", message: toErrorMessage(error, sharedCopy) });
    } finally {
      setBusyKey(null);
    }
  };

  return {
    cityDraft,
    close,
    nameDraft,
    notice,
    open,
    openDialog,
    saveProfile,
    setCityDraft,
    setNameDraft,
  };
}
