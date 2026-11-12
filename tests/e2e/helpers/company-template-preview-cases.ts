import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginAs } from "./auth";
import {
  fillQuotationRow,
  fillPublishDialog,
  requireLocalAdminClient,
  readTemplateBySlug,
  readVersion,
  sha256,
  clickStableTemplateButton,
  expectNoPageOverflow,
  withDocumentProtocol,
} from "./company-template-actions";
import { deleteTemplateFixture } from "./company-template-records";
import { finalizeCompanyTemplateCase } from "./company-template-case-lifecycle";

/** 按原入口注册正文与报价交互场景；原账号/认证保持，实际页面执行仍需原准入。 */
export function registerCompanyTemplatePreviewCases(
  SEEDED_TEMPLATE_ID: string,
  SEEDED_VERSION_ID: string,
) {
  test("模板正文等待失败后可从页面重试", async ({ page }) => {
    await loginAs(page, "administrator");
    const contentPath = `**/api/company-templates/${SEEDED_TEMPLATE_ID}/content*`;
    await page.route(contentPath, (route) => route.abort("timedout"));
    await page.goto(`/admin/company-templates/${SEEDED_TEMPLATE_ID}`);
    await expect(
      page.getByRole("status").getByText("模板暂时没有打开，请重试。"),
    ).toBeVisible({ timeout: 20_000 });
    const retry = page.getByRole("button", { name: "重新打开" });
    await expect(retry).toBeVisible({ timeout: 20_000 });
    await page.unroute(contentPath);
    await retry.click();
    await expect(
      page
        .frameLocator("iframe")
        .getByText("PT5 Dropshipping", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").getByText("正在打开模板，请稍候…"),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page
        .frameLocator("iframe")
        .getByText("PT5 Dropshipping", { exact: true }),
    ).toBeVisible();
    // 手机切换回电脑会重新挂载 iframe，仍要等实际正文出现后才结束等待。
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(
      page
        .frameLocator("iframe")
        .getByText("PT5 Dropshipping", { exact: true }),
    ).toBeVisible();
  });

  for (const getFails of [true, false]) {
    test(`正文 GET ${getFails ? "失败" : "成功"}时不依赖相反结果的 HEAD`, async ({
      page,
    }) => {
      await loginAs(page, "administrator");
      let getCount = 0;
      let headCount = 0;
      const contentPath = `**/api/company-templates/${SEEDED_TEMPLATE_ID}/content*`;
      await page.route(contentPath, async (route) => {
        if (route.request().method() === "HEAD") {
          headCount += 1;
          await route.fulfill({ status: getFails ? 200 : 503 });
        } else {
          getCount += 1;
          if (getFails)
            await route.fulfill({
              status: 503,
              contentType: "text/html",
              body: "<p>Unavailable</p>",
            });
          else await route.continue();
        }
      });
      await page.goto(`/admin/company-templates/${SEEDED_TEMPLATE_ID}`);
      if (getFails) {
        // 来自父窗口的伪造通知不能让错误正文消除遮罩。
        const token = new URL(
          (await page.locator("iframe").getAttribute("src"))!,
        ).searchParams.get("loadToken");
        await page.evaluate(
          (token) =>
            window.postMessage(
              { type: "pt5.company-template.ready", token },
              "*",
            ),
          token,
        );
        await expect(page.getByText("正在打开模板，请稍候…")).toBeVisible();
        await expect(
          page.getByRole("button", { name: "重新打开" }),
        ).toBeVisible({ timeout: 20_000 });
        await page.unroute(contentPath);
        await page.getByRole("button", { name: "重新打开" }).click();
      }
      await expect(
        page
          .frameLocator("iframe")
          .getByText("PT5 Dropshipping", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("status")).toHaveCount(0);
      expect(getCount).toBe(1);
      expect(headCount).toBe(0);
      const head = await page.request.head(
        `/api/company-templates/${SEEDED_TEMPLATE_ID}/content`,
      );
      expect(head.status()).toBe(405);
      await expectNoPageOverflow(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator("iframe")).toHaveCount(0);
      await expectNoPageOverflow(page);
    });
  }

  test("v33 可增加目的地和产品、上传图片、计算金额并触发打印", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // 使用产品已有的“减少动态效果”偏好，让跨 iframe 滚动即时完成。
    // Chrome 的滚动动画期间命中区域可能滞后于 DOM 坐标；真实按钮与业务断言保持原样。
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      // 浏览器自动化不能打开系统打印窗口，因此用页面内标记核对模板确实调用了 window.print。
      Object.defineProperty(window, "print", {
        configurable: true,
        value: () =>
          document.documentElement.setAttribute("data-print-called", "yes"),
      });
    });
    const account = await loginAs(page, "salesman");
    await page.goto(`${account.workspacePath}/company-templates`);
    await page.getByRole("link", { name: "预览模板" }).click();
    const listResponse = await page.request.get(
      `${account.workspacePath}/company-templates`,
    );
    expect(listResponse.headers()["x-frame-options"]).toBe("DENY");
    const contentResponse = await page.request.get(
      `/api/company-templates/${SEEDED_TEMPLATE_ID}/content`,
    );
    expect(contentResponse.headers()["cache-control"]).toContain("no-store");
    expect(contentResponse.headers()["content-security-policy"]).toContain(
      "connect-src 'none'",
    );
    // 正文要能装入本站 iframe；其他页面仍由全站规则拒绝嵌入。
    expect(contentResponse.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(contentResponse.headers()["x-template-sha256"]).toBe(
      (await readVersion(requireLocalAdminClient(), SEEDED_VERSION_ID))
        .html_sha256,
    );
    const sandbox = await page.locator("iframe").getAttribute("sandbox");
    expect(sandbox).toContain("allow-scripts");
    expect(sandbox).toContain("allow-downloads");
    expect(sandbox).not.toContain("allow-same-origin");
    const frame = page.frameLocator("iframe");
    await expect(
      frame.getByText("PT5 Dropshipping", { exact: true }),
    ).toBeVisible();

    await frame.locator("#client").fill("Playwright Store");
    await frame.locator("#quoter").fill("Local Sales");
    await frame.locator("#lhMail").fill("sales@example.test");
    await expect(frame.locator("tr.prow")).toHaveCount(1);
    await clickStableTemplateButton(page, frame, "+ Add product");
    // 等模板同步插入第二行后再新增目的地，避免两个 DOM 操作紧挨时把行数变化合并成不稳定断言。
    await expect(frame.locator("tr.prow")).toHaveCount(2);
    await clickStableTemplateButton(page, frame, "+ Add destination");
    await expect(frame.locator("section.page")).toHaveCount(2);
    await expect(frame.locator("tr.prow")).toHaveCount(3);
    await frame.locator(".f-dest").nth(1).fill("DE");

    for (let index = 0; index < 3; index += 1) {
      await fillQuotationRow(frame, index);
    }

    // 第一行额外走真实文件选择流程，确认 v33 的本地图片读取仍可用。
    await frame.locator(".photo").first().click();
    await frame.locator("body").evaluate(() => {
      (window as unknown as { ensurePhotoFile: () => void }).ensurePhotoFile();
    });
    await frame.locator("#photoFileInput").setInputFiles({
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4l8AAAAASUVORK5CYII=",
        "base64",
      ),
      mimeType: "image/png",
      name: "product.png",
    });
    await expect(frame.locator(".photo img").first()).toBeVisible();
    await expect(frame.locator("#needBadge")).toContainText(
      "all required fields filled",
    );
    for (const total of await frame.locator(".o-tot").all()) {
      await expect(total).not.toHaveText("—");
    }

    await clickStableTemplateButton(page, frame, "Print all");
    await expect(frame.locator("html")).toHaveAttribute(
      "data-print-called",
      "yes",
    );

    // 整页刷新会重新载入模板，防止仅首次客户端跳转正常而直接进入时再次被浏览器拦截。
    await page.reload();
    await expect(
      page
        .frameLocator("iframe")
        .getByText("PT5 Dropshipping", { exact: true }),
    ).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    await expectNoPageOverflow(page);
    await expect(
      page.getByText("公司模板请在电脑上填写和打印。"),
    ).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    const mobileHeader = page.locator("header").first();
    await mobileHeader
      .getByRole("button", { exact: true, name: "公司模板" })
      .click();
    await expect(
      mobileHeader
        .locator('nav[aria-hidden="false"]')
        .getByRole("link", { name: "公司模板" }),
    ).toHaveCount(0);
    await mobileHeader
      .getByRole("button", { exact: true, name: "公司模板" })
      .click();
    await page.getByRole("link", { name: "使用指南" }).click();
    await expect(
      page.getByText("公司模板请在电脑上填写和打印。"),
    ).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    await expectNoPageOverflow(page);

    await page.goto(`${account.workspacePath}/company-templates`);
    await expect(
      page.getByText("公司模板请在电脑上填写和打印。"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "预览模板" })).toHaveCount(0);
  });

  test("模板脚本中的 HTML 片段不影响实际正文就绪和交互", async ({
    page,
  }, testInfo) => {
    const admin = requireLocalAdminClient();
    const marker = randomUUID();
    const slug = `template-html-fragment-${marker}`;
    const name = `脚本片段模板 ${marker}`;
    // 报价单的打印脚本可能包含结束标签字符串，不能把它当成文档的真正结束标签。
    const html = withDocumentProtocol(
      '<!doctype html><html><body><script>const printableEnd = "</body>";</script><h1>Fragment quotation</h1><button onclick="document.getElementById(\'result\').textContent=printableEnd">Use</button><p id="result"></p></body></html>',
    );
    let templateId: string | null = null;
    let bodyFailure: { error: unknown } | undefined;
    try {
      await loginAs(page, "administrator");
      await page.goto("/admin/company-templates");
      await page.getByRole("button", { name: "新建模板" }).click();
      const dialog = page.getByRole("dialog", { name: "新建公司模板" });
      await fillPublishDialog(dialog, { html, name, slug });
      await dialog.getByRole("button", { name: "上传并启用" }).click();
      await expect(page.getByText("模板已创建并启用。")).toBeVisible();
      const saved = await readTemplateBySlug(admin, slug);
      templateId = saved.id;
      expect(saved).toMatchObject({ revision: 1, status: "active" });
      expect(
        (await readVersion(admin, saved.current_version_id)).html_sha256,
      ).toBe(sha256(html));
      await page
        .locator("article")
        .filter({ hasText: name })
        .getByRole("link", { name: "预览模板" })
        .click();
      const frame = page.frameLocator("iframe");
      await expect(
        frame.getByRole("heading", { name: "Fragment quotation" }),
      ).toBeVisible();
      await expect(page.getByRole("status")).toHaveCount(0);
      await frame.getByRole("button", { name: "Use", exact: true }).click();
      await expect(frame.locator("#result")).toHaveText("</body>");
      await page.reload();
      await expect(page.getByRole("status")).toHaveCount(0);
      await frame.getByRole("button", { name: "Use", exact: true }).click();
      await expect(frame.locator("#result")).toHaveText("</body>");
    } catch (error) {
      bodyFailure = { error };
    } finally {
      await finalizeCompanyTemplateCase(
        page,
        testInfo,
        async () => {
          await deleteTemplateFixture(admin, {
            id: templateId ?? undefined,
            name,
          });
          return {
            templateId,
            name,
            remainingTemplates: 0,
            remainingVersions: 0,
          };
        },
        bodyFailure,
      );
    }
  });
}
