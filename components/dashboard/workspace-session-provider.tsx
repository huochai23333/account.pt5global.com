"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { usePathname, useRouter } from "next/navigation";

import {
  getDefaultWorkspaceBasePath,
  getWorkspaceBasePath,
} from "@/lib/auth-routing";
import {
  getRoleFromAuthClaims,
  getRoleFromAuthSession,
} from "@/lib/auth-session-client";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useBrowserCloudSyncRecovery } from "@/lib/use-browser-cloud-sync-recovery";
import { useResumeRecovery } from "@/lib/use-resume-recovery";
import { useSupabaseAuthSync } from "@/lib/use-supabase-auth-sync";

type WorkspaceSessionContextValue = {
  recoverCloudSync: () => void;
  syncVersion: number;
};

type WorkspaceSyncEffectContext = {
  isMounted: () => boolean;
  syncVersion: number;
};

const WorkspaceSessionContext = createContext<WorkspaceSessionContextValue>({
  recoverCloudSync: () => {},
  syncVersion: 0,
});

// 共享登录/恢复事件，只递增刷新版本；业务 Hook 订阅后自行读取，不在外壳缓存业务结果。
export function WorkspaceSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getBrowserSupabaseClient();
  const { recoverCloudSync, syncGeneration } = useBrowserCloudSyncRecovery();
  const [syncVersion, setSyncVersion] = useState(0);
  const hasHandledInitialReadyRef = useRef(false);

  const bumpSyncVersion = useCallback(() => {
    setSyncVersion((current) => current + 1);
  }, []);

  useSupabaseAuthSync(supabase, {
    includeInitialSessionEvent: true,
    refreshKey: syncGeneration,
    onReady: ({ isMounted }) => {
      if (!hasHandledInitialReadyRef.current) {
        hasHandledInitialReadyRef.current = true;
        return;
      }

      if (!isMounted()) {
        return;
      }

      bumpSyncVersion();
    },
    onAuthStateChange: async ({ event, isMounted, session }) => {
      if (!isMounted()) {
        return;
      }

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      if (!supabase) {
        return;
      }

      const currentBasePath = getWorkspaceBasePath(pathname);

      if (currentBasePath) {
        // 浏览器角色仅用于把页面带回正确工作区，目标页及数据接口仍须验证当前数据库权限。
        const role =
          (await getRoleFromAuthClaims(supabase, session.user)) ??
          getRoleFromAuthSession(session);

        if (role) {
          const desiredBasePath = getDefaultWorkspaceBasePath(role);

          if (currentBasePath !== desiredBasePath) {
            const suffix = pathname.slice(currentBasePath.length) || "/home";
            router.replace(`${desiredBasePath}${suffix}`);
            return;
          }
        }
      }

      if (event === "INITIAL_SESSION") {
        return;
      }

      bumpSyncVersion();
    },
  });

  useResumeRecovery(recoverCloudSync, {
    enabled: Boolean(supabase),
  });

  const value = useMemo(
    () => ({
      recoverCloudSync,
      syncVersion,
    }),
    [recoverCloudSync, syncVersion],
  );

  return (
    <WorkspaceSessionContext.Provider value={value}>
      {children}
    </WorkspaceSessionContext.Provider>
  );
}

export function useWorkspaceSyncVersion() {
  return useContext(WorkspaceSessionContext).syncVersion;
}

export function useWorkspaceRecoverCloudSync() {
  return useContext(WorkspaceSessionContext).recoverCloudSync;
}

export function useWorkspaceSyncEffect(
  effect: (context: WorkspaceSyncEffectContext) => Promise<void> | void,
) {
  const syncVersion = useWorkspaceSyncVersion();

  useEffect(() => {
    if (syncVersion === 0) {
      return;
    }

    let mounted = true;

    void effect({
      isMounted: () => mounted,
      syncVersion,
    });

    return () => {
      // 已发出的异步请求不一定能取消；调用方用 isMounted 拒绝卸载后回写旧结果。
      mounted = false;
    };
  }, [effect, syncVersion]);
}
