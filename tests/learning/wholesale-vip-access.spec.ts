import { writeFile } from "node:fs/promises";
import { test, expect } from "./fixtures";
import {
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";
import { createVipAccessFixture } from "./wholesale-vip-access-fixture";
import zh from "../../messages/zh.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

test.use({ trace: "off", video: "off", screenshot: "off" });
const roles = [
  { role: "administrator", page: true, read: "all" },
  { role: "finance", page: true, read: "all" },
  { role: "salesman", page: true, read: "all" },
  { role: "manager", page: false, read: "all" },
  { role: "operator", page: false, read: "all" },
  { role: "recruiter", page: false, read: "all" },
  { role: "client", page: false, read: "own" },
  { role: "promoter", page: false, read: "none" },
] as const;

for (const rule of roles)
  test.describe(`批发VIP岗位 ${rule.role}`, () => {
    test.use({ learningRole: rule.role });
    test("页面与实际数据库范围，双语桌面手机", async ({
      page,
      learningUser,
      learningStaff,
    }, testInfo) => {
      test.setTimeout(240000);
      const fixture = createVipAccessFixture(learningUser, learningStaff, rule.role === "client");
      const errors: string[] = [],
        consoleMessages: string[] = [],
        combinations: Record<string, unknown>[] = [];
      const writes: { action: string; targetId: string }[] = [];
      const deniedWrites: { targetId: string; status: number; error: string }[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (["warning", "error"].includes(message.type())) consoleMessages.push(message.text());
      });
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname === "/api/business-vip" &&
          request.method() === "POST"
        ) {
          const value = request.postDataJSON();
          writes.push({ action: value.action, targetId: value.targetId });
        }
      });
      try {
        // 配置型岗位只给本次账号开通批发，以分离“业务未开通”和“岗位栏目不可用”；推广仍沿用固定规则。
        if (rule.role !== "promoter")
          executeLearningSql(`insert into public.user_workspace_business_access(user_id,business_key,is_enabled)
        values('${learningUser.id}','wholesale',true)on conflict(user_id,business_key)do update set is_enabled=true;`);
        const facts = fixture.facts();
        expect(facts).toEqual({
          role: rule.role,
          business: rule.role !== "promoter",
          staff: rule.page,
          canManage: rule.page,
        });
        await page
          .context()
          .addCookies([{ name: "bs-locale", value: "zh", url: "http://localhost:3000" }]);
        const login = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/auth/v1/token" &&
            response.request().method() === "POST",
        );
        await loginLearningUser(
          page,
          learningUser,
          rule.role === "promoter" ? /\/business-unavailable$/ : undefined,
        );
        const signedIn = await login,
          body = await signedIn.json();
        expect(body.user.id).toBe(learningUser.id);
        // 登录凭证仅在内存用于原生Data API；不写到截图、附件或日志。
        const api = new URL(signedIn.url()).origin,
          key = signedIn.request().headers().apikey,
          token = body.access_token as string;
        const response = await page.request.post(
          `${api}/rest/v1/rpc/list_wholesale_vip_management`,
          { headers: { apikey: key, authorization: `Bearer ${token}` }, data: {} },
        );
        expect(response.status()).toBe(200);
        const rows = (await response.json()).filter((row: { customer_id: string }) =>
          fixture.ids.includes(row.customer_id),
        );
        const visible =
          rule.read === "all"
            ? fixture.ids.slice().sort()
            : rule.read === "own"
              ? [fixture.ids[0]]
              : [];
        expect(rows.map((row: { customer_id: string }) => row.customer_id).sort()).toEqual(visible);
        const route = `/${rule.role === "administrator" ? "admin" : rule.role}/wholesale/vip`;
        let opened: ReturnType<typeof fixture.capture>;
        for (const locale of ["zh", "en"] as const)
          for (const width of [1440, 390]) {
            const copy = (locale === "zh" ? zh : en).BusinessVip;
            await page
              .context()
              .addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(route);
            if (!rule.page) {
              const expected =
                rule.role === "promoter" ? /\/business-unavailable$/ : /\/access-limited$/;
              await expect(page).toHaveURL(expected);
              await expect(
                page.getByRole("button", { name: copy.actions.open, exact: true }),
              ).toHaveCount(0);
              await page.reload();
              await expect(page).toHaveURL(expected);
              // 页面没有写入口；原生请求仅用于证明接口拒绝，且必须独立确认没有新业务行。
              if (locale === "zh" && width === 1440)
                for (const targetId of fixture.ids) {
                  const denied = await page.request.post("/api/business-vip", {
                    data: {
                      business: "wholesale",
                      operation: "manageWholesale",
                      action: "open",
                      targetId,
                    },
                  });
                  expect(denied.status()).toBe(403);
                  const outcome = await denied.json();
                  expect(outcome).toEqual({ error: "forbidden" });
                  deniedWrites.push({ targetId, status: denied.status(), error: outcome.error });
                  expect(fixture.capture()).toEqual(fixture.baseline);
                }
            } else {
              await expect(page).toHaveURL(new RegExp(route + "$"));
              const search = page.getByPlaceholder(copy.filters.searchPlaceholder);
              // 空筛选结果是可操作的页面状态，不用服务异常代替空数据。
              await search.fill(`absent-${fixture.ids[0]}`);
              await expect(
                page.getByText(copy.directory.emptyTitle, { exact: true }),
              ).toBeVisible();
              await search.fill(fixture.ids[0]);
              const records = page.getByRole("button", {
                name: copy.actions.viewCustomerRecords.replace("{name}", fixture.names[0]),
                exact: true,
              });
              await expect(records).toBeVisible();
              const shouldWrite =
                (locale === "zh" && width === 1440) || (locale === "en" && width === 390);
              if (shouldWrite) {
                const action = locale === "zh" ? "open" : "renew";
                await page
                  .getByRole("button", {
                    name: action === "open" ? copy.actions.open : copy.actions.directRenew,
                    exact: true,
                  })
                  .click();
                const dialog = page.getByRole("dialog", {
                  name:
                    action === "open"
                      ? copy.dialogs.wholesale.openTitle
                      : copy.dialogs.wholesale.renewTitle,
                  exact: true,
                });
                if (
                  process.env.PT5_VIP_RECEIPT_RED_PROBE === "1" &&
                  rule.role === "administrator" &&
                  action === "open"
                ) {
                  // 红灯探针只伪造本地HTTP成功；独立SQL必须发现没有实际会员或收费记录。
                  await page.route(
                    "**/api/business-vip",
                    (route) => route.fulfill({ json: { ok: true } }),
                    { times: 1 },
                  );
                }
                const confirm = dialog.getByRole("button", {
                  name:
                    action === "open"
                      ? copy.dialogs.wholesale.openSubmit
                      : copy.dialogs.wholesale.renewSubmit,
                  exact: true,
                });
                await confirm.evaluate((button: HTMLButtonElement) => {
                  button.click();
                  button.click();
                });
                await expect(dialog).toHaveCount(0, { timeout: 30000 });
                const state = fixture.capture(),
                  expectedCount = action === "open" ? 1 : 2;
                expect(
                  state.recharges,
                  "页面成功后必须有真实收费记录，不能仅凭HTTP回包",
                ).toHaveLength(expectedCount);
                expect(state.memberships).toHaveLength(1);
                expect(state.commissions).toEqual([]);
                expect(state.adjustments).toEqual([]);
                const latest = state.recharges.find(
                  (row: { operation_type: string }) => row.operation_type === action,
                );
                expect(latest).toMatchObject({
                  amount: 200,
                  currency: "USD",
                  operation_type: action,
                  confirmed_by_user_id: learningUser.id,
                });
                expect(latest.id).toBeTruthy();
                expect(latest.rowVersion).toBeTruthy();
                fixture.requireYear(latest.id);
                expect(state.memberships[0]).toMatchObject({
                  customer_id: fixture.ids[0],
                  status: "active",
                  expires_at: latest.next_expires_at,
                  created_by_user_id: learningUser.id,
                });
                if (action === "open") {
                  expect(latest.previous_expires_at).toBeNull();
                  opened = state;
                } else {
                  expect(latest.previous_expires_at).toBe(opened.memberships[0].expires_at);
                  expect(state.memberships[0].id).toBe(opened.memberships[0].id);
                  expect(state.memberships[0].started_at).toBe(opened.memberships[0].started_at);
                }
                expect(writes).toHaveLength(expectedCount);
                expect(writes.at(-1)).toEqual({ action, targetId: fixture.ids[0] });
                await page.reload();
                await search.fill(fixture.ids[0]);
                await expect(records).toBeVisible();
                expect(fixture.capture()).toEqual(state);
              }
              await records.click();
              const history = page.getByRole("dialog", {
                name: copy.dialogs.wholesale.recordsTitle,
                exact: true,
              });
              await expect(history.locator("article")).toHaveCount(
                locale === "en" && width === 390 ? 2 : 1,
              );
              await expect(history).toContainText("200");
              await page.screenshot({
                path: testInfo.outputPath(`vip-${locale}-${width}.png`),
                fullPage: true,
                animations: "disabled",
              });
              await page.keyboard.press("Escape");
              await expect(history).toHaveCount(0);
            }
            await expect(page.locator("nextjs-dialog,[data-nextjs-dialog]")).toHaveCount(0);
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            ).toBe(true);
            if (!rule.page)
              await page.screenshot({
                path: testInfo.outputPath(`vip-${locale}-${width}.png`),
                fullPage: true,
                animations: "disabled",
              });
            combinations.push({ locale, width, pageAllowed: rule.page, reloaded: true });
          }
        expect(fixture.capture().customers).toEqual(fixture.baseline.customers);
        expect(errors).toEqual([]);
        expect(consoleMessages).toEqual([]);
        await writeFile(
          testInfo.outputPath("vip-access-receipt.json"),
          JSON.stringify(
            {
              role: rule.role,
              actorId: learningUser.id,
              facts,
              rpcVisible: visible,
              combinations,
              writes,
              deniedWrites,
              final: fixture.capture(),
              baseline: fixture.baseline,
            },
            null,
            2,
          ),
        );
      } finally {
        await writeFile(
          testInfo.outputPath("before-cleanup.json"),
          JSON.stringify(
            { state: fixture.capture(), errors, console: consoleMessages, writes },
            null,
            2,
          ),
        );
        await page.context().close();
        const cleanup = fixture.cleanup();
        await writeFile(testInfo.outputPath("vip-cleanup.json"), JSON.stringify(cleanup, null, 2));
      }
    });
  });
