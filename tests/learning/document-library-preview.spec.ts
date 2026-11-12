import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import {
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";
import { prepareCustomerDocumentUpload } from "./customer-document-upload-fixture";
import { expect, test } from "./fixtures";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC9sAAAAASUVORK5CYII=",
  "base64",
);
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

function learningPdf() {
  const stream = "BT /F1 18 Tf 32 130 Td (PT5 learning PDF) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 280 180] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let source = "%PDF-1.4\n";
  const offsets = ["0000000000 65535 f \n"];
  // 全部内容为 ASCII，字符数就是 PDF 交叉引用表所用的字节位置。
  for (const [index, object] of objects.entries()) {
    offsets.push(`${String(source.length).padStart(10, "0")} 00000 n \n`);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = source.length;
  return Buffer.from(
    `${source}xref\n0 6\n${offsets.join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
}

for (const [locale, width, messages] of [
  ["zh", 1440, zh],
  ["en", 390, en],
] as const) {
  test.describe(`${locale}/${width}`, () => {
    test.use({ learningStaffRole: locale === "zh" ? "salesman" : "client" });
    test(`资料库预览与文件交互 ${locale}/${width}`, async ({
      page,
      browser,
      learningUser,
      learningStaff,
    }, testInfo) => {
      const fixture = prepareCustomerDocumentUpload(learningUser);
      const image = locale === "zh";
      const extension = image ? "png" : "pdf";
      const mime = image ? "image/png" : "application/pdf";
      const name = `${fixture.id}.${extension}`;
      const renamed = `${fixture.id}-renamed.${extension}`;
      const bytes = image ? png : learningPdf();
      const errors: string[] = [];
      let fileId = "";
      const copy = messages.Documents;
      const bucket = learningUser.client.storage.from("document-library");
      try {
        await page.setViewportSize({ width, height: 900 });
        page.on("pageerror", (error) => errors.push(error.message));
        await loginLearningUser(page, learningUser);
        await page
          .context()
          .addCookies([
            { name: "bs-locale", value: locale, url: "http://localhost:3000" },
          ]);
        const notice = messages.DashboardShell.announcements;
        const announcement = page.getByRole("dialog", {
          name: notice.newTitle,
          exact: true,
        });
        await page.addLocatorHandler(announcement, () =>
          announcement
            .getByRole("button", { name: notice.acknowledge })
            .click(),
        );
        await page.goto(
          `/admin/documents?scope=folder&folder=${fixture.folderId}`,
        );
        await page
          .locator('input[type="file"]')
          .setInputFiles({ name, mimeType: mime, buffer: bytes });
        await expect(page.locator("[data-document-file]")).toHaveCount(1);
        const [file] = fixture.read().files;
        fileId = file.id;
        expect(file).toMatchObject({
          status: "ready",
          version: 2,
          sha256: sha(bytes),
        });
        expect(await fixture.download(file.storage_path)).toEqual(bytes);
        const row = page.locator(`[data-document-file="${fileId}"]`);
        await row.click();
        await row.press("F2");
        const input = page.locator("[data-inline-name]");
        await expect(input).toBeFocused();
        await input.fill(renamed);
        await input.press("Enter");
        await expect(input).toHaveCount(0);
        await expect(row).toHaveAccessibleName(renamed);
        expect(fixture.read().files[0]).toEqual({ ...file, version: 3 });
        expect(
          executeLearningSql(
            `select name from public.document_files where id='${fileId}';`,
          ),
        ).toBe(renamed);
        await page.reload();
        await expect(row).toHaveAccessibleName(renamed);

        const route = `/api/document-library/files/${fileId}/content?preview=1`;
        const dialog = page.getByRole("dialog", {
          name: copy.preview,
          exact: true,
        });
        const [response] = await Promise.all([
          page.waitForResponse(
            (result) =>
              new URL(result.url()).pathname + new URL(result.url()).search ===
              route,
          ),
          row.dblclick(),
        ]);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toBe(mime);
        expect(response.headers()["content-disposition"]).toMatch(/^inline;/);
        // Chrome PDF 查看器可合成 iframe 响应。直接 HTTP 读取核对服务器原始策略和字节。
        const direct = await page.request.get(route);
        expect(direct.headers()["content-security-policy"]).toContain(
          "script-src 'none'",
        );
        expect(await direct.body()).toEqual(bytes);
        expect(Number(response.headers()["content-length"])).toBe(bytes.length);
        const frame = dialog.locator("iframe");
        await expect(frame).toHaveAttribute("aria-hidden", "false");
        await expect(frame).toBeVisible();
        if (image) {
          await expect
            .poll(() =>
              frame
                .contentFrame()
                .locator("img")
                .evaluate((node: HTMLImageElement) => node.naturalWidth),
            )
            .toBe(1);
        } else {
          // 等待 Chromium 的原生查看器完成文档载入后再截图。
          const findViewer = () =>
            page
              .frames()
              .find((entry) =>
                entry
                  .url()
                  .startsWith(
                    "chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/",
                  ),
              );
          await expect.poll(() => Boolean(findViewer())).toBe(true);
          await findViewer()!
            .locator("pdf-viewer")
            .evaluate(async (viewer) => {
              await customElements.whenDefined("pdf-viewer");
              await (viewer as HTMLElement & { loaded: Promise<void> }).loaded;
              await new Promise(requestAnimationFrame);
            });
        }
        await page.screenshot({
          path: testInfo.outputPath("preview.png"),
          animations: "disabled",
        });
        await dialog
          .getByRole("button", { name: copy.cancel, exact: true })
          .click();

        // 只撤下本次对象，文件登记仍可见。页面应显示日常提示，保留当前弹窗。
        expect((await bucket.remove([file.storage_path])).error).toBeNull();
        const [failure] = await Promise.all([
          page.waitForResponse((result) => result.url().endsWith(route)),
          row.dblclick(),
        ]);
        expect(failure.status()).toBe(400);
        await expect(dialog.getByRole("alert")).toBeVisible();
        await expect(frame).toHaveCount(0);
        await page.screenshot({
          path: testInfo.outputPath("preview-error.png"),
          animations: "disabled",
        });

        expect(
          (await bucket.upload(file.storage_path, bytes, { contentType: mime }))
            .error,
        ).toBeNull();
        const [recovered] = await Promise.all([
          page.waitForResponse((result) => result.url().endsWith(route)),
          dialog
            .getByRole("button", { name: copy.previewRetry, exact: true })
            .click(),
        ]);
        expect(recovered.status()).toBe(200);
        await expect(frame).toHaveAttribute("aria-hidden", "false");
        await expect(frame).toBeVisible();
        await expect(dialog.getByRole("alert")).toHaveCount(0);
        if (image) {
          await expect
            .poll(() =>
              frame
                .contentFrame()
                .locator("img")
                .evaluate((node: HTMLImageElement) => node.naturalWidth),
            )
            .toBe(1);
        }

        const coworker = await browser.newPage();
        const otherRoleStatus = image ? 200 : 403;
        try {
          await loginLearningUser(coworker, learningStaff);
          await coworker.goto(
            `/${image ? "salesman" : "client"}/documents?scope=folder&folder=${fixture.folderId}`,
          );
          await expect(
            coworker.locator(`[data-document-file="${fileId}"]`),
          ).toHaveCount(image ? 1 : 0);
          expect(
            (
              await coworker.request.get(`http://localhost:3000${route}`)
            ).status(),
          ).toBe(otherRoleStatus);
        } finally {
          await coworker.close();
        }
        expect(errors).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await writeFile(
          testInfo.outputPath("preview-receipt.json"),
          JSON.stringify(
            {
              fileId,
              mime,
              sha256: sha(bytes),
              version: 3,
              missing: failure.status(),
              otherRoleStatus,
            },
            null,
            2,
          ),
        );
      } finally {
        if (fileId)
          executeLearningSql(
            `delete from public.document_operations where actor_id='${learningUser.id}' and action='rename_file' and payload->>'fileId'='${fileId}';`,
          );
        const cleanup = await fixture.cleanup();
        expect(cleanup).toEqual({
          customer: null,
          archiveCount: 0,
          files: [],
          operations: [],
          objects: [],
        });
      }
    });
  });
}
