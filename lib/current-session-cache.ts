import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import type { AppRole } from "./auth-routing";
import type { UserStatus } from "./auth-metadata";

const SESSION_TRACKING_REGISTRY_KEY =
  "__pt5DropshippingSessionTrackingRegistry__" as const;

export type AppAccessContext = {
  role: AppRole | null;
  status: UserStatus | null;
};

/**
 * 同一个 Supabase 客户端在一次页面渲染中可能被多个组件共同使用。
 * 这里集中保存请求与快照，让各读取模块复用结果，而不是分别请求登录状态。
 */
export type SessionCacheState = {
  currentAccessContextRequest: Promise<AppAccessContext | null> | null;
  currentAccessContextSnapshot: AppAccessContext | null | undefined;
  currentClaimsRequest: Promise<unknown | null> | null;
  currentClaimsSnapshot: unknown | null | undefined;
  currentSessionRequest: Promise<Session | null> | null;
  currentSessionSnapshot: Session | null | undefined;
  currentUserRequest: Promise<User | null> | null;
  currentUserSnapshot: User | null | undefined;
  sessionTrackingCleanup: (() => void) | null;
  sessionTrackingReady: boolean;
  resetVersion: number;
  generation: number;
};

const sessionCacheByClient = new WeakMap<SupabaseClient, SessionCacheState>();
let sessionCacheResetVersion = 0;

export function resetCurrentAuthContextCache() {
  sessionCacheResetVersion += 1;
}

export function getSessionCache(supabase: SupabaseClient) {
  const existingCache = sessionCacheByClient.get(supabase);

  if (existingCache) {
    if (existingCache.resetVersion !== sessionCacheResetVersion) {
      // 重置时同时取消旧监听，防止登出后仍由过期订阅写回旧用户。
      existingCache.sessionTrackingCleanup?.();
      invalidateSessionReads(existingCache, undefined);
      existingCache.sessionTrackingCleanup = null;
      existingCache.sessionTrackingReady = false;
      existingCache.resetVersion = sessionCacheResetVersion;
    }

    return existingCache;
  }

  const sessionCache: SessionCacheState = {
    currentAccessContextRequest: null,
    currentAccessContextSnapshot: undefined,
    currentClaimsRequest: null,
    currentClaimsSnapshot: undefined,
    currentSessionRequest: null,
    currentSessionSnapshot: undefined,
    currentUserRequest: null,
    currentUserSnapshot: undefined,
    sessionTrackingCleanup: null,
    sessionTrackingReady: false,
    resetVersion: sessionCacheResetVersion,
    generation: 0,
  };

  sessionCacheByClient.set(supabase, sessionCache);
  return sessionCache;
}

export function ensureSessionTracking(
  supabase: SupabaseClient,
  sessionCache: SessionCacheState,
) {
  if (sessionCache.sessionTrackingReady) return;

  const sessionTrackingRegistry = getSessionTrackingRegistry();
  sessionTrackingRegistry.get(supabase)?.();

  let active = true;
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (!active || sessionCache.resetVersion !== sessionCacheResetVersion) return;
    // INITIAL_SESSION 是订阅时的首次通知，首轮读取会自行核实身份。
    if (event === "INITIAL_SESSION") return;
    invalidateSessionReads(sessionCache, session);
  });

  const cleanup = () => {
    active = false;
    subscription.unsubscribe();
    if (sessionTrackingRegistry.get(supabase) === cleanup) {
      sessionTrackingRegistry.delete(supabase);
    }
    if (sessionCache.sessionTrackingCleanup === cleanup) {
      sessionCache.sessionTrackingCleanup = null;
      sessionCache.sessionTrackingReady = false;
    }
  };

  sessionCache.sessionTrackingCleanup = cleanup;
  sessionCache.sessionTrackingReady = true;
  sessionTrackingRegistry.set(supabase, cleanup);
}

function invalidateSessionReads(cache: SessionCacheState, session: Session | null | undefined) {
  cache.generation += 1;
  cache.currentAccessContextRequest = null;
  cache.currentAccessContextSnapshot = undefined;
  cache.currentClaimsRequest = null;
  cache.currentClaimsSnapshot = undefined;
  cache.currentSessionRequest = null;
  cache.currentSessionSnapshot = session;
  cache.currentUserRequest = null;
  cache.currentUserSnapshot = session === null ? null : undefined;
}

export function watchSessionCache(cache: SessionCacheState) {
  const generation = cache.generation;
  return () => generation === cache.generation && cache.resetVersion === sessionCacheResetVersion;
}

/** 旧请求不能发布身份，也不能清空新代次的请求槽。明确返回空值可阻止旧调用继续操作。 */
export function startSessionCacheRequest<T>(
  cache: SessionCacheState,
  load: (isCurrent: () => boolean) => Promise<T | null>,
  store: (value: T | null) => void,
  clear: () => void,
) {
  const isCurrent = watchSessionCache(cache);
  return load(isCurrent).then(
    (value) => {
      if (!isCurrent()) return null;
      store(value);
      return value;
    },
    (error: unknown) => {
      if (!isCurrent()) return null;
      throw error;
    },
  ).finally(() => {
    if (isCurrent()) clear();
  });
}

function getSessionTrackingRegistry() {
  const globalScope = globalThis as typeof globalThis & {
    [SESSION_TRACKING_REGISTRY_KEY]?: WeakMap<SupabaseClient, () => void>;
  };

  if (!globalScope[SESSION_TRACKING_REGISTRY_KEY]) {
    globalScope[SESSION_TRACKING_REGISTRY_KEY] = new WeakMap<
      SupabaseClient,
      () => void
    >();
  }

  return globalScope[SESSION_TRACKING_REGISTRY_KEY];
}
