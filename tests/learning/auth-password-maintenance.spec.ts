import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import {
  capturePasswordUnconfirmedPage,
  observePasswordPages,
} from "./auth-password-diagnostics";
import {
  requireLocalAuthMailbox,
  ownRecoveryMessages,
  readRecoveryMail,
  cleanupRecoveryMail,
  readAuthPasswordRecord,
  publicAuthReceipt,
  captureAuthDatabaseState,
  requireOwnedAuthCleanup,
} from "./auth-mail-fixture.mjs";
import zh from "../../messages/zh.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

test.use({
  learningRole: "salesman",
  trace: "off",
  screenshot: "off",
  video: "off",
});
let baseline: Awaited<ReturnType<typeof captureAuthDatabaseState>>;
let mailboxBefore: Awaited<ReturnType<typeof requireLocalAuthMailbox>>;
const actorIds: string[] = [];

test.beforeAll(async () => {
  mailboxBefore = await requireLocalAuthMailbox();
  baseline = await captureAuthDatabaseState();
  expect(baseline.tasks).toMatchObject({ scheduler: "off", jobs: 0, queue: 0 });
});

test.afterAll(async ({}, testInfo) => {
  const after = await captureAuthDatabaseState();
  expect(after).toEqual(baseline);
  const mailbox = await requireLocalAuthMailbox();
  expect(mailbox.messages).toBe(mailboxBefore.messages);
  const cleanup = await requireOwnedAuthCleanup(actorIds);
  await writeFile(
    testInfo.outputPath("auth-global-cleanup.json"),
    JSON.stringify(
      { baseline, after, cleanup, mailboxMessages: mailbox.messages },
      null,
      2,
    ),
  );
});

async function fillSecret(page: Page, name: string, secret: string) {
  try {
    await page.locator(`input[name="${name}"]`).fill(secret);
  } catch {
    throw new Error("密码输入框不可操作，未记录输入值。");
  }
}

async function openRecovery(page: Page, link: string) {
  try {
    await page.goto(link);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeEnabled();
  } catch {
    throw new Error(
      "真实本地恢复邮件未打开可操作的改密表单，链接令牌不写入日志。",
    );
  }
}

