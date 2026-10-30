import type { Session } from "@supabase/supabase-js";

import { AuthFlowError, classifyAuthFailure, isRetryableAuthFailure, type AuthFailureKind } from "./auth-failure";
import { waitForAuthTask } from "./auth-request-transport";
import type { VerifiedLoginContext } from "./login-context";

export type LoginPhase = "password" | "session" | "access" | "navigation";
export type LoginRecoveryState = {
  busy: boolean;
  canRecover: boolean;
  failure: AuthFailureKind | null;
  outcome: "idle" | "pending" | "failed" | "unverified" | "partial_failed";
  phase: LoginPhase;
};
export const INITIAL_LOGIN_STATE: LoginRecoveryState = {
  busy: false, canRecover: false, failure: null, outcome: "idle", phase: "session",
};
type Dependencies = {
  signIn: (email: string, password: string) => Promise<Session | null>;
  readSession: () => Promise<Session | null>;
  verify: (session: Session, email: string | undefined, onAuthenticated: () => void) => Promise<VerifiedLoginContext>;
  withSignal: <T>(signal: AbortSignal, task: () => Promise<T>) => Promise<T>;
  clearSession: () => Promise<void>;
  onVerified: (context: VerifiedLoginContext, session: Session) => Promise<void> | void;
  onState: (state: LoginRecoveryState) => void;
  diagnose?: (event: Record<string, string | number>) => void;
};

/** 所有认证入口共用一次有界流程；事件只提供候选会话，不能直接触发成功跳转。 */
export class LoginRecoveryCoordinator {
  private state = INITIAL_LOGIN_STATE;
  private generation = 0;
  private disposed = false;
  private active: AbortController | null = null;
  private expectedEmail: string | undefined;
  private eventToken: string | undefined;
  private onlineRecoveryUsed = false;
  private allowAutomaticRecovery = true;
  private candidateUserId: string | undefined;

  constructor(private readonly dependencies: Dependencies,
    private readonly timing = { totalMs: 30_000, retryMs: 500 }) {}

  signIn(email: string, password: string) {
    if (this.active || this.disposed) return Promise.resolve();
    this.expectedEmail = email.trim();
    this.onlineRecoveryUsed = false;
    this.allowAutomaticRecovery = true;
    return this.run({ email: this.expectedEmail, password });
  }

  recover() {
    if (this.active || this.disposed) return Promise.resolve();
    this.onlineRecoveryUsed = false;
    this.allowAutomaticRecovery = true;
    return this.run();
  }

  onAuthSession(session: Session | null) {
    if (this.active && session && this.candidateUserId && this.candidateUserId !== session.user.id) {
      this.active.abort(new AuthFlowError("accountMismatch"));
      return;
    }
    if (!session || this.active || this.disposed || !this.allowAutomaticRecovery || this.eventToken === session.access_token) return;
    this.eventToken = session.access_token;
    void this.run(undefined, session);
  }

  onSignedOut() {
    this.active?.abort(new AuthFlowError("invalidSession"));
  }

  onOnline() {
    if (!this.state.canRecover || this.onlineRecoveryUsed || this.active || this.disposed) return;
    this.onlineRecoveryUsed = true;
    void this.run();
  }

  dispose() {
    this.disposed = true;
    this.generation += 1;
    this.active?.abort(new AuthFlowError("timeout"));
    this.active = null;
  }

  private publish(next: LoginRecoveryState) {
    this.state = next;
    this.dependencies.onState(next);
  }

  private async run(credentials?: { email: string; password: string }, candidate?: Session) {
    const generation = ++this.generation;
    const controller = new AbortController();
    const signal = controller.signal;
    const attemptId = crypto.randomUUID();
    const started = Date.now();
    let phase: LoginPhase = credentials ? "password" : "session";
    let authenticated = false;
    this.active = controller;
    this.publish({ busy: true, canRecover: false, failure: null, outcome: "pending", phase });
    const timer = setTimeout(() => controller.abort(new AuthFlowError("timeout")), this.timing.totalMs);
    const isCurrent = () => !this.disposed && generation === this.generation;
    const assertCurrent = () => {
      if (!isCurrent() || signal.aborted) throw signal.reason ?? new AuthFlowError("timeout");
    };
    const changePhase = (next: LoginPhase) => {
      assertCurrent();
      phase = next;
      this.publish({ ...this.state, phase });
    };

    try {
      await waitForAuthTask(this.dependencies.withSignal(signal, async () => {
        let session = candidate ?? null;
        let signInFailure: unknown;
        if (credentials) {
          try {
            session = await this.dependencies.signIn(credentials.email, credentials.password);
            authenticated = Boolean(session);
          } catch (error) {
            // 密码请求只发送一次；网络结果不明时改为读取已有会话，不重放密码。
            if (!isRetryableAuthFailure(error)) throw error;
            signInFailure = error;
          }
        }
        changePhase("session");
        for (let attempt = 0; attempt < 2; attempt += 1) {
          assertCurrent();
          try {
            session ??= await this.dependencies.readSession();
            assertCurrent();
            if (!session) throw signInFailure ?? new AuthFlowError("invalidSession");
            this.candidateUserId = session.user.id;
            const context = await this.dependencies.verify(session, this.expectedEmail, () => {
              authenticated = true;
              changePhase("access");
            });
            assertCurrent();
            changePhase("navigation");
            await this.dependencies.onVerified(context, session);
            // replace() 只表示开始导航；表单卸载才结束等待。导航没有落地时仍会超时并提供恢复。
            await waitForAuthTask(new Promise<void>(() => undefined), signal);
            return;
          } catch (error) {
            if (signal.aborted || attempt === 1 || !isRetryableAuthFailure(error)) throw error;
            await waitForAuthTask(new Promise<void>((resolve) => {
              const delay = setTimeout(resolve, this.timing.retryMs);
              signal.addEventListener("abort", () => clearTimeout(delay), { once: true });
            }), signal);
          }
        }
      }), signal);
    } catch (error) {
      if (!isCurrent()) return;
      const failure = classifyAuthFailure(error);
      if (failure === "invalidSession" || failure === "accountInactive") {
        await this.dependencies.clearSession();
        if (!isCurrent()) return;
      }
      const canRecover = isRetryableAuthFailure(error) || failure === "accessUnavailable" || failure === "busy";
      this.allowAutomaticRecovery = canRecover;
      this.publish({ busy: false, canRecover, failure, phase,
        outcome: authenticated && canRecover ? "partial_failed" : canRecover ? "unverified" : "failed" });
      // 仅输出白名单字段；不能把 Error 对象、账号或 SDK 请求参数交给日志。
      this.dependencies.diagnose?.({ event: "pt5.auth", attemptId, occurredAt: new Date().toISOString(),
        phase, durationMs: Date.now() - started, category: failure, outcome: this.state.outcome });
    } finally {
      clearTimeout(timer);
      if (generation === this.generation) {
        this.active = null;
        this.candidateUserId = undefined;
      }
    }
  }
}
