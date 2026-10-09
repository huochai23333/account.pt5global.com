import {confirmDocumentFolder} from "./helpers/company-template-documents";
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { requireLocalAdminClient, fillPublishDialog, expectNoPageOverflow, sha256, clickStableTemplateButton } from './helpers/company-template-actions';
import { expectDocumentSaved, expectDocumentContains, readPersonalDocument } from './helpers/company-template-documents';

test.use({ trace: 'off', video: 'off' });

// 使用实际线上导出的原发票，不给文件追加保存接口；同时覆盖另一份全新普通 HTML。
const ordinary = '<html><head><title>New work template</title></head><body><input id="qty" type="number"><input id="price" type="number"><button id="calc">计算</button><output id="total"></output><script>document.getElementById("calc").onclick=function(){document.getElementById("total").textContent=String(Number(document.getElementById("qty").value)*Number(document.getElementById("price").value));};</script></body></html>';

for (const source of ['new', 'invoice'] as const) {
  test(`不修改${source === 'new' ? '全新 HTML' : '老板原发票'}即可发布、自动保存、恢复并继续计算`, async ({ page }) => {
    test.setTimeout(120000);
    const admin = requireLocalAdminClient(); const marker = `Original HTML ${source} ${randomUUID()}`;
    const html = source === 'invoice' ? readFileSync('output/template-repair-invoice.html', 'utf8') : ordinary;
    expect(html).not.toContain('PT5Template');
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const consoleErrors: string[] = []; page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    let templateId = '';
    // 验证模板真实打印入口会调用浏览器打印；不在自动化中弹出系统对话框或声称已导出 PDF。
    await page.addInitScript(() => { window.print = () => { document.body.dataset.printRequested = 'yes'; }; });
    await page.emulateMedia({ reducedMotion: 'reduce' }); await loginAs(page, 'administrator');
    try {
      await page.goto('/admin/company-templates'); await page.getByRole('button', { name: '新建模板', exact: true }).click();
      const dialog = page.getByRole('dialog'); await fillPublishDialog(dialog, { html, name: marker, slug: `original-${randomUUID()}` });
      await dialog.getByRole('button', { name: '上传并启用', exact: true }).click(); await expect(dialog).toBeHidden({ timeout: 30000 });
      const { data: template, error } = await admin.from('company_templates').select('id,current_version_id,revision').eq('name', marker).single();
      if (error) throw error; templateId = template.id;
      const { data: version, error: versionError } = await admin.from('company_template_versions').select('html_content,html_sha256').eq('id', template.current_version_id).single();
      if (versionError) throw versionError;
      // 最终凭证必须证明上传的每一个字符与文件哈希相同，而不只是返回了发布成功。
      expect(version.html_content).toBe(html); expect(version.html_sha256).toBe(sha256(html));
      const card = page.locator('article').filter({ hasText: marker });
      await expect(card.getByRole('button', { name: '新建文档', exact: true })).toHaveCount(1);
      await card.getByRole('button', { name: '新建文档', exact: true }).click();await confirmDocumentFolder(page);
      await expect(page).toHaveURL(/\/documents\/templates\/[a-f0-9-]+$/); const id=page.url().split('/').pop()!;
      await expectDocumentSaved(page);
      const frame = page.frameLocator('iframe');
      if (source === 'new') {
        await frame.locator('#qty').fill('2'); await frame.locator('#price').fill('12.5'); await frame.getByRole('button', { name: '计算', exact: true }).click();
        await expect(frame.locator('#total')).toHaveText('25');
      } else {
        await frame.locator('#toName').fill('Original HTML acceptance');
        await frame.locator('#tbody .qty').first().fill('2'); await frame.locator('#tbody .up').first().fill('12.50');
        await expect(frame.locator('#totAmt')).toHaveValue('25.00');
        await clickStableTemplateButton(page, frame, '⧉'); await expect(frame.locator('#tbody tr.prow')).toHaveCount(4);
        await frame.locator('#toTel').fill('00000000'); await frame.locator('#incoterm').selectOption('EXW');
        await frame.locator('#tbody .desc').first().fill('Original product');
        await frame.locator('#tbody .desc').nth(1).fill('Original duplicated product');
        await expect(frame.locator('#needBadge')).toHaveText('✓ 必填已齐');
        await clickStableTemplateButton(page, frame, '打印 / 另存为 PDF'); await expect(frame.locator('body')).toHaveAttribute('data-print-requested', 'yes');
      }
      await expectDocumentContains(page,id,source === 'new' ? '12.5' : 'Original duplicated product');
      const saved=await readPersonalDocument(id); expect(saved.state.format).toBe('pt5.form.v1'); expect(saved.revision).toBeGreaterThan(1);
      await page.screenshot({ path: `output/original-html-${source}-desktop.png` });
      await page.reload(); await expect(page.getByRole('status').filter({ hasText: '正在打开模板' })).toHaveCount(0, { timeout: 20000 });
      await expectDocumentSaved(page);
      await expect(frame.locator(source === 'new' ? '#qty' : '#toName')).toHaveValue(source === 'new' ? '2' : 'Original HTML acceptance');
      if(source === 'new'){await expect(frame.locator('#total')).toHaveText('25');await frame.locator('#qty').fill('3');await frame.getByRole('button',{name:'计算',exact:true}).click();await expect(frame.locator('#total')).toHaveText('37.5');}
      else {await expect(frame.locator('#tbody tr.prow')).toHaveCount(4);await frame.locator('#tbody .qty').first().fill('3');await expect(frame.locator('#totAmt')).toHaveValue('62.50');}
      await page.getByRole('button',{name:'保存',exact:true}).click();await confirmDocumentFolder(page);await expectDocumentSaved(page);
      await page.reload();await expectDocumentSaved(page);
      await expect(frame.locator(source === 'new' ? '#total' : '#totAmt'))[source === 'new' ? 'toHaveText' : 'toHaveValue'](source === 'new' ? '37.5' : '62.50');
      const { count: documentCount } = await admin.from('company_template_documents').select('id', { count: 'exact', head: true }).eq('template_id', templateId);
      expect(documentCount).toBe(1);
      await page.setViewportSize({ width: 375, height: 812 }); await expectNoPageOverflow(page); await expect(page.locator('iframe')).toHaveCount(0);
      await page.screenshot({ path: `output/original-html-${source}-mobile.png` }); expect(errors).toEqual([]); expect(consoleErrors).toEqual([]);
      writeFileSync(`output/original-html-${source}-evidence.json`, JSON.stringify({ template, originalHash: version.html_sha256, documentId:id,revision:(await readPersonalDocument(id)).revision,documentsCreated: documentCount, errors, consoleErrors }, null, 2));
    } finally {
      // 个人文档会保留版本引用；先清理本次文档，再删除本次临时模板，不能忽略外键失败。
      if (templateId) await admin.from('company_template_documents').delete().eq('template_id', templateId);
      const { error } = await admin.from('company_templates').delete().eq('name', marker); if (error) throw error;
    }
  });
}

