import { expect, type Page } from "@playwright/test";
import { runLocalSupabaseSql } from "./local-supabase";

/** 独立数据库查询核对客户、负责人、周期终态，不依赖浏览器收到的保存响应。 */
export function readSalesLeadCustomerProof(leadId: string) {
  const raw = runLocalSupabaseSql(`select jsonb_build_object(
    'lead_id',lead.id,'status',lead.status,'customer_id',customer.id,
    'owner',customer.assigned_sales_user_id,'lead_owner',lead.current_assignee_user_id,
    'customer_name',customer.unique_name,'customer_version',customer.updated_at,
    'ended_reason',assignment.ended_reason,'ended_at',assignment.ended_at)
    from public.sales_leads lead
    left join public.wholesale_customers customer on customer.id=lead.customer_id
    left join public.sales_lead_assignments assignment on assignment.id=lead.current_assignment_id
    where lead.id='${leadId}';`);
  return JSON.parse(raw) as { lead_id: string; status: string; customer_id: string | null;
    owner: string | null; lead_owner: string; customer_name: string; customer_version: string | null;
    ended_reason: string | null; ended_at: string | null };
}

export function assertSalesLeadCustomerProof(leadId: string) {
  const proof = readSalesLeadCustomerProof(leadId);
  expect(proof.status).toBe("converted");
  expect(proof.customer_id).toEqual(expect.any(String));
  expect(proof.owner).toBe(proof.lead_owner);
  expect(proof.customer_version).toEqual(expect.any(String));
  expect(proof.ended_reason).toBe("converted");
  expect(proof.ended_at).toEqual(expect.any(String));
  return proof;
}

export async function saveOpenLeadAsCustomer(page: Page, leadId: string, note: string) {
  await page.getByRole("dialog").getByRole("button", { name: "添加为客户", exact: true }).click();
  const name = `线索转换回归 ${leadId}`;
  await page.getByTestId("lead-customer-name").fill(name);
  await page.getByTestId("lead-customer-notes").fill(note);
  await expect(page.getByTestId("submit-lead-customer")).toBeEnabled();
  await page.getByTestId("submit-lead-customer").click();
  await expect(page.getByText("客户已保存，线索已成为客户。", { exact: true })).toBeVisible();
  return assertSalesLeadCustomerProof(leadId);
}

/** 只清理本测试明确记录的关联；普通业务入口仍禁止删除有转换记录的客户。 */
export function cleanupSalesLeadConversion(leadId: string) {
  runLocalSupabaseSql(`begin;
    create temporary table conversion_cleanup_customer as select customer_id from public.sales_leads where id='${leadId}';
    update public.sales_leads set status='hall',current_assignee_user_id=null,current_assignment_id=null,
      claimed_at=null,first_contact_at=null,last_contact_at=null,next_follow_up_at=null,expires_at=null,hard_deadline_at=null,
      customer_id=null,converted_at=null,converted_by_user_id=null where id='${leadId}';
    delete from public.wholesale_customers where id in (select customer_id from conversion_cleanup_customer);
    commit;`);
}
