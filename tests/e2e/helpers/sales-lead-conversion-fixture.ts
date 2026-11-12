import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { runLocalSupabaseSql } from "./local-supabase";
import { readLocalPostgresRows, localSqlValue as quote } from "./local-postgres-query";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import { readLocalSalesLeadCustomerProof, cleanupLocalSalesLeadConversion } from "../../test-support/sales-lead-conversion-store";
import { createSalesLeadConversionManifest, bindSalesLeadConversionManifest, requireConversionUuid,
  type SalesLeadConversionManifest, type SalesLeadCustomerProof } from "../../test-support/sales-lead-conversion-proof";
import { buildLearningLeadWriteSql, buildLearningLeadReadSql, verifyLearningLeadReceipt } from "../../../../PT5-dropshipping-supabase/scripts/learning-lead-fixture-sql.mjs";

export type ConversionLead = { id: string; name: string; manifest?: SalesLeadConversionManifest;
  edit?: { before: SalesLeadCustomerProof; notes: string };
  ownerFault?: { from: string; to: string; proof: SalesLeadCustomerProof } };
type Actor = { user_id: string; name: string };
export type ConversionFixture = {
  actor: Actor; create: () => ConversionLead; otherSalesman: () => string; administrator: () => string;
  confirm: (lead: ConversionLead) => ReturnType<typeof bindSalesLeadConversionManifest>;
  beginNotesEdit: (lead: ConversionLead, notes: string) => void;
  confirmNotesEdit: (lead: ConversionLead) => void;
  replaceOwner: (lead: ConversionLead, from: string, to: string) => void;
};

/** 写执行器逐次核验专属环境；另连接读回身份和影响数，创建失败也保留预登记ID供收尾。 */
function writeOwnedLead(action: "create" | "cleanup", id: string) {
  const output = runLocalSupabaseSql(buildLearningLeadWriteSql(action, id));
  const receipts = output.split(/\r?\n/).filter(line => line.startsWith("WRITE_RECEIPT "));
  if (receipts.length !== 1) throw new Error("conversion_fixture_write_receipt_missing");
  return verifyLearningLeadReceipt(action, JSON.parse(runLocalSupabaseSql(buildLearningLeadReadSql(id))),
    JSON.parse(receipts[0].slice("WRITE_RECEIPT ".length)).affected);
}

function manifestOf(lead: ConversionLead) {
  if (!lead.manifest) throw new Error("conversion_fixture_manifest_missing");
  return lead.manifest;
}

/** 只接收页面提交前登记的备注修改；其余完整凭证保持，修订必须恰好增加一次。 */
export function acceptExpectedConversionEdit(lead: ConversionLead, after: SalesLeadCustomerProof) {
  const manifest = manifestOf(lead), edit = lead.edit;
  if (!edit) throw new Error("conversion_fixture_edit_not_registered");
  const expected = { ...edit.before, customer_notes: edit.notes, customer_revision: Number(edit.before.customer_revision) + 1,
    customer_version: after.customer_version };
  expect(after).toEqual(expected);
  expect(after.customer_version).not.toBe(edit.before.customer_version);
  // 通过完整独立凭证后才更新可清理的基线，不能把任意数据库新值直接收编为自有数据。
  const next = { ...manifest, notes: edit.notes };
  bindSalesLeadConversionManifest(next, after);
  Object.assign(manifest, next);
  delete lead.edit;
}

