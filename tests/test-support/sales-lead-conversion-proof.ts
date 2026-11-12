export type SalesLeadCustomerProof = {
  lead_id: string; status: string; source_id: string; lead_name: string;
  customer_id: string | null; owner: string | null; lead_owner: string | null;
  assignment_id: string | null; assignment_lead_id: string | null; assignment_owner: string | null;
  customer_name: string | null; customer_version: string | null; customer_revision: number | null;
  customer_kind: string | null; registered_user_id: string | null; customer_creator: string | null;
  customer_notes: string | null; converted_by: string | null; converted_at: string | null;
  ended_by: string | null; ended_reason: string | null; ended_at: string | null; fixture_name_count: number;
};
export type SalesLeadConversionManifest = {
  leadId: string; sourceId: string; leadName: string; ownerId: string; assignmentId: string;
  customerName: string; notes: string; customerId?: string; customerVersion?: string; customerRevision?: number;
};
export type ConvertedSalesLeadCustomerProof=SalesLeadCustomerProof&{
  customer_id: string;owner: string;lead_owner: string;assignment_id: string;
  customer_name: string;customer_version: string;customer_revision: number;
};

export function requireConversionUuid(value: unknown): asserts value is string {
  if(typeof value!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value))
    throw new Error("lead_conversion_invalid_uuid");
}
const validTime=(value: unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value));
const nonempty=(value: unknown)=>typeof value==="string"&&value.trim().length>0;

/** 读回至少证明是所请求的那条线索；缺父行或错ID不能作为“仍未转换”的结果。 */
export function requireSalesLeadProofIdentity(leadId: string,value: unknown): SalesLeadCustomerProof {
  requireConversionUuid(leadId);
  if(!value||typeof value!=="object"||Array.isArray(value)||(value as SalesLeadCustomerProof).lead_id!==leadId)
    throw new Error("lead_conversion_proof_identity_missing");
  return value as SalesLeadCustomerProof;
}

/** 两个NULL不是有效的负责人一致；同时核对客户、周期、真实创建/结束人和可解析时间。 */
export function validateSalesLeadCustomerProof(leadId: string,value: unknown): ConvertedSalesLeadCustomerProof {
  const proof=requireSalesLeadProofIdentity(leadId,value);
  for(const id of [proof.customer_id,proof.owner,proof.lead_owner,proof.assignment_id,proof.assignment_lead_id,
    proof.assignment_owner,proof.customer_creator,proof.converted_by,proof.ended_by])requireConversionUuid(id);
  if(proof.status!=="converted"||proof.owner!==proof.lead_owner||proof.assignment_owner!==proof.lead_owner
    ||proof.assignment_lead_id!==leadId||proof.customer_creator!==proof.converted_by||proof.ended_by!==proof.converted_by
    ||proof.ended_reason!=="converted"||![proof.customer_version,proof.converted_at,proof.ended_at].every(validTime)
    ||!nonempty(proof.customer_name)||proof.customer_kind!=="sales_created"||proof.registered_user_id!==null
    ||!Number.isSafeInteger(proof.customer_revision)||Number(proof.customer_revision)<1)
    throw new Error("lead_conversion_authoritative_proof_invalid");
  return proof as ConvertedSalesLeadCustomerProof;
}

/** 页面写入前登记清单，提交后断网也能按既定ID/周期/名称/备注核对，不能事后猜测归属。 */
export function createSalesLeadConversionManifest(leadId: string,value: unknown,notes: string): SalesLeadConversionManifest {
  const proof=requireSalesLeadProofIdentity(leadId,value);
  requireConversionUuid(proof.lead_owner);requireConversionUuid(proof.assignment_id);
  if(proof.status!=="claimed"||proof.customer_id!==null||!nonempty(proof.source_id)||!nonempty(proof.lead_name)
    ||proof.fixture_name_count!==0||!nonempty(notes))throw new Error("lead_conversion_fixture_not_ready");
  return {leadId,sourceId:proof.source_id,leadName:proof.lead_name,ownerId:proof.lead_owner,
    assignmentId:proof.assignment_id,customerName:`线索转换回归 ${leadId}`,notes:notes.trim()};
}

export function bindSalesLeadConversionManifest(manifest: SalesLeadConversionManifest,value: unknown) {
  const proof=validateSalesLeadCustomerProof(manifest.leadId,value);
  if(proof.customer_name!==manifest.customerName||proof.customer_notes!==manifest.notes
    ||proof.assignment_id!==manifest.assignmentId||proof.lead_owner!==manifest.ownerId)
    throw new Error("lead_conversion_fixture_receipt_mismatch");
  manifest.customerId=proof.customer_id!;manifest.customerVersion=proof.customer_version!;
  manifest.customerRevision=proof.customer_revision!;
  return proof;
}
