import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import {
  ensureSessionTracking,
  getSessionCache,
  startSessionCacheRequest,
} from "./current-session-cache";
import { withRequestTimeout } from "./request-timeout";

const AUTH_SESSION_TIMEOUT_MS = 8_000;
const AUTH_SESSION_RETRY_DELAY_MS = 350;
const AUTH_SESSION_TIMEOUT_MESSAGE = "登录状态同步较慢，请稍后重试。";

export async function getCurrentSession(
  supabase: SupabaseClient,
): Promise<Session | null> {
  const sessionCache = getSessionCache(supabase);
  ensureSessionTracking(supabase, sessionCache);

  if (sessionCache.currentSessionSnapshot !== undefined) {
    return sessionCache.currentSessionSnapshot;
  }
  if (!sessionCache.currentSessionRequest) {
    sessionCache.currentSessionRequest = startSessionCacheRequest(
      sessionCache,
      (isCurrent) => resolveWithSingleTimeoutRetry(
        () => fetchCurrentSession(supabase),
        () => isCurrent() ? sessionCache.currentSessionSnapshot : null,
      ),
      (session) => { sessionCache.currentSessionSnapshot = session; },
      () => { sessionCache.currentSessionRequest = null; },
    );
  }
  return sessionCache.currentSessionRequest;
}

export async function getCurrentUser(
  supabase: SupabaseClient,
): Promise<User | null> {
  const sessionCache = getSessionCache(supabase);
  ensureSessionTracking(supabase, sessionCache);

  if (sessionCache.currentUserSnapshot !== undefined) {
    return sessionCache.currentUserSnapshot;
  }
  if (!sessionCache.currentUserRequest) {
    sessionCache.currentUserRequest = startSessionCacheRequest(
      sessionCache,
      (isCurrent) => resolveWithSingleTimeoutRetry(
        () => fetchCurrentUser(supabase),
        () => isCurrent() ? sessionCache.currentUserSnapshot : null,
      ),
      (user) => { sessionCache.currentUserSnapshot = user; },
      () => { sessionCache.currentUserRequest = null; },
    );
  }
  return sessionCache.currentUserRequest;
}

export async function getCurrentClaims(
  supabase: SupabaseClient,
): Promise<unknown | null> {
  const sessionCache = getSessionCache(supabase);
  ensureSessionTracking(supabase, sessionCache);

  if (
    sessionCache.currentSessionSnapshot === null ||
    sessionCache.currentUserSnapshot === null
  ) {
    sessionCache.currentClaimsSnapshot = null;
    return null;
  }
  if (sessionCache.currentClaimsSnapshot !== undefined) {
    return sessionCache.currentClaimsSnapshot;
  }
  if (!sessionCache.currentClaimsRequest) {
    sessionCache.currentClaimsRequest = startSessionCacheRequest(
      sessionCache,
      () => fetchCurrentClaims(supabase),
      (claims) => { sessionCache.currentClaimsSnapshot = claims; },
      () => { sessionCache.currentClaimsRequest = null; },
    );
  }
  return sessionCache.currentClaimsRequest;
}

async function fetchCurrentSession(supabase: SupabaseClient) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

async function fetchCurrentUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    if (isAuthSessionMissingError(error)) return null;
    throw error;
  }
  return user;
}

async function fetchCurrentClaims(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : (data?.claims ?? null);
}

async function resolveWithSingleTimeoutRetry<T>(
  request: () => Promise<T>,
  readSnapshot: () => T | null | undefined,
) {
  try {
    return await runTimedRequest(request);
  } catch (error) {
    const snapshot = readSnapshot();
    if (snapshot !== undefined) return snapshot;
    if (!isSessionTimeoutError(error)) throw error;

    // 浏览器刚恢复或网络短暂抖动时只重试一次，避免多个调用方形成重试风暴。
    await delay(AUTH_SESSION_RETRY_DELAY_MS);
    const delayedSnapshot = readSnapshot();
    if (delayedSnapshot !== undefined) return delayedSnapshot;

    return runTimedRequest(request);
  }
}

function runTimedRequest<T>(request: () => Promise<T>) {
  return withRequestTimeout(request(), {
    timeoutMs: AUTH_SESSION_TIMEOUT_MS,
    message: AUTH_SESSION_TIMEOUT_MESSAGE,
  });
}

function isSessionTimeoutError(error: unknown) {
  return error instanceof Error && error.message === AUTH_SESSION_TIMEOUT_MESSAGE;
}

function isAuthSessionMissingError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AuthSessionMissingError" ||
      error.message.toLowerCase().includes("auth session missing"))
  );
}

function delay(timeoutMs: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, timeoutMs);
  });
}
