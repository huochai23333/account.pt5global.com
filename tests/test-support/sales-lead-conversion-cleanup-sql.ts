import { requireConversionUuid, type SalesLeadConversionManifest } from "./sales-lead-conversion-proof.ts";

const quote=(text: string)=>"'"+text.replaceAll("'","''")+"'";
export function buildSalesLeadProofSql(leadId: string) {
  requireConversionUuid(leadId);
  return `select jsonb_build_object('lead_id',lead.id,'status',lead.status,'source_id',lead.primary_source_lead_id,'lead_name',lead.name,
    'customer_id',customer.id,'owner',customer.assigned_sales_user_id,'lead_owner',lead.current_assignee_user_id,
    'assignment_id',assignment.id,'assignment_lead_id',assignment.lead_id,'assignment_owner',assignment.assignee_user_id,
    'customer_name',customer.unique_name,'customer_version',customer.updated_at,'customer_revision',customer.edit_revision,
    'customer_kind',customer.customer_kind,'registered_user_id',customer.registered_user_id,'customer_creator',customer.created_by_user_id,
    'customer_notes',customer.notes,'converted_by',lead.converted_by_user_id,'converted_at',lead.converted_at,
    'ended_by',assignment.ended_by_user_id,'ended_reason',assignment.ended_reason,'ended_at',assignment.ended_at,
    'fixture_name_count',(select count(*) from public.wholesale_customers where unique_name=${quote(`线索转换回归 ${leadId}`)}))
    from public.sales_leads lead left join public.wholesale_customers customer on customer.id=lead.customer_id
    left join public.sales_lead_assignments assignment on assignment.id=lead.current_assignment_id where lead.id='${leadId}';`;
}
function validateManifest(manifest: SalesLeadConversionManifest) {
  if(!manifest||typeof manifest!=="object")throw new Error("lead_conversion_cleanup_manifest_missing");
  for(const id of [manifest.leadId,manifest.ownerId,manifest.assignmentId])requireConversionUuid(id);
  if(manifest.customerId)requireConversionUuid(manifest.customerId);
  if(![manifest.sourceId,manifest.leadName,manifest.notes].every(text=>typeof text==="string"&&text.trim())
    ||manifest.customerName!==`线索转换回归 ${manifest.leadId}`
    ||(manifest.customerRevision!==undefined&&(!Number.isSafeInteger(manifest.customerRevision)||manifest.customerRevision<1)))
    throw new Error("lead_conversion_cleanup_manifest_invalid");
}

