import {expect,type Page} from '@playwright/test';
import {readLocalSalesLeadCustomerProof,cleanupLocalSalesLeadConversion} from '../../test-support/sales-lead-conversion-store';
import {createSalesLeadConversionManifest,bindSalesLeadConversionManifest,validateSalesLeadCustomerProof,
  requireConversionUuid,type SalesLeadConversionManifest} from '../../test-support/sales-lead-conversion-proof';

// 页面动作前登记本次清单，不能仅凭任意线索ID推断客户归属；同一进程保留清单供清理重试。
const conversions=new Map<string,SalesLeadConversionManifest>();
export const readSalesLeadCustomerProof=readLocalSalesLeadCustomerProof;

/** 数据库独立读回的身份、非空负责人、客户和周期终态全部符合，才返回业务凭证。 */
export function assertSalesLeadCustomerProof(leadId: string){
  return validateSalesLeadCustomerProof(leadId,readSalesLeadCustomerProof(leadId));
}

export async function saveOpenLeadAsCustomer(page: Page,leadId: string,note: string){
  const manifest=createSalesLeadConversionManifest(leadId,readSalesLeadCustomerProof(leadId),note);
  conversions.set(leadId,manifest);
  await page.getByRole('dialog').getByRole('button',{name:'添加为客户',exact:true}).click();
  await page.getByTestId('lead-customer-name').fill(manifest.customerName);
  await page.getByTestId('lead-customer-notes').fill(note);
  await expect(page.getByTestId('submit-lead-customer')).toBeEnabled();
  await page.getByTestId('submit-lead-customer').click();
  await expect(page.getByText('客户已保存，线索已成为客户。',{exact:true})).toBeVisible();
  return bindSalesLeadConversionManifest(manifest,assertSalesLeadCustomerProof(leadId));
}

/** 只清理本进程写入前登记的转换，不接收猜测的客户编号；未转换时不擅自退回已有认领。 */
export function cleanupSalesLeadConversion(leadId: string){
  requireConversionUuid(leadId);
  const manifest=conversions.get(leadId);
  if(!manifest)throw new Error('lead_conversion_cleanup_manifest_missing');
  return cleanupLocalSalesLeadConversion(manifest);
}
