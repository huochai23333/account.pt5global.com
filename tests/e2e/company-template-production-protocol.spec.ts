import {confirmDocumentFolder} from "./helpers/company-template-documents";
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { requireLocalAdminClient, fillPublishDialog, expectNoPageOverflow, clickStableTemplateButton } from './helpers/company-template-actions';
import { readPersonalDocument, expectDocumentSaved, expectDocumentContains } from './helpers/company-template-documents';

// 原模板包含内嵌图片；保留截图与数据库凭证，避免录制把这些图片反复复制进大体积轨迹。
test.use({ trace: 'off', video: 'off' });

// 使用本次只读导出的线上原文件，不能用简化模板代替真实文件的恢复能力。
for (const kind of ['quotation', 'invoice'] as const) {
  test(`线上原版${kind === 'quotation' ? '报价单' : '形式发票'}发布、填写、保存与刷新恢复`, async ({ page }) => {
    test.setTimeout(150000);
    const admin = requireLocalAdminClient(); const ids: string[] = []; let templateId = '';
    const marker = `Protocol repair ${kind} ${randomUUID()}`;
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const html = readFileSync(`output/template-repair-${kind}.html`, 'utf8');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loginAs(page, 'administrator');
    try {
      await page.goto('/admin/company-templates'); await page.getByRole('button', { name: '新建模板', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await fillPublishDialog(dialog, { html, name: marker, slug: `protocol-${randomUUID()}` });
      await dialog.getByRole('button', { name: '上传并启用', exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: 30000 });
      const { data: template, error } = await admin.from('company_templates').select('id,current_version_id,revision').eq('name', marker).single();
      if (error) throw error; templateId = template.id;
      await page.locator('article').filter({ hasText: marker }).getByRole('button', { name: '新建文档', exact: true }).click();await confirmDocumentFolder(page);
      await expect(page).toHaveURL(/\/documents\/templates\/[a-f0-9-]+$/); const id = page.url().split('/').pop()!; ids.push(id);
      await expectDocumentSaved(page); const frame = page.frameLocator('iframe');
      const value = 'Protocol restored ' + kind;
      await frame.locator(kind === 'quotation' ? '#client' : '#toName').fill(value);
      if (kind === 'invoice') {
        await frame.locator('#piInvNo').fill('PINNED-TEST-001');
        await frame.locator('#piDate').fill('2020-01-02');
        await frame.locator('#layout').selectOption('portrait');
        await frame.locator('#tbody .desc').first().fill('Test product');
        await frame.locator('#tbody .qty').first().fill('2');
        await frame.locator('#tbody .up').first().fill('12.50');
      }
      await expectDocumentContains(page, id, value);
      const saved = await readPersonalDocument(id); expect(saved.template_version_id).toBe(template.current_version_id);
      expect(saved.revision).toBeGreaterThan(1);
      await page.reload(); await expectDocumentSaved(page);
      await expect(frame.locator(kind === 'quotation' ? '#client' : '#toName')).toHaveValue(value);
      if (kind === 'invoice') {
        await expect(frame.locator('#piInvNo')).toHaveValue('PINNED-TEST-001');
        await expect(frame.locator('#piDate')).toHaveValue('2020-01-02');
        await expect(frame.locator('#totAmt')).toHaveValue('25.00');
        await expect(frame.locator('body')).toHaveClass(/portrait/);
        await clickStableTemplateButton(page, frame, '⧉');
        await expect(frame.locator('#tbody tr.prow')).toHaveCount(4);
        await expect.poll(async () => (await readPersonalDocument(id)).state.actions.length).toBeGreaterThan(0);
        await expectDocumentSaved(page);
        await page.reload(); await expectDocumentSaved(page);
        await expect(frame.locator('#tbody tr.prow')).toHaveCount(4);
        // 动态付款字段、异步图片和自定义比例都要保存实际数据，而不只验证客户名称。
        await clickStableTemplateButton(page, frame, '+ 行');
        await frame.locator('#payCol .card').first().locator('.row').last().locator('.lab').fill('Test field');
        await frame.locator('#payCol .card').first().locator('.row').last().locator('.val').fill('Test value');
        page.once('dialog', prompt => prompt.accept('7'));
        await frame.locator('#tbody .calcsel').nth(1).selectOption('custom');
        await frame.locator('#sealFile').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') });
        await expectDocumentContains(page, id, 'Test value');
        await expect.poll(async () => (await readPersonalDocument(id)).state.images.find((image: {src:string})=>image.src.startsWith('data:image/png;base64,')).src).toMatch(/^data:image\/png;base64,/);
        await page.reload(); await expectDocumentSaved(page);
        await expect(frame.locator('#tbody .calcsel').nth(1)).toHaveValue('custom');
        await expect(frame.locator('#tbody .amt').nth(1)).toHaveValue('1.75');
        await expect(frame.locator('#payCol .card').first().locator('.row').last().locator('.val')).toHaveValue('Test value');
        await expect(frame.locator('#sealImg')).toHaveAttribute('src', /^data:image\/png;base64,/);
      }
      await page.screenshot({ path: `output/template-repair-${kind}-desktop.png` });
      await page.setViewportSize({ width: 375, height: 812 }); await expectNoPageOverflow(page);
      await expect(page.locator('iframe')).toHaveCount(0);
      await page.screenshot({ path: `output/template-repair-${kind}-mobile.png` });
      expect(errors).toEqual([]);
      writeFileSync(`output/template-repair-${kind}-evidence.json`, JSON.stringify({ template, documentId: id, revision: saved.revision, hash: saved.state_sha256, errors, viewports: [1280, 375] }, null, 2));
    } finally {
      if (ids.length) await admin.from('company_template_documents').delete().in('id', ids);
      if (templateId) await admin.from('company_templates').delete().eq('id', templateId);
      else await admin.from('company_templates').delete().eq('name', marker);
    }
  });
}

test('正文未确认时停止等待并禁止保存，重新打开后从真实数据库恢复', async ({ page }) => {
  test.setTimeout(75000); const admin = requireLocalAdminClient(); const ids: string[] = [];
  await loginAs(page, 'salesman');
  // HTTP 200 与 iframe load 都不能代替就绪握手；没有接口的正文不应触发空文档写入。
  await page.route('**/api/company-template-documents/*/content?*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Unconfirmed document</body></html>' }));
  try {
    await page.goto('/salesman/company-templates'); await page.getByRole('button', { name: '新建文档', exact: true }).first().click();await confirmDocumentFolder(page);
    await expect(page).toHaveURL(/\/documents\/templates\/[a-f0-9-]+$/); const id = page.url().split('/').pop()!; ids.push(id);
    await expect(page.getByRole('button', { name: '重新打开', exact: true })).toBeVisible({ timeout: 22000 });
    await expect(page.getByRole('status').filter({ hasText: '正在打开文档' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
    const failed = await readPersonalDocument(id); expect(failed.revision).toBe(1); expect(failed.state).toEqual({});
    await page.unroute('**/api/company-template-documents/*/content?*');
    await page.getByRole('button', { name: '重新打开', exact: true }).click(); await expectDocumentSaved(page);
    await page.frameLocator('iframe').locator('#client').fill('Confirmed after retry');
    await expectDocumentContains(page, id, 'Confirmed after retry');
    await page.reload(); await expectDocumentSaved(page);
    await expect(page.frameLocator('iframe').locator('#client')).toHaveValue('Confirmed after retry');
  } finally { await page.unroute('**/api/company-template-documents/*/content?*'); if (ids.length) await admin.from('company_template_documents').delete().in('id', ids); }
});
