import { execFileSync } from "node:child_process";
import { readDisposablePostgresTarget } from "./disposable-fixture.ts";
import { requireConversionUuid, requireSalesLeadProofIdentity, type SalesLeadConversionManifest } from "./sales-lead-conversion-proof.ts";
import { buildSalesLeadProofSql, buildSalesLeadConversionCleanupSql, buildSalesLeadConversionReadbackSql } from "./sales-lead-conversion-cleanup-sql.ts";

export type ConversionCommandRunner=(args: string[],input?: string)=>string;
const defaultRun: ConversionCommandRunner=(args,input)=>execFileSync("docker",args,{input,encoding:"utf8",timeout:15000,maxBuffer:8*1024*1024,stdio:["pipe","pipe","pipe"]}).trim();

/** 每次读取/清理都核对真实DB/Kong/API归属及off/0/0；不读取原受限管理员或账号辅助文件。 */
function conversionConnection(run: ConversionCommandRunner) {
  const boundary={baseURL:process.env.PLAYWRIGHT_BASE_URL,supabaseURL:process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode:process.env.PT5_E2E_FIXTURE_MODE,project:process.env.PT5_E2E_DATABASE_PROJECT,container:process.env.PT5_E2E_DATABASE_CONTAINER};
  const verify=()=>readDisposablePostgresTarget(boundary,args=>run(args));
  const container=verify();
  return {verify,container,sql:(input: string)=>run(["exec","-i","-e","PGOPTIONS=-c statement_timeout=12000 -c lock_timeout=10000",
    container,"psql","-U","postgres","-d","postgres","-X","-qAt","-v","ON_ERROR_STOP=1"],input)};
}
export function readLocalSalesLeadCustomerProof(leadId: string,run: ConversionCommandRunner=defaultRun) {
  requireConversionUuid(leadId);
  const connection=conversionConnection(run);
  return requireSalesLeadProofIdentity(leadId,JSON.parse(connection.sql(buildSalesLeadProofSql(leadId))));
}

/** COMMIT成功还不够；另开连接核对父行与精确客户编号/专属名称，不以零删除冒称已删除。 */
export function cleanupLocalSalesLeadConversion(manifest: SalesLeadConversionManifest,run: ConversionCommandRunner=defaultRun) {
  const input=buildSalesLeadConversionCleanupSql(manifest),connection=conversionConnection(run);
  const receipt=JSON.parse(connection.sql(input)) as {leadId?: unknown;customerId?: unknown;deleted?: unknown;reset?: unknown};
  if(receipt?.leadId!==manifest.leadId||![0,1].includes(receipt.deleted as number)||receipt.reset!==receipt.deleted
    ||(receipt.customerId!==null&&typeof receipt.customerId!=="string"))throw new Error("lead_conversion_cleanup_receipt_invalid");
  if(receipt.customerId!==null)requireConversionUuid(receipt.customerId);
  if(receipt.deleted===1&&receipt.customerId===null)throw new Error("lead_conversion_cleanup_receipt_invalid");
  if(manifest.customerId&&receipt.customerId!==manifest.customerId)throw new Error("lead_conversion_cleanup_receipt_customer_changed");
  if(connection.verify()!==connection.container)throw new Error("lead_conversion_cleanup_target_changed");
  const remaining=JSON.parse(connection.sql(buildSalesLeadConversionReadbackSql(manifest,receipt.customerId as string|null)));
  if(remaining?.customers!==0||remaining.lead?.id!==manifest.leadId||remaining.lead.source!==manifest.sourceId
    ||remaining.lead.name!==manifest.leadName||remaining.lead.customerId!==null
    ||!(receipt.deleted===1?["hall"]:["hall","claimed"]).includes(remaining.lead.status))
    throw new Error("lead_conversion_cleanup_readback_failed");
  return receipt;
}
