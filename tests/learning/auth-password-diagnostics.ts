import { expect, type Page } from "@playwright/test";

type Message = { origin: string; phase: string; text: string; path: string };
type FailedRequest = {
  origin: string;
  method: string;
  path: string;
  reason: string;
};

/** 检查实际未确认提示的排版；密码框显式遮盖，截图不能成为凭据副本。 */
export async function capturePasswordUnconfirmedPage(page: Page, path: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path,
    fullPage: true,
    animations: "disabled",
    mask: [page.locator('input[type="password"]')],
  });
  // Next 16 的 Activity 保留隐藏诊断节点；只证明没有可见遮挡，不关闭诊断或忽略未知异常。
  const dialog = page.locator("nextjs-dialog,[data-nextjs-dialog]");
  await expect(dialog).toBeHidden();
  return { mountedDialogs: await dialog.count(), visibleDialogs: 0 };
}

/** 多个窗口共用观测器；只有与本次具体故障匹配的认证错误可以列为预期。 */
export function observePasswordPages(phase: () => string) {
  const errors: string[] = [],
    messages: Message[] = [],
    failures: FailedRequest[] = [];
  const watch = (page: Page, origin: "main" | "credential") => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (!["error", "warning"].includes(message.type())) return;
      messages.push({
        origin,
        phase: phase(),
        text: message
          .text()
          .replace(
            /(token_hash|access_token|refresh_token|code)=[^\s&"']+/g,
            "$1=<redacted>",
          ),
        path: new URL(message.location().url || "about:blank").pathname,
      });
    });
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/auth/v1/"))
        failures.push({
          origin,
          method: request.method(),
          path: url.pathname,
          reason: request.failure()?.errorText ?? "failed",
        });
    });
  };
  const requireExpected = (mode: string) => {
    const isOwnedAbort = (failure: FailedRequest) =>
      failure.origin === "main" &&
      failure.method === "PUT" &&
      failure.path === "/auth/v1/user" &&
      /ERR_ABORTED|ERR_FAILED/.test(failure.reason) &&
      ["response_lost", "page_closed"].includes(mode);
    expect(failures.filter((failure) => !isOwnedAbort(failure))).toEqual([]);
    const unexpected = messages.filter((message) => {
      const resource = /status of (400|422)/.test(message.text);
      if (
        message.origin === "credential" &&
        message.phase === "old_password" &&
        message.path === "/auth/v1/token" &&
        resource
      )
        return false;
      if (message.origin === "credential" && message.phase === "old_password") {
        // 登录协调器会主动记录失败类别；只接受与本次旧密码400响应配对的那条结构化事件。
        let event: Record<string, unknown> | undefined;
        try {
          event = JSON.parse(message.text);
        } catch {
          /* 普通错误仍交给后续严格判断。 */
        }
        const rejected = messages.some(
          (row) =>
            row.origin === "credential" &&
            row.phase === "old_password" &&
            row.path === "/auth/v1/token" &&
            /status of 400/.test(row.text),
        );
        if (
          rejected &&
          event?.event === "pt5.auth" &&
          event.phase === "password" &&
          event.category === "invalidCredentials" &&
          event.outcome === "failed"
        )
          return false;
      }
      if (
        message.origin === "main" &&
        message.phase === "same_password" &&
        message.path === "/auth/v1/user" &&
        resource
      )
        return false;
      if (
        message.origin === "main" &&
        mode === "logout_failed" &&
        ((message.path === "/auth/v1/logout" &&
          /status of 503/.test(message.text)) ||
          message.text.includes("Local sign out unavailable"))
      )
        return false;
      // 必须另有同一窗口的PUT取消凭证，不能仅凭一条timeout消息忽略其他认证故障。
      if (
        message.origin === "main" &&
        failures.some(isOwnedAbort) &&
        (/^AuthFlowError: timeout/.test(message.text) ||
          /^TypeError: Failed to fetch/.test(message.text) ||
          (message.path === "/auth/v1/user" &&
            /net::ERR_ABORTED/.test(message.text)))
      )
        return false;
      return true;
    });
    expect(errors).toEqual([]);
    expect(unexpected).toEqual([]);
  };
  return { watch, requireExpected, errors, messages, failures };
}