/** 本夹具不创建账号。实际登录后传入邮箱，再独立核对专属活动身份及上海当日剩余额度。 */
export async function withSalesLeadConversionFixture(page: Page, email: string, run: (fixture: ConversionFixture) => Promise<void>) {
  const leads: ConversionLead[] = [], errors: unknown[] = [];
  try {
    const actors = readLocalPostgresRows<Actor>(`select user_id,coalesce(name,email,'业务员') as name from public.user_profiles
      where email=${quote(email)} and status='active'`);
    expect(actors).toHaveLength(1);
    const actor = actors[0];
    requireConversionUuid(actor.user_id);
    const confirm = (lead: ConversionLead) => {
      const manifest = manifestOf(lead), proof = readLocalSalesLeadCustomerProof(lead.id);
      if (manifest.customerId) {
        expect(proof.customer_id).toBe(manifest.customerId);
        expect(proof.customer_version).toBe(manifest.customerVersion);
        expect(proof.customer_revision).toBe(manifest.customerRevision);
      }
      return bindSalesLeadConversionManifest(manifest, proof);
    };
    const fixture: ConversionFixture = {
      actor,
      create: () => {
        const lead: ConversionLead = { id: randomUUID(), name: "" };
        leads.push(lead);
        lead.name = writeOwnedLead("create", lead.id).lead.name;
        const counts = readLocalPostgresRows<{ count: number }>(`select count(*)::integer as count from public.sales_lead_assignments
          where assignee_user_id=${quote(actor.user_id)} and claimed_at >= (date_trunc('day',now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
          and claimed_at < ((date_trunc('day',now() at time zone 'Asia/Shanghai')+interval '1 day') at time zone 'Asia/Shanghai')`);
        expect(counts).toHaveLength(1);
        expect(counts[0].count, "专属身份当天额度不足，请修复夹具准备，不能挪动历史日期").toBeLessThan(5);
        const updated = runLocalSupabaseSql(`update public.sales_leads set email=${quote(`${lead.id}@example.test`)},
          phone='+44 7000 0000 01',whatsapp='+44 7000 0000 02',website_url=${quote(`https://homepage.example.test/${lead.id}`)},
          public_contact='https://example.test/contact',community_url='https://example.test/community'
          where id=${quote(lead.id)} and primary_source_lead_id=${quote(`PT5-LEARNING-${lead.id}`)} returning id;`);
        expect(updated).toBe(lead.id);
        // 领取仅准备转换前提，仍调用真实岗位规则；转换关键操作由原页面发起。
        runLocalSupabaseSql(`begin;set local request.jwt.claim.sub=${quote(actor.user_id)};set local role authenticated;
          select public.claim_sales_lead(${quote(lead.id)});commit;`);
        const proof = readLocalSalesLeadCustomerProof(lead.id);
        expect(proof).toMatchObject({ status: "claimed", lead_owner: actor.user_id, customer_id: null, ended_at: null });
        lead.manifest = createSalesLeadConversionManifest(lead.id, proof, `转换测试备注 ${lead.id}`);
        return lead;
      },
      otherSalesman: () => {
        const rows = readLocalPostgresRows<{ user_id: string }>(`select p.user_id from public.user_profiles p
          join public.user_roles_data d on d.user_id=p.user_id join public.user_roles r on r.id=d.role_id
          join public.user_workspace_business_access a on a.user_id=p.user_id and a.business_key='wholesale' and a.is_enabled
          where p.status='active' and r.role='salesman' and p.user_id<>${quote(actor.user_id)} order by p.user_id limit 1`);
        expect(rows).toHaveLength(1);
        requireConversionUuid(rows[0].user_id);
        return rows[0].user_id;
      },
      administrator: () => {
        const rows = readLocalPostgresRows<{ user_id: string }>(`select p.user_id from public.user_profiles p
          join public.user_roles_data d on d.user_id=p.user_id join public.user_roles r on r.id=d.role_id
          where p.status='active' and r.role='administrator' order by p.user_id limit 1`);
        expect(rows).toHaveLength(1);
        requireConversionUuid(rows[0].user_id);
        return rows[0].user_id;
      },
      confirm,
      beginNotesEdit: (lead, notes) => {
        if (!notes.trim() || lead.edit) throw new Error("conversion_fixture_edit_invalid");
        lead.edit = { before: { ...confirm(lead) }, notes };
      },
      confirmNotesEdit: lead => acceptExpectedConversionEdit(lead, readLocalSalesLeadCustomerProof(lead.id)),
      replaceOwner: (lead, from, to) => {
        requireConversionUuid(from); requireConversionUuid(to);
        const manifest = manifestOf(lead), before = readLocalSalesLeadCustomerProof(lead.id);
        // 故障注入也只改清单已登记的客户及当前精确版本；不根据页面响应中的任意编号更新。
        expect(before.customer_id).toBe(manifest.customerId);
        expect(before.owner).toBe(from);
        if (from === manifest.ownerId) {
          if (lead.ownerFault) throw new Error("conversion_fixture_owner_fault_pending");
          confirm(lead);
        } else {
          // 恢复只接受本次刚注入的完整版本；期间其他字段变化时先停下，不能覆盖他人维护。
          if (!lead.ownerFault || lead.ownerFault.from !== to || lead.ownerFault.to !== from)
            throw new Error("conversion_fixture_owner_fault_not_registered");
          expect(before).toEqual(lead.ownerFault.proof);
        }
        // 故障写入仍经过实际管理员权限和保护触发器，不禁用业务约束。
        const updated = runLocalSupabaseSql(`begin;set local request.jwt.claim.sub=${quote(fixture.administrator())};
          update public.wholesale_customers set assigned_sales_user_id=${quote(to)}
          where id=${quote(manifest.customerId!)} and unique_name=${quote(manifest.customerName)} and notes=${quote(manifest.notes)}
          and assigned_sales_user_id=${quote(from)} and edit_revision=${before.customer_revision}
          and updated_at=${quote(before.customer_version!)}::timestamptz returning id;commit;`);
        expect(updated).toBe(manifest.customerId);
        const after = readLocalSalesLeadCustomerProof(lead.id);
        expect(after).toEqual({ ...before, owner: to, customer_revision: Number(before.customer_revision) + 1, customer_version: after.customer_version });
        expect(after.customer_version).not.toBe(before.customer_version);
        // 恢复原负责人且完整凭证有效时才能接纳可清理版本；中途失败则保留样例供独立排查。
        if (to === manifest.ownerId) {
          bindSalesLeadConversionManifest(manifest, after);
          delete lead.ownerFault;
        } else lead.ownerFault = { from, to, proof: { ...after } };
      },
    };
    await run(fixture);
  } catch (error) { errors.push(error); }
  try {
    await cleanupFixtureResources(
      async () => { await page.unrouteAll({ behavior: "wait" }); },
      async () => { await page.close(); },
      ...leads.slice().reverse().flatMap(lead => [
        async () => { if (lead.manifest) return cleanupLocalSalesLeadConversion(lead.manifest); },
        async () => writeOwnedLead("cleanup", lead.id),
      ]),
    );
  } catch (error) { errors.push(...(error instanceof AggregateError ? error.errors : [error])); }
  if (errors.length) throw new AggregateError(errors, `线索转换验证未完成，本次编号 ${leads.map(lead => lead.id).join(",")}`);
}