const modes = [
  "success",
  "response_lost",
  "page_closed",
  "logout_failed",
] as const;
for (const mode of modes)
  for (const locale of ["zh", "en"] as const)
    for (const width of [1440, 390]) {
      test(`专属账号改密：${mode}/${locale}/${width}`, async ({
        page,
        context,
        browser,
        learningUser: actor,
      }, testInfo) => {
        test.setTimeout(180000);
        actorIds.push(actor.id);
        const messages = locale === "zh" ? zh : en,
          copy = messages.ForgotPasswordForm;
        const nextPassword = `Changed!Aa7-${randomUUID()}`;
        const privateContexts: Awaited<
          ReturnType<typeof browser.newContext>
        >[] = [];
        const requests: { phase: string; method: string; path: string }[] = [];
        let phase = "preparing",
          release: (() => void) | undefined;
        const proof: Record<string, unknown> = {
          mode,
          locale,
          width,
          actorId: actor.id,
          scenarioPassed: false,
        };
        const diagnostics = observePasswordPages(() => phase);
        diagnostics.watch(page, "main");
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (url.pathname.startsWith("/auth/v1/"))
            requests.push({
              phase,
              method: request.method(),
              path: url.pathname,
            });
        });
        try {
          await context.addCookies([
            { name: "bs-locale", value: locale, url: "http://localhost:3000" },
          ]);
          await page.setViewportSize({ width, height: 1000 });
          await loginLearningUser(page, actor);
          await page.goto("http://localhost:3000/salesman/my");
          await expect(page.locator("#account-center")).toBeVisible();
          await page.waitForLoadState("networkidle");
          const initial = await readAuthPasswordRecord(actor);
          proof.before = publicAuthReceipt(initial);
          phase = "request_mail";
          await page
            .locator("#account-center")
            .getByRole("button", {
              name: messages.DashboardMy.changePassword,
              exact: true,
            })
            .dblclick();
          await expect
            .poll(async () => (await ownRecoveryMessages(actor)).length, {
              timeout: 30000,
            })
            .toBe(1);
          const mail = await readRecoveryMail(actor);
          proof.mail = mail.receipt;
          expect(
            requests.filter(
              (row) =>
                row.phase === "request_mail" && row.path === "/auth/v1/recover",
            ).length,
          ).toBe(1);
          phase = "recover";
          await openRecovery(page, mail.link);
          const before = await readAuthPasswordRecord(actor);
          expect(before.fingerprint === initial.fingerprint).toBe(true);
          if (mode === "success") {
            // 输入校验不应发出写入；相同密码由真实Auth拒绝，再允许有效的新密码。
            phase = "weak_input";
            await fillSecret(page, "password", "short");
            await fillSecret(page, "confirmPassword", "short");
            await page.locator('form button[type="submit"]').click();
            await expect(
              page.getByText(copy.passwordPolicy, { exact: true }),
            ).toBeVisible();
            phase = "mismatch_input";
            await fillSecret(page, "password", nextPassword);
            await fillSecret(page, "confirmPassword", nextPassword + "7");
            await page.locator('form button[type="submit"]').click();
            await expect(
              page.getByText(copy.passwordMismatch, { exact: true }),
            ).toBeVisible();
            expect(
              requests.filter(
                (row) =>
                  ["weak_input", "mismatch_input"].includes(row.phase) &&
                  row.method === "PUT",
              ),
            ).toHaveLength(0);
            phase = "same_password";
            await fillSecret(page, "password", actor.password);
            await fillSecret(page, "confirmPassword", actor.password);
            await page.locator('form button[type="submit"]').click();
            await expect(
              page.getByText(copy.samePassword, { exact: true }),
            ).toBeVisible();
            expect(
              (await readAuthPasswordRecord(actor)).fingerprint ===
                before.fingerprint,
            ).toBe(true);
          }
          await fillSecret(page, "password", nextPassword);
          await fillSecret(page, "confirmPassword", nextPassword);
          const updated = Promise.withResolvers<void>(),
            delivered = Promise.withResolvers<void>();
          release = () => delivered.resolve();
          let actualUpdateStatus = 0,
            actualUpdateUser: string | undefined;
          if (mode !== "logout_failed")
            await page.route(
              (url) => url.pathname === "/auth/v1/user",
              async (route) => {
                if (route.request().method() !== "PUT") {
                  await route.continue();
                  return;
                }
                const response = await route.fetch();
                actualUpdateStatus = response.status();
                const user = await response.json();
                actualUpdateUser = user.id;
                updated.resolve();
                await delivered.promise;
                try {
                  await route.fulfill({ response });
                } catch {
                  /* 关闭页面后，旧响应不能再恢复该页面。 */
                }
              },
            );
          if (mode === "logout_failed")
            await page.route(
              (url) => url.pathname === "/auth/v1/logout",
              (route) =>
                route.fulfill({
                  status: 503,
                  contentType: "application/json",
                  body: JSON.stringify({
                    code: "unexpected_failure",
                    msg: "Local sign out unavailable",
                  }),
                }),
            );
          phase = "change_password";
          await page.locator('form button[type="submit"]').dblclick();
          if (mode !== "logout_failed") {
            await expect
              .poll(() => actualUpdateStatus, { timeout: 15000 })
              .toBe(200);
            await updated.promise;
            expect(actualUpdateUser).toBe(actor.id);
            await expect(
              page.locator('form button[type="submit"]'),
            ).toBeDisabled();
          }
          const changed = await readAuthPasswordRecord(actor);
          expect(changed.fingerprint !== before.fingerprint).toBe(true);
          expect(changed.version !== before.version).toBe(true);
          proof.after = publicAuthReceipt(changed);
          proof.passwordChanged = true;
          if (mode === "success") {
            release();
            await expect(page).toHaveURL(/\/login\?passwordReset=1$/);
            await expect(
              page.getByText(messages.LoginForm.passwordResetNotice, {
                exact: true,
              }),
            ).toBeVisible();
            proof.originalFlowOutcome = "succeeded";
          } else if (mode === "page_closed") {
            await context.close();
            release();
            proof.originalFlowOutcome = "partial_failed";
          } else {
            // 修改可能已经提交，页面必须明确提示未确认，不能把退出失败当成密码未修改。
            await expect(
              page.getByText(
                locale === "zh"
                  ? /修改.*(?:结果)?.*未确认/
                  : /(?:could not|couldn't) confirm.*password/i,
              ),
            ).toBeVisible({ timeout: 15000 });
            if (mode === "response_lost")
              proof.uncertaintyPage = await capturePasswordUnconfirmedPage(
                page,
                testInfo.outputPath("password-unconfirmed.png"),
              );
            expect(page.url().includes("passwordReset=1")).toBe(false);
            proof.originalFlowOutcome = "partial_failed";
            release();
          }
          expect(
            requests.filter(
              (row) =>
                row.phase === "change_password" &&
                row.method === "PUT" &&
                row.path === "/auth/v1/user",
            ),
          ).toHaveLength(1);
          // 使用无Cookie的新上下文，才能证明新密码有效；已有会话刷新不能代替凭据验证。
          const privateContext = await browser.newContext({
            viewport: { width, height: 1000 },
          });
          privateContexts.push(privateContext);
          await privateContext.addCookies([
            { name: "bs-locale", value: locale, url: "http://localhost:3000" },
          ]);
          const check = await privateContext.newPage();
          diagnostics.watch(check, "credential");
          phase = "old_password";
          await check.goto("http://localhost:3000/login");
          await check.locator('input[name="email"]').fill(actor.email);
          await fillSecret(check, "password", actor.password);
          await check.locator('form button[type="submit"]').click();
          await expect(
            check.getByText(messages.LoginForm.invalidCredentials, {
              exact: true,
            }),
          ).toBeVisible();
          phase = "new_password";
          await fillSecret(check, "password", nextPassword);
          await check.locator('form button[type="submit"]').click();
          await check.waitForURL("**/salesman/home");
          await check.goto("http://localhost:3000/salesman/my");
          await expect(check.locator("#personal-center")).toBeVisible();
          await expect(check.locator("#personal-center")).toContainText(
            `学习验收 ${actor.runId}`,
          );
          await check.reload();
          await check.waitForLoadState("networkidle");
          await expect(check.locator("#personal-center")).toBeVisible();
          // 普通登录和已使用链接都不能再次进入恢复表单，也不得改写当前密码。
          await check.goto(
            "http://localhost:3000/forgot-password?type=recovery",
          );
          await expect(check).toHaveURL(/\/salesman\/home$/);
          await expect(
            check.locator('input[name="confirmPassword"]'),
          ).toHaveCount(0);
          if (mode === "success") {
            phase = "replay_used_link";
            try {
              await page.goto(mail.link);
            } catch {
              throw new Error("已使用恢复链接的核对失败，令牌已隐藏。");
            }
            await expect(
              page.locator('input[name="confirmPassword"]'),
            ).toHaveCount(0);
            await expect(
              page.getByText(copy.authSessionMissing, { exact: true }),
            ).toBeVisible();
          }
          expect(
            (await readAuthPasswordRecord(actor)).fingerprint ===
              changed.fingerprint,
          ).toBe(true);
          await check.goto("http://localhost:3000/salesman/my");
          await check.waitForLoadState("networkidle");
          await expect(check.locator("#personal-center")).toBeVisible();
          expect(
            await check.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          ).toBe(true);
          await expect(
            check.locator("nextjs-dialog,[data-nextjs-dialog]"),
          ).toHaveCount(0);
          await check.screenshot({
            path: testInfo.outputPath("password-final.png"),
            fullPage: true,
            animations: "disabled",
          });
          diagnostics.requireExpected(mode);
          proof.oldPasswordRejected = true;
          proof.newPasswordLoginVerified = true;
          proof.reloadConsistent = true;
          proof.scenarioPassed = true;
        } finally {
          release?.();
          await context.close();
          for (const privateContext of privateContexts)
            await privateContext.close();
          proof.mailCleanup = await cleanupRecoveryMail(actor);
          proof.console = diagnostics.messages;
          proof.failedAuthRequests = diagnostics.failures;
          proof.pageErrors = diagnostics.errors;
          proof.requests = requests;
          await writeFile(
            testInfo.outputPath("password-receipt.json"),
            JSON.stringify(proof, null, 2),
          );
        }
      });
    }
