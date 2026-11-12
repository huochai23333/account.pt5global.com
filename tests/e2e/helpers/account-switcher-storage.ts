import type { Page } from "@playwright/test";

// 存储故障只注入当前测试页面，摘要只返回身份和状态，避免输出会话令牌。
const STORED_ACCOUNT_KEY =
  "pt5-dropshipping.account-switcher.v2.alternate";
const PENDING_LOGIN_KEY =
  "pt5-dropshipping.account-switcher.v2.pending";

export async function expireStoredAccount(page: Page) {
  await page.evaluate((storageKey) => {
    const rawAccount = window.localStorage.getItem(storageKey);

    if (!rawAccount) {
      throw new Error("Expected a stored alternate account before expiring it.");
    }

    const account = JSON.parse(rawAccount) as Record<string, unknown>;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ ...account, expiresAt: Date.now() - 1 }),
    );
  }, STORED_ACCOUNT_KEY);
}

export async function replaceStoredSessionWithInvalidTokens(page: Page) {
  await page.evaluate((storageKey) => {
    const rawAccount = window.localStorage.getItem(storageKey);

    if (!rawAccount) {
      throw new Error("Expected a stored alternate account before invalidating it.");
    }

    const account = JSON.parse(rawAccount) as Record<string, unknown>;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...account,
        session: {
          accessToken: "invalid-access-token",
          refreshToken: "invalid-refresh-token",
        },
      }),
    );
  }, STORED_ACCOUNT_KEY);
}

export async function readStoredAccountSummary(page: Page) {
  return page.evaluate((storageKey) => {
    const rawAccount = window.localStorage.getItem(storageKey);

    if (!rawAccount) {
      return null;
    }

    const account = JSON.parse(rawAccount) as Record<string, unknown>;
    const expiresAt =
      typeof account.expiresAt === "number" ? account.expiresAt : null;

    return {
      email: typeof account.email === "string" ? account.email : null,
      hasSession: Object.hasOwn(account, "session"),
      reauthenticationReason:
        typeof account.reauthenticationReason === "string"
          ? account.reauthenticationReason
          : null,
      remainingDays:
        expiresAt === null
          ? null
          : Math.floor((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)),
      state: typeof account.state === "string" ? account.state : null,
    };
  }, STORED_ACCOUNT_KEY);
}

export async function readPendingLoginSummary(page: Page) {
  return page.evaluate((storageKey) => {
    const rawPending = window.sessionStorage.getItem(storageKey);

    if (!rawPending) {
      return null;
    }

    const pending = JSON.parse(rawPending) as {
      currentAccount?: { email?: unknown };
      kind?: unknown;
      targetAccount?: { email?: unknown };
    };

    return {
      currentEmail:
        typeof pending.currentAccount?.email === "string"
          ? pending.currentAccount.email
          : null,
      kind: typeof pending.kind === "string" ? pending.kind : null,
      targetEmail:
        typeof pending.targetAccount?.email === "string"
          ? pending.targetAccount.email
          : null,
    };
  }, PENDING_LOGIN_KEY);
}
