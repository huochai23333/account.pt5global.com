"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  getCurrentUserBundle,
  type CurrentUserBundle,
} from "@/lib/user-self-service";
import { type MediaAssetKey, toErrorMessage } from "../dashboard-shared-ui";
import {
  useWorkspaceRecoverCloudSync,
  useWorkspaceSyncEffect,
} from "../workspace-session-provider";
import {
  refreshDashboardSharedMyBundle,
  type DashboardSharedMyNotice,
  type DashboardSharedMyRefreshOptions,
} from "./dashboard-shared-my-refresh";
import type { DashboardSharedCopy } from "./dashboard-shared-my-state-copy";

type BundleOptions = {
  initialData: CurrentUserBundle | null;
  activeDialog: MediaAssetKey | null;
  setBusyKey: Dispatch<SetStateAction<string | null>>;
  setDialogNotice: Dispatch<SetStateAction<DashboardSharedMyNotice | null>>;
  sharedCopy: DashboardSharedCopy;
};

/** 只管理本人资料的首屏读取、恢复和写后刷新；证件草稿和业务写入由各自 Hook 维护。 */
export function useDashboardMyBundle({
  initialData,
  activeDialog,
  setBusyKey,
  setDialogNotice,
  sharedCopy,
}: BundleOptions) {
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();
  const recoverWorkspaceCloudSync = useWorkspaceRecoverCloudSync();
  const hasLoadedInitialBundleRef = useRef(Boolean(initialData));
  const [bundle, setBundle] = useState<CurrentUserBundle | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<DashboardSharedMyNotice | null>(
    null,
  );

  const recoverCloudSync = useCallback(() => {
    setPageError(null);
    setPageNotice(null);
    setLoading(true);
    recoverWorkspaceCloudSync();
  }, [recoverWorkspaceCloudSync]);

  const loadBundle = useCallback(
    async ({
      isMounted,
      showLoading,
    }: {
      isMounted: () => boolean;
      showLoading: boolean;
    }) => {
      if (!supabase) return;
      if (showLoading && isMounted()) setLoading(true);
      try {
        const nextBundle = await getCurrentUserBundle(supabase);
        // 页面已卸载或本轮恢复已失效时，不把迟到结果写回界面。
        if (!isMounted()) return;
        if (!nextBundle) {
          router.replace("/login");
          return;
        }
        setBundle(nextBundle);
        setPageError(null);
      } catch (error) {
        if (isMounted()) setPageError(toErrorMessage(error, sharedCopy));
      } finally {
        if (isMounted()) setLoading(false);
      }
    },
    [router, sharedCopy, supabase],
  );

  useEffect(() => {
    if (initialData !== null || !supabase || hasLoadedInitialBundleRef.current)
      return;
    let mounted = true;
    hasLoadedInitialBundleRef.current = true;
    void loadBundle({ isMounted: () => mounted, showLoading: true });
    return () => {
      mounted = false;
    };
  }, [initialData, loadBundle, supabase]);

  useWorkspaceSyncEffect(({ isMounted, syncVersion }) => {
    if (syncVersion === 0 || !supabase) return;
    hasLoadedInitialBundleRef.current = true;
    return loadBundle({ isMounted, showLoading: !bundle });
  });

  // 写入动作已独立取得凭证；刷新失败继续交给原动作处理，不能覆盖成“全部完成”。
  const refreshBundle = (options: DashboardSharedMyRefreshOptions = {}) =>
    refreshDashboardSharedMyBundle(
      {
        activeDialog,
        onRequireLogin: () => router.replace("/login"),
        setBundle,
        setBusyKey,
        setDialogNotice,
        setPageError,
        setPageNotice,
        sharedCopy,
        supabase,
      },
      options,
    );

  return {
    bundle,
    loading,
    pageError,
    pageNotice,
    recoverCloudSync,
    refreshBundle,
    setPageNotice,
    supabase,
  };
}