test('初始化失败的原 HTML 不启用，也不改写原文件', async ({ page }) => {
  const admin = requireLocalAdminClient(); const slug = `broken-html-${randomUUID()}`;
  await loginAs(page, 'administrator'); await page.goto('/admin/company-templates');
  await page.getByRole('button', { name: '新建模板', exact: true }).click(); const dialog = page.getByRole('dialog');
  await fillPublishDialog(dialog, { html: '<html><body><script>throw Error("Initialization failed")</script></body></html>', name: 'Broken HTML', slug });
  await dialog.getByRole('button', { name: '上传并启用', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('检查');
  const { count } = await admin.from('company_templates').select('id', { count: 'exact', head: true }).eq('slug', slug); expect(count).toBe(0);
});

test('模板版本切换使用入口，已有个人文档仍恢复原版', async ({ page }) => {
  test.setTimeout(120000); const admin = requireLocalAdminClient(); const marker = `Capability versions ${randomUUID()}`;
  const slug = `capability-${randomUUID()}`; const ids: string[] = []; let tid = '';
  const savable = readFileSync('examples/company-template-personal-document.html', 'utf8');
  await loginAs(page, 'administrator');
  async function publish(html: string, first = false) {
    await page.goto('/admin/company-templates');
    if (first) await page.getByRole('button', { name: '新建模板', exact: true }).click();
    else await page.locator('article').filter({ hasText: marker }).getByRole('button', { name: '上传新版本', exact: true }).click();
    const dialog = page.getByRole('dialog'); await fillPublishDialog(dialog, { html, name: marker, slug });
    await dialog.getByRole('button', { name: '上传并启用', exact: true }).click(); await expect(dialog).toBeHidden({ timeout: 30000 });
    const { data, error } = await admin.from('company_templates').select('id,current_version_id,revision').eq('name', marker).single();
    if (error) throw error; tid = data.id; return data;
  }
  try {
    await publish(ordinary, true); const card = page.locator('article').filter({ hasText: marker });
    await expect(card.getByRole('button', { name: '新建文档', exact: true })).toHaveCount(1);
    const second = await publish(savable); expect(second.revision).toBe(2);
    await card.getByRole('button', { name: '新建文档', exact: true }).click();await confirmDocumentFolder(page); await expect(page).toHaveURL(/\/documents\/templates\/[a-f0-9-]+$/);
    const id = page.url().split('/').pop()!; ids.push(id); await expectDocumentSaved(page);
    await page.frameLocator('iframe').locator('#customer').fill('Pinned capability document'); await expectDocumentContains(page, id, 'Pinned capability document');
    const saved = await readPersonalDocument(id); expect(saved.template_version_id).toBe(second.current_version_id);
    const third = await publish(ordinary); expect(third.revision).toBe(3);
    await page.reload(); await expect(card.getByRole('button', { name: '新建文档', exact: true })).toHaveCount(1);
    await expect(card.getByRole('button', { name: '新建文档', exact: true })).toBeVisible();
    await page.goto(`/admin/documents/templates/${id}`); await expectDocumentSaved(page);
    await expect(page.frameLocator('iframe').locator('#customer')).toHaveValue('Pinned capability document');
    expect((await readPersonalDocument(id)).template_version_id).toBe(second.current_version_id);
  } finally {
    if (ids.length) await admin.from('company_template_documents').delete().in('id', ids);
    if (tid) await admin.from('company_templates').delete().eq('id', tid);
  }
});
