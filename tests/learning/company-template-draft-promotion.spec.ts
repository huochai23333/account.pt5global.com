import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import {
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";
import { prepareCustomerDocumentUpload } from "./customer-document-upload-fixture";
import { expect, test } from "./fixtures";

const content = `<!doctype html><html><body><label for="client">Learning client</label><input id="client">
<script>
  const field = document.getElementById("client");
  window.PT5Template = {
    version: 1,
    exportState: () => ({ client: field.value }),
    importState: (state) => { field.value = state.client ?? ""; },
    subscribe: (notify) => { field.addEventListener("input", notify); }
  };
</script></body></html>`;

const draftEndpoint = "**/api/company-template-document-drafts";
const localOrigin = "http://localhost:3000";
const copy = zh.CompanyTemplates.documents;

test("草稿转正未知时核对原文档并恢复真实写入", async ({
  page,
  browser,
  learningUser,
  learningStaff,
}, testInfo) => {
  test.setTimeout(110_000);
  const templateId = randomUUID();
  const versionId = randomUUID();
  const title = `Learning template ${templateId}`;
  const savedName = `Learning formal ${templateId}`;
  const copyName = `Learning copy ${templateId}`;
  const subfolderName = `Learning destination ${templateId}`;
  const wrongId = randomUUID();
  const folder = prepareCustomerDocumentUpload(learningUser);
  const requests: string[] = [];
  const folderRequests: string[] = [];
  const pageErrors: string[] = [];
  let draftId = "";
  const read = () =>
    JSON.parse(
      executeLearningSql(`select json_build_object(
    'drafts',(select coalesce(json_agg(x),'[]') from (select id,template_version_id,revision,state,state_sha256,
      state_sha256=encode(extensions.digest(convert_to(state::text,'UTF8'),'sha256'),'hex') hash_matches
      from public.company_template_document_drafts where template_id='${templateId}' and owner_id='${learningUser.id}') x),
    'documents',(select coalesce(json_agg(x order by name),'[]') from (select id,folder_id,name,template_version_id,revision,state,state_sha256,
      state_sha256=encode(extensions.digest(convert_to(state::text,'UTF8'),'sha256'),'hex') hash_matches
      from public.company_template_documents where template_id='${templateId}' and owner_id='${learningUser.id}') x),
    'promotions',(select coalesce(json_agg(operation_id),'[]') from public.company_template_draft_operations
      where owner_id='${learningUser.id}' and draft_id::text='${draftId}' and receipt->>'action'='promote')
  );`),
    );
  try {
    // 只准备专属模板和目标目录。草稿创建、自动保存、转正与正式保存均从页面发起。
    const encoded = Buffer.from(content).toString("base64");
    const hash = createHash("sha256").update(content).digest("hex");
    executeLearningSql(`begin;
      insert into public.company_templates(id,slug,name,status,current_version_id,revision,created_by)
      values ('${templateId}','learning-${templateId}','${title}','active','${versionId}',1,'${learningUser.id}');
      insert into public.company_template_versions(id,template_id,version_number,html_content,source_filename,html_sha256,published_by)
      values ('${versionId}','${templateId}',1,convert_from(decode('${encoded}','base64'),'UTF8'),'learning.html','${hash}','${learningUser.id}');
      commit;`);
    await page.setViewportSize({ width: 1440, height: 1000 });
    page.setDefaultTimeout(12_000);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page
      .context()
      .addCookies([{ name: "bs-locale", value: "zh", url: localOrigin }]);
    await loginLearningUser(page, learningUser);
    const notice = zh.DashboardShell.announcements;
    const announcement = page.getByRole("dialog", {
      name: notice.newTitle,
      exact: true,
    });
    await page.addLocatorHandler(announcement, () =>
      announcement.getByRole("button", { name: notice.acknowledge }).click(),
    );
    await page.goto(`/admin/company-templates?folder=${folder.folderId}`);
    const card = page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await card.getByRole("button", { name: copy.create, exact: true }).click();
    await expect(page).toHaveURL(/\/documents\/drafts\/[a-f0-9-]+$/);
    draftId = page.url().split("/").at(-1)!;
    const editor = page.frameLocator("iframe").locator("#client");
    await editor.fill("Learning draft content");
    await expect(
      page.getByText(copy.draftStatus.saved, { exact: true }),
    ).toBeVisible();
    const initial = read();
    expect(initial.documents).toEqual([]);
    expect(initial.drafts).toHaveLength(1);
    expect(initial.drafts[0]).toMatchObject({
      id: draftId,
      template_version_id: versionId,
      state: { client: "Learning draft content" },
      hash_matches: true,
    });
    await page.reload();
    await expect(editor).toHaveValue("Learning draft content");

    const draftPath = page.url();
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 900 },
    });
    try {
      await loginLearningUser(mobile, learningUser);
      await mobile
        .context()
        .addCookies([{ name: "bs-locale", value: "en", url: localOrigin }]);
      await mobile.goto(draftPath);
      await expect(
        mobile.getByText(en.CompanyTemplates.viewer.desktopOnly, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(mobile.locator("iframe")).toHaveCount(0);
      expect(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await mobile.screenshot({
        path: testInfo.outputPath("draft-mobile.png"),
        animations: "disabled",
      });
    } finally {
      await mobile.close();
    }

    const visitor = await browser.newPage();
    try {
      await loginLearningUser(visitor, learningStaff);
      const detail = await visitor.request.get(
        `${localOrigin}/api/company-template-document-drafts/${draftId}`,
      );
      expect(await detail.json()).toEqual({ draft: null, document: null });
      const content = await visitor.request.get(
        `${localOrigin}/api/company-template-document-drafts/${draftId}/content?loadToken=${randomUUID()}`,
      );
      expect(content.status()).toBe(404);
      await visitor.goto(`${localOrigin}/salesman/documents/drafts/${draftId}`);
      await expect(visitor.locator("iframe")).toHaveCount(0);
    } finally {
      await visitor.close();
    }

    const listEndpoint = "**/api/company-template-documents/save-as?*";
    // 文件列表返回成功响应却缺少条目时，弹窗仍应保留文件名，并允许恢复查询。
    await page.route(listEndpoint, (route) =>
      route.fulfill({ status: 200, json: { total: 0, page: 1 } }),
    { times: 1 });
    await page.getByRole("button", { name: copy.saveAs, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: copy.saveAs, exact: true });
    await dialog.getByLabel(copy.fileName, { exact: true }).fill(savedName);
    const save = dialog.getByRole("button", { name: copy.save, exact: true });
    await expect(dialog.getByRole("alert").getByText(copy.errors.document_failed, { exact: true })).toBeVisible();
    await expect(save).toBeDisabled();
    expect(read()).toEqual(initial);
    await dialog.getByRole("button", { name: copy.retry, exact: true }).click();
    await expect(save).toBeEnabled();
    await expect(dialog.getByText(copy.saveAsEmpty, { exact: true })).toBeVisible();
    await expect(dialog.getByLabel(copy.fileName, { exact: true })).toHaveValue(savedName);
    const close = dialog.getByRole("button", {
      name: copy.cancel,
      exact: true,
    });
    await page.route(draftEndpoint, async (route) => {
      const request = route.request();
      if (
        request.method() !== "POST" ||
        request.postDataJSON().action !== "promote"
      )
        return route.fallback();
      requests.push(request.postDataJSON().operationId);
      await route.abort("connectionreset");
    });
    await save.click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(read()).toEqual(initial);
    await page.unroute(draftEndpoint);

    // 缺少原草稿编号的错误回执不能导航，也不能清除待核对的操作。
    await page.route(
      `**/api/company-template-document-drafts/${draftId}`,
      (route) =>
        route.fulfill({
          status: 200,
          json: { draft: null, document: { id: wrongId } },
        }),
      { times: 1 },
    );
    await close.click();
    await expect(dialog.getByRole("alert")).toHaveText(
      copy.errors.document_not_confirmed,
    );
    await expect(page).toHaveURL(draftPath);
    expect(read()).toEqual(initial);
    await page.screenshot({
      path: testInfo.outputPath("promotion-unconfirmed.png"),
      animations: "disabled",
    });

    await page.route(draftEndpoint, async (route) => {
      const request = route.request();
      if (
        request.method() !== "POST" ||
        request.postDataJSON().action !== "promote"
      )
        return route.fallback();
      requests.push(request.postDataJSON().operationId);
      const response = await route.fetch({ maxRetries: 0 });
      expect(response.ok()).toBe(true);
      await route.abort("connectionreset");
    });
    await save.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toBe(requests[0]);
    const promoted = read();
    expect(promoted.drafts).toEqual([]);
    expect(promoted.promotions).toEqual([requests[0]]);
    expect(promoted.documents).toHaveLength(1);
    expect(promoted.documents[0]).toMatchObject({
      id: draftId,
      template_version_id: versionId,
      folder_id: folder.folderId,
      name: savedName,
      state: initial.drafts[0].state,
      state_sha256: initial.drafts[0].state_sha256,
      hash_matches: true,
    });
    await page.unroute(draftEndpoint);
    await close.click();
    await expect(page).toHaveURL(
      new RegExp(`/documents/templates/${draftId}$`),
    );
    await expect(editor).toHaveValue("Learning draft content");

    // 普通保存响应丢失后，人工重试应只核对原编号和原版本。
    const documentEndpoint = "**/api/company-template-documents";
    const formalRequests: string[] = [];
    await page.route(documentEndpoint, async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      formalRequests.push(route.request().postDataJSON().operationId);
      expect((await route.fetch({ maxRetries: 0 })).ok()).toBe(true);
      await route.abort("connectionreset");
    });
    const formalSave = page.getByRole("button", {
      name: copy.save,
      exact: true,
    });
    await formalSave.click();
    await expect(
      page.getByText(copy.status.failed, { exact: true }),
    ).toBeVisible();
    const committed = read().documents[0];
    expect(committed.revision).toBe(promoted.documents[0].revision + 1);
    await page.unroute(documentEndpoint);
    await page.route(documentEndpoint, async (route) => {
      if (route.request().method() === "POST")
        formalRequests.push(route.request().postDataJSON().operationId);
      await route.continue();
    });
    await page.getByRole("button", { name: copy.retry, exact: true }).click();
    await expect(
      page.getByText(copy.status.saved, { exact: true }),
    ).toBeVisible();
    expect(read().documents[0]).toEqual(committed);
    expect(formalRequests).toEqual([formalRequests[0], formalRequests[0]]);

    // 同一事件帧的两次点击只产生一个显式保存。
    await formalSave.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect.poll(() => formalRequests.length).toBe(3);
    await expect
      .poll(() => read().documents[0].revision)
      .toBe(committed.revision + 1);
    await expect(
      page.getByText(copy.status.saved, { exact: true }),
    ).toBeVisible();
    const original = read().documents[0];
    expect(original).toMatchObject({
      id: draftId,
      revision: committed.revision + 1,
      folder_id: folder.folderId,
      hash_matches: true,
    });
    expect(formalRequests).toHaveLength(3);
    expect(
      executeLearningSql(`select count(*) from public.company_template_document_operations
      where owner_id='${learningUser.id}' and receipt->>'document_id'='${draftId}';`),
    ).toBe("2");
    await page.unroute(documentEndpoint);

    // 另存为生成新编号，保留来源文档的内容和版本。
    await page.getByRole("button", { name: copy.saveAs, exact: true }).click();
    await dialog.getByLabel(copy.fileName, { exact: true }).fill(copyName);
    await dialog.getByRole("button", { name: zh.Documents.explorer.create, exact: true }).click();
    await dialog.getByRole("textbox", { name: copy.newFolderName, exact: true }).fill(subfolderName);
    const confirmFolder = dialog.getByRole("button", { name: copy.confirm, exact: true });
    const folderEndpoint = "**/api/document-library";
    await page.route(folderEndpoint, async (route) => {
      const body = route.request().method() === "POST" ? route.request().postDataJSON() : null;
      if (body?.action !== "create_folder") return route.fallback();
      folderRequests.push(body.operationId);
      if (folderRequests.length !== 1) return route.continue();
      expect((await route.fetch({ maxRetries: 0 })).ok()).toBe(true);
      await route.abort("connectionreset");
    });
    await confirmFolder.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(dialog.getByRole("alert").getByText(copy.errors.document_failed, { exact: true })).toBeVisible();
    const readDestination = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(row_to_json(f)),'[]')
      from (select id,name,parent_id,version from public.document_folders
        where parent_id='${folder.folderId}' and name='${subfolderName}') f;`));
    const destination = readDestination();
    expect(destination).toHaveLength(1);
    expect(destination[0]).toMatchObject({ parent_id: folder.folderId, name: subfolderName, version: 1 });
    await confirmFolder.click();
    await expect(dialog.locator("[data-save-as-path]")).toContainText(subfolderName);
    expect(folderRequests).toEqual([folderRequests[0], folderRequests[0]]);
    expect(readDestination()).toEqual(destination);
    const folderReceipt = JSON.parse(executeLearningSql(`select coalesce(json_agg(receipt),'[]')
      from public.document_operations where actor_id='${learningUser.id}' and action='create_folder'
        and payload->>'folderId'='${folder.folderId}' and payload->>'name'='${subfolderName}';`));
    expect(folderReceipt).toHaveLength(1);
    expect(folderReceipt[0]).toMatchObject({
      operationId: folderRequests[0], action: "create_folder", affectedCount: 1, status: "succeeded",
      record: destination[0],
    });
    await page.unroute(folderEndpoint);
    await page.screenshot({
      path: testInfo.outputPath("save-as-destination.png"),
      animations: "disabled",
    });
    await save.click();
    await expect(page).not.toHaveURL(
      new RegExp(`/documents/templates/${draftId}$`),
    );
    const final = read();
    expect(final.documents).toHaveLength(2);
    expect(
      final.documents.find((entry: { id: string }) => entry.id === draftId),
    ).toEqual(original);
    const duplicate = final.documents.find(
      (entry: { name: string }) => entry.name === copyName,
    );
    expect(duplicate).toMatchObject({
      template_version_id: versionId,
      folder_id: destination[0].id,
      state: original.state,
      state_sha256: original.state_sha256,
      hash_matches: true,
    });
    await page.reload();
    await expect(page).toHaveURL(
      new RegExp(`/documents/templates/${duplicate.id}$`),
    );
    await expect(editor).toHaveValue("Learning draft content");
    expect(read()).toEqual(final);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("formal-document.png"),
      animations: "disabled",
    });
    await page.goto(draftPath);
    await expect(
      page.getByRole("heading", { name: copy.draftPromoted, exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: copy.edit, exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/documents/templates/${draftId}$`),
    );
    await expect(editor).toHaveValue("Learning draft content");
    expect(read()).toEqual(final);
    expect(pageErrors).toEqual([]);
    await writeFile(
      testInfo.outputPath("template-lifecycle.json"),
      JSON.stringify(
        {
          templateId,
          versionId,
          initial,
          promoted,
          committed,
          formalRequests,
          folderRequests,
          folderReceipt,
          destination,
          final,
        },
        null,
        2,
      ),
    );
  } finally {
    // 独立账号的写入收据可能在草稿转正后保留，只清理本次账号及合成模板的记录。
    executeLearningSql(`begin;
      delete from public.company_template_draft_operations where owner_id='${learningUser.id}' and draft_id::text='${draftId}';
      delete from public.company_template_document_operations where owner_id='${learningUser.id}' and receipt->>'document_id' in
        (select id::text from public.company_template_documents where template_id='${templateId}' and owner_id='${learningUser.id}');
      delete from public.company_template_document_drafts where template_id='${templateId}' and owner_id='${learningUser.id}';
      delete from public.company_template_documents where template_id='${templateId}' and owner_id='${learningUser.id}';
      delete from public.company_templates where id='${templateId}' and created_by='${learningUser.id}';
      delete from public.document_operations where actor_id='${learningUser.id}' and action='create_folder'
        and payload->>'folderId'='${folder.folderId}' and payload->>'name'='${subfolderName}';
      commit;`);
    expect(read()).toEqual({ drafts: [], documents: [], promotions: [] });
    expect(
      executeLearningSql(
        `select count(*) from public.company_template_versions where id='${versionId}';`,
      ),
    ).toBe("0");
    const cleanup = await folder.cleanup();
    expect(executeLearningSql(`select (select count(*) from public.document_folders
      where parent_id='${folder.folderId}' and name='${subfolderName}'),
      (select count(*) from public.document_operations where actor_id='${learningUser.id}'
       and action='create_folder' and payload->>'folderId'='${folder.folderId}' and payload->>'name'='${subfolderName}');`)).toBe("0|0");
    expect(cleanup).toEqual({
      customer: null,
      archiveCount: 0,
      files: [],
      operations: [],
      objects: [],
    });
    await writeFile(
      testInfo.outputPath("template-cleanup.json"),
      JSON.stringify(cleanup),
    );
  }
});
