import { useEffect, useEffectEvent } from "react";
import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  isPageVisibilityAbortError,
  waitForPageVisible,
} from "./page-visibility";

type AuthSyncContext = {
  isMounted: () => boolean;
  signal: AbortSignal;
};

type AuthStateChangeContext = AuthSyncContext & {
  event: AuthChangeEvent;
  session: Session | null;
};

type UseSupabaseAuthSyncOptions = {
  includeInitialSessionEvent?: boolean;
  onAuthStateChange?: (context: AuthStateChangeContext) => Promise<void> | void;
  onError?: (error: unknown, context: AuthSyncContext) => void;
  onReady?: (context: AuthSyncContext) => Promise<void> | void;
  refreshKey?: unknown;
  waitForVisibleOnAuthStateChange?: boolean;
};

export function useSupabaseAuthSync(
  supabase: SupabaseClient | null,
  {
    includeInitialSessionEvent = false,
    onAuthStateChange,
    onError,
    onReady,
    refreshKey,
    waitForVisibleOnAuthStateChange = true,
  }: UseSupabaseAuthSyncOptions,
) {
  const runReady = useEffectEvent(async (context: AuthSyncContext) => {
    await onReady?.(context);
  });

  const runAuthStateChange = useEffectEvent(async (context: AuthStateChangeContext) => {
    await onAuthStateChange?.(context);
  });

  const handleError = useEffectEvent((error: unknown, context: AuthSyncContext) => {
    onError?.(error, context);
  });
  const hasReadyListener = Boolean(onReady);
  const hasAuthStateChangeListener = Boolean(onAuthStateChange);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;
    const abortController = new AbortController();
    const pendingTimers = new Set<ReturnType<typeof globalThis.setTimeout>>();
    const context: AuthSyncContext = {
      isMounted: () => mounted,
      signal: abortController.signal,
    };

    const runSync = async (
      callback: (() => Promise<void> | void) | undefined,
      waitForVisible: boolean,
    ) => {
      if (!callback) {
        return;
      }

      try {
        if (waitForVisible) {
          await waitForPageVisible({ signal: abortController.signal });
        }

        if (!mounted) {
          return;
        }

        await callback();
      } catch (error) {
        if (isPageVisibilityAbortError(error) || !mounted) {
          return;
        }

        handleError(error, context);
      }
    };

    if (hasReadyListener) {
      void runSync(() => runReady(context), true);
    }

    const authListener = hasAuthStateChangeListener
      ? supabase.auth.onAuthStateChange((event, session) => {
          if (!mounted) {
            return;
          }

          if (event === "INITIAL_SESSION" && !includeInitialSessionEvent) {
            return;
          }

          // 后续任务延迟到 Auth 回调之外，避免嵌套身份读取争用同一令牌锁而互相等待。
          const timerId = globalThis.setTimeout(() => {
            pendingTimers.delete(timerId);

            if (!mounted) {
              return;
            }

            void runSync(
              () =>
                runAuthStateChange({
                  ...context,
                  event,
                  session,
                }),
              waitForVisibleOnAuthStateChange,
            );
          }, 0);

          pendingTimers.add(timerId);
        })
      : null;

    return () => {
      mounted = false;
      abortController.abort();
      pendingTimers.forEach((timerId) => {
        globalThis.clearTimeout(timerId);
      });
      pendingTimers.clear();
      authListener?.data.subscription.unsubscribe();
    };
  }, [
    hasAuthStateChangeListener,
    hasReadyListener,
    includeInitialSessionEvent,
    supabase,
    waitForVisibleOnAuthStateChange,
    refreshKey,
  ]);
}
