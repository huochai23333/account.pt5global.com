import { test, expect } from "./fixtures";
import type { AppRole } from "../../lib/auth-routing";
import { readFile, writeFile } from "node:fs/promises";
import {
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";
import {
  createAttachmentAccessFixture,
  requestAttachmentFromPage,
  requireAttachmentTextFits,
  digest,
} from "./wholesale-attachment-access-fixture";
import zh from "../../messages/zh.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

test.use({ trace: "off", video: "off", screenshot: "off" });
const roles: {
  role: AppRole;
  scope: "all" | "own" | "none";
  manage: boolean;
}[] = [
  { role: "administrator", scope: "all", manage: true },
  { role: "finance", scope: "all", manage: true },
  { role: "salesman", scope: "all", manage: true },
  { role: "manager", scope: "all", manage: false },
  { role: "operator", scope: "all", manage: false },
  { role: "client", scope: "own", manage: false },
  { role: "recruiter", scope: "none", manage: false },
  { role: "promoter", scope: "none", manage: false },
];

for (const { role, scope, manage } of roles) {
  test.describe(`订单附件岗位 ${role}`, () => {
    test.use({ learningRole: role });
    test("真实页面与Storage读取范围，双语桌面手机", async ({
      page,
      browser,
      learningUser,
      learningStaff,
    }, testInfo) => {
      test.setTimeout(180000);
      const fixture = createAttachmentAccessFixture(
        learningUser,
        learningStaff,
        role === "client",
      );
      const receipts: Record<string, unknown>[] = [];
      const errors: string[] = [],
        messages: { text: string; path: string }[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type()))
          messages.push({
            text: message.text(),
            path: new URL(message.location().url || "about:blank").pathname,
          });
      });
      let cleanup;
      try {
        // 只给本次测试账号声明批发业务，用于分离岗位栏目权限；推广沿用当前未开通状态。
        if (role !== "promoter")
          executeLearningSql(`insert into public.user_workspace_business_access(user_id,business_key,is_enabled)
          values('${learningUser.id}','wholesale',true)on conflict(user_id,business_key)do update set is_enabled=true;`);
        const initial = await fixture.upload(browser);
        const registrations = fixture.orders.map((id) =>
          initial.attachments.find(
            (row: { order_id: string }) => row.order_id === id,
          ),
        );
        const ids = fixture.orders.map((id) => `'${id}'`).join(",");
        // 独立authenticated会话，不使用具有服务权限的夹具客户端冒充真实岗位。
        const permissions =
          fixture.asActor(`with visible as(select item from jsonb_array_elements(public.get_wholesale_order_page('{}'::jsonb,1)->'orders')item where item->>'id'in(${ids}))
          select jsonb_build_object('role',public.current_app_role(),'canManage',public.current_user_can_manage_wholesale_order_list('${fixture.orders[0]}'),
          'attachments',(select coalesce(jsonb_agg(order_id order by order_id),'[]')from public.wholesale_order_list_attachments where order_id in(${ids})),
          'raw',(select count(*)from public.wholesale_orders where id in(${ids})),
          'visible',(select coalesce(jsonb_agg(item->>'id'order by item->>'id'),'[]')from visible),
          'hasCosts',(select coalesce(bool_or(item?'product_purchase_amount'or item?'commission_calculation_snapshot'),false)from visible));`);
        expect(permissions.role).toBe(role);
        expect(permissions.canManage).toBe(manage);
        const visibleIds =
          scope === "all"
            ? fixture.orders.slice().sort()
            : scope === "own"
              ? [fixture.orders[0]]
              : [];
        expect(permissions.attachments).toEqual(visibleIds);
        expect(permissions.visible).toEqual(visibleIds);
        if (scope !== "all") expect(permissions.raw).toBe(0);
        if (role === "client") expect(permissions.hasCosts).toBe(false);

        await page
          .context()
          .addCookies([
            { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
          ]);
        const loginResponse = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/auth/v1/token" &&
            response.request().method() === "POST",
        );
        await loginLearningUser(
          page,
          learningUser,
          role === "promoter" ? /\/business-unavailable$/ : undefined,
        );
        const response = await loginResponse,
          body = await response.json();
        expect(body.user.id).toBe(learningUser.id);
        expect(typeof body.access_token).toBe("string");
        const connection = {
          origin: new URL(response.url()).origin,
          key: response.request().headers().apikey,
          token: body.access_token as string,
        };
        expect(connection.origin).toMatch(
          /^http:\/\/(127\.0\.0\.1|localhost):48021$/,
        );
        const route = `/${role === "administrator" ? "admin" : role}/wholesale/orders`;
        for (const locale of ["zh", "en"] as const)
          for (const width of [1440, 390]) {
            const copy = locale === "zh" ? zh : en,
              ordersUi = copy.WholesaleBusiness.ordersUi;
            await page.context().addCookies([
              {
                name: "bs-locale",
                value: locale,
                url: "http://localhost:3000",
              },
            ]);
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(route);
            const expectedUrl =
              scope === "none"
                ? role === "promoter"
                  ? /\/business-unavailable$/
                  : /\/access-limited$/
                : new RegExp(route + "$");
            // 栏目拒绝可能触发跳转；先等目标文档加载，避免在被销毁的页面中发请求。
            await expect(page).toHaveURL(expectedUrl);
            await page.waitForLoadState("load");
            const openAttachment = async () => {
              const search = page.getByPlaceholder(
                copy.UiText
                  .components_dashboard_wholesale_wholesale_order_filters
                  .attribute002,
              );
              await search.fill(`Learning-${fixture.orders[0]}`);
              await search.press("Enter");
              const row = page.getByTestId(
                `wholesale-order-row-${fixture.orders[0]}`,
              );
              const detail = page.getByRole("dialog", {
                name: ordersUi.detailFields.title.replace(
                  "{number}",
                  `Learning-${fixture.orders[0]}`,
                ),
              });
              // 客户桌面直接展示附件；内部精简表格和手机都要进入详情。
              if (width === 390)
                await page
                  .getByTestId(`wholesale-order-card-${fixture.orders[0]}`)
                  .click();
              else if (scope === "all")
                await row
                  .getByRole("button", {
                    name: ordersUi.compactColumns.details,
                    exact: true,
                  })
                  .click();
              const area = width === 1440 && scope === "own" ? row : detail;
              await expect(
                area.getByRole("button", {
                  name: fixture.filenames[0],
                  exact: true,
                }),
              ).toBeVisible();
              return area;
            };
            const before = fixture.capture();
            const signed = [];
            for (let index = 0; index < registrations.length; index++) {
              const result = await requestAttachmentFromPage(
                page,
                connection,
                registrations[index].storage_path,
              );
              const allowed =
                scope === "all" || (scope === "own" && index === 0);
              expect(result.issued).toBe(allowed);
              if (allowed) {
                expect(result.status).toBe(200);
                expect(result.downloadStatus).toBe(200);
                expect(result.sha256).toBe(digest(fixture.contents[index]));
              } else {
                expect([400, 404]).toContain(result.status);
                expect(result.downloadStatus).toBeNull();
              }
              signed.push({ orderId: fixture.orders[index], ...result });
            }
            expect(fixture.capture()).toEqual(before);
            if (scope === "none") {
              await expect(page).toHaveURL(
                role === "promoter"
                  ? /\/business-unavailable$/
                  : /\/access-limited$/,
              );
              await expect(
                page.getByRole("button", {
                  name: fixture.filenames[0],
                  exact: true,
                }),
              ).toHaveCount(0);
            } else {
              await expect(page).toHaveURL(new RegExp(route + "$"));
              if (role === "client")
                await expect(
                  page.getByText(`Learning-${fixture.orders[1]}`, {
                    exact: true,
                  }),
                ).toHaveCount(0);
              const area = await openAttachment();
              const manageButton = area.getByRole("button", {
                name: ordersUi.orderList.manage,
                exact: true,
              });
              if (manage) await expect(manageButton).toBeVisible();
              else await expect(manageButton).toHaveCount(0);
              const fileButton = area.getByRole("button", {
                name: fixture.filenames[0],
                exact: true,
              });
              await expect(fileButton).toBeVisible();
              await requireAttachmentTextFits(fileButton);
              if (role === "client") {
                // 从真实下载按钮发起，仅篡改对象路径；真实客户JWT和Storage策略处理他人文件请求。
                let denied: { status: number; issued: boolean } | undefined;
                const ownsSign = (url: URL) =>
                  url.pathname.endsWith(
                    "/object/sign/wholesale-order-lists/" +
                      registrations[0].storage_path,
                  );
                await page.route(
                  ownsSign,
                  async (route) => {
                    const target = new URL(route.request().url());
                    target.pathname =
                      "/storage/v1/object/sign/wholesale-order-lists/" +
                      registrations[1].storage_path;
                    const actual = await route.fetch({
                      url: target.href,
                      maxRetries: 0,
                    });
                    const value = await actual.json();
                    denied = {
                      status: actual.status(),
                      issued: typeof value.signedURL === "string",
                    };
                    await route.fulfill({ response: actual });
                  },
                  { times: 1 },
                );
                let downloads = 0;
                const counted = () => downloads++;
                page.on("download", counted);
                await fileButton.click();
                await expect(
                  area.getByText(ordersUi.orderList.downloadFailed, {
                    exact: true,
                  }),
                ).toBeVisible();
                expect(denied?.issued).toBe(false);
                expect([400, 404]).toContain(denied?.status);
                expect(downloads).toBe(0);
                page.off("download", counted);
                expect(fixture.capture()).toEqual(before);
              }
              const downloadStarted = page.waitForEvent("download");
              await fileButton.click();
              const download = await downloadStarted;
              expect(download.suggestedFilename()).toBe(fixture.filenames[0]);
              expect(digest(await readFile((await download.path())!))).toBe(
                digest(fixture.contents[0]),
              );
              if (role === "client") {
                await expect(
                  page.getByText(ordersUi.detailFields.purchase, {
                    exact: true,
                  }),
                ).toHaveCount(0);
                await expect(page.getByText(/123\.00/)).toHaveCount(0);
              }
            }
            await expect(
              page.locator("nextjs-dialog,[data-nextjs-dialog]"),
            ).toBeHidden();
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            ).toBe(true);
            await page.screenshot({
              path: testInfo.outputPath(
                `attachment-access-${locale}-${width}.png`,
              ),
              fullPage: true,
              animations: "disabled",
            });
            await page.reload();
            await expect(page).toHaveURL(expectedUrl);
            if (scope !== "none") {
              // 刷新后重新从页面打开同一附件，不能只凭地址和数据库未变宣称页面一致。
              const restored = await openAttachment();
              const management = restored.getByRole("button", {
                name: ordersUi.orderList.manage,
                exact: true,
              });
              if (manage) await expect(management).toBeVisible();
              else await expect(management).toHaveCount(0);
              if (scope === "own")
                await expect(
                  page.getByText(`Learning-${fixture.orders[1]}`, {
                    exact: true,
                  }),
                ).toHaveCount(0);
            } else
              await expect(
                page.getByRole("button", {
                  name: fixture.filenames[0],
                  exact: true,
                }),
              ).toHaveCount(0);
            expect(fixture.capture()).toEqual(before);
            receipts.push({ locale, width, signed, reloadConsistent: true });
          }
        if (!manage) {
          const deleted = fixture.asActor(
            `with removed as(delete from public.wholesale_order_list_attachments where order_id in(${ids})returning id)select jsonb_build_object('deleted',count(*))from removed;`,
          );
          expect(deleted.deleted).toBe(0);
          expect(fixture.capture()).toEqual(initial);
        }
        expect(errors).toEqual([]);
        // 只接受被明确拒绝的签名路径400/404；其他资源错误、框架问题和警告均失败。
        expect(
          messages.filter(
            (message) =>
              !(
                message.path.includes(
                  "/storage/v1/object/sign/wholesale-order-lists/",
                ) && /status of (400|404)/.test(message.text)
              ),
          ),
        ).toEqual([]);
        await writeFile(
          testInfo.outputPath("attachment-access-receipt.json"),
          JSON.stringify(
            {
              role,
              actorId: learningUser.id,
              staffId: learningStaff.id,
              scope,
              manage,
              permissions,
              registrations: initial.attachments,
              pages: receipts,
              errors,
              console: messages,
              passed: true,
            },
            null,
            2,
          ),
        );
      } finally {
        await page.context().close();
        cleanup = await fixture.cleanup();
        await writeFile(
          testInfo.outputPath("attachment-data-cleanup.json"),
          JSON.stringify(cleanup, null, 2),
        );
      }
    });
  });
}
