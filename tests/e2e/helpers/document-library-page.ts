import { expect, type Page } from "@playwright/test";
import type { ExplorerLibrary } from "@/lib/document-library/model";

/** 页面辅助只处理真实交互；写入凭证由独立读取模块核对。 */
export async function readLibrary(page: Page): Promise<ExplorerLibrary> {
  const response = await page.request.get(
    `/api/document-library${new URL(page.url()).search}`,
  );
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function chooseDocumentFolder(page: Page, folderId: string) {
  // 详情页链接采用客户端导航；等网址和真实页面出现后才读取当前档案，避免误读上一页。
  await expect(page).toHaveURL(/\/documents(?:[/?#]|$)/);
  // 这些属性来自实际资源管理器，不依赖中英文标题；导航仍由页面控件发起。
  await expect(page.locator("[data-document-content]")).toBeVisible();
  // 库中根目录名、桌面树标题和窄屏账户入口并不相同。只按已授权的编号选目标，不用名称别名兜底。
  const data = await readLibrary(page);
  const folder = data.folders.find(item => item.id === folderId);
  expect(folder).toBeTruthy();
  const archive = data.archives.find(item => item.id === folder!.archive_id);
  expect(archive).toBeTruthy();
  expect(archive!.id).toBe(data.archiveId);
  const parents = [folder!];
  const visited = new Set<string>([folderId]);
  let current = folder!;
  while (current.parent_id) {
    const parent = data.folders.find(item => item.id === current.parent_id);
    if (!parent || visited.has(parent.id)) throw new Error("document_fixture_path_unconfirmed");
    expect(parent.archive_id).toBe(archive!.id);
    visited.add(parent.id);
    parents.unshift(parent);
    current = parent;
  }
  if (data.folderId !== folderId) {
    // 系统根在界面直接代表账户。点账户路径后已在根，不再双击一个界面不存在的系统目录行。
    await page
      .getByRole("navigation")
      .filter({ has: page.getByTitle(archive!.name, { exact: true }) })
      .getByTitle(archive!.name, { exact: true })
      .first()
      .click();
    await expect(page.locator("[data-document-content]")).toHaveAttribute("aria-busy", "false");
    expect((await readLibrary(page)).folderId).toBe(current.id);
    for (const parent of parents.slice(1)) {
      await page.locator(`[data-explorer-item="${parent.id}"]`).dblclick();
      await expect(page).toHaveURL(new RegExp(`folder=${parent.id}(?:&|$)`));
      await expect(page.locator("[data-document-content]")).toHaveAttribute("aria-busy", "false");
    }
  }
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await expect(page.locator("[data-document-content]")).toHaveAttribute("aria-busy", "false");
  expect((await readLibrary(page)).folderId).toBe(folderId);
}

export async function uploadDocumentFiles(
  page: Page,
  names: string[],
  buffer = Buffer.from("真实资料\n", "utf8"),
  mime = "text/plain",
) {
  await page
    .locator('input[type="file"]')
    .setInputFiles(names.map((name) => ({ name, mimeType: mime, buffer })));
  await expect(page.locator('[data-document-result="succeeded"]')).toBeVisible({
    timeout: 30_000,
  });
}

export async function checkDocumentViewport(
  page: Page,
  width: number,
  name: string,
) {
  await page.setViewportSize({ width, height: 900 });
  await expect(
    page.getByRole("heading", { name: "我的文档", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  // 开发工具按钮也位于 nextjs-portal；只把真正的错误覆盖层视为失败。
  await expect(
    page.locator("nextjs-portal [data-nextjs-dialog-overlay]"),
  ).toHaveCount(0);
  await page.screenshot({
    path: `output/documents-${name}-${width}.png`,
    fullPage: true,
  });
}