/** 只解除页面已登记的转换；锁父行后再锁客户，原子删除失败时保留原关联和历史。 */
export function buildSalesLeadConversionCleanupSql(manifest: SalesLeadConversionManifest) {
  validateManifest(manifest);
  const id=quote(manifest.leadId),name=quote(manifest.customerName);
  // 资料可能含美元标签；单引号转义不能保护DO外层，选一个没有出现在本次数据中的标签。
  let suffix=0;
  while(JSON.stringify(manifest).includes(`$pt5_conversion_${suffix}$`))suffix++;
  const tag=`$pt5_conversion_${suffix}$`;
  return `begin;
set local statement_timeout='12s';set local lock_timeout='10s';set local standard_conforming_strings=on;
do ${tag} declare lead public.sales_leads%rowtype;customer public.wholesale_customers%rowtype;
  affected integer;removed integer:=0;reset_count integer:=0;cleanup_customer_id uuid:=null;begin
  select * into lead from public.sales_leads where id=${id} for update;
  if not found then raise exception 'lead_conversion_cleanup_lead_missing';end if;
  if lead.primary_source_lead_id is distinct from ${quote(manifest.sourceId)} or lead.name is distinct from ${quote(manifest.leadName)}
    then raise exception 'lead_conversion_cleanup_lead_ownership_changed';end if;
  if lead.customer_id is null then
    -- 没有转换不擅自退回已有认领；已回收的重试仍检查已登记客户和专属名称均不残留。
    if lead.status not in ('hall','claimed') or exists(select 1 from public.wholesale_customers where unique_name=${name}
      ${manifest.customerId?`or id=${quote(manifest.customerId)}::uuid`:''}) then raise exception 'lead_conversion_cleanup_customer_unlinked';end if;
    cleanup_customer_id:=${manifest.customerId?quote(manifest.customerId)+'::uuid':'null'};
  else
    if lead.status is distinct from 'converted' or lead.current_assignee_user_id is distinct from ${quote(manifest.ownerId)}::uuid
      or lead.current_assignment_id is distinct from ${quote(manifest.assignmentId)}::uuid
      ${manifest.customerId?`or lead.customer_id is distinct from ${quote(manifest.customerId)}::uuid`:''}
      then raise exception 'lead_conversion_cleanup_assignment_changed';end if;
    select * into customer from public.wholesale_customers where id=lead.customer_id for update;
    if not found or customer.unique_name is distinct from ${name} or customer.notes is distinct from ${quote(manifest.notes)}
      or customer.customer_kind is distinct from 'sales_created' or customer.registered_user_id is not null
      or customer.assigned_sales_user_id is distinct from ${quote(manifest.ownerId)}::uuid
      or customer.created_by_user_id is distinct from lead.converted_by_user_id
      or customer.edit_revision is distinct from ${manifest.customerRevision??1}
      ${manifest.customerVersion?`or customer.updated_at is distinct from ${quote(manifest.customerVersion)}::timestamptz`:''}
      then raise exception 'lead_conversion_cleanup_customer_ownership_changed';end if;
    if not exists(select 1 from public.sales_lead_assignments where id=lead.current_assignment_id and lead_id=lead.id
      and assignee_user_id=lead.current_assignee_user_id and ended_reason='converted' and ended_at is not null
      and ended_by_user_id=lead.converted_by_user_id) then raise exception 'lead_conversion_cleanup_assignment_unconfirmed';end if;
    cleanup_customer_id:=customer.id;
    update public.sales_leads set status='hall',current_assignee_user_id=null,current_assignment_id=null,
      claimed_at=null,first_contact_at=null,last_contact_at=null,next_follow_up_at=null,expires_at=null,hard_deadline_at=null,
      customer_id=null,converted_at=null,converted_by_user_id=null where id=lead.id and customer_id=customer.id;
    get diagnostics affected=row_count;if affected<>1 then raise exception 'lead_conversion_cleanup_reset_unconfirmed';end if;reset_count:=affected;
    delete from public.wholesale_customers where id=customer.id and edit_revision=customer.edit_revision;
    get diagnostics affected=row_count;if affected<>1 then raise exception 'lead_conversion_cleanup_delete_unconfirmed';end if;removed:=affected;
    if exists(select 1 from public.wholesale_customers where id=customer.id or unique_name=${name})
      or not exists(select 1 from public.sales_leads where id=lead.id and status='hall' and customer_id is null
        and current_assignment_id is null and current_assignee_user_id is null)
      then raise exception 'lead_conversion_cleanup_final_unconfirmed';end if;
  end if;
  perform set_config('pt5.fixture.conversion_receipt',jsonb_build_object('leadId',lead.id,'customerId',cleanup_customer_id,'deleted',removed,'reset',reset_count)::text,true);
end ${tag};
select current_setting('pt5.fixture.conversion_receipt');
commit;`;
}

export function buildSalesLeadConversionReadbackSql(manifest: SalesLeadConversionManifest,customerId: string | null) {
  validateManifest(manifest);if(customerId!==null)requireConversionUuid(customerId);
  return `select jsonb_build_object('lead',(select jsonb_build_object('id',id,'source',primary_source_lead_id,'name',name,'status',status,'customerId',customer_id) from public.sales_leads where id=${quote(manifest.leadId)}),
    'customers',(select count(*) from public.wholesale_customers where unique_name=${quote(manifest.customerName)}${customerId?` or id=${quote(customerId)}::uuid`:''}));`;
}
