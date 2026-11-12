import { spawn } from "node:child_process";
import { executeLearningSql } from "../../scripts/learning/local-fixture-session.mjs";

export function holdCustomerUploadProfile(actorId: string, customerId: string) {
  const applicationName = `learning-upload-${customerId}`;
  const child = spawn("docker", [
    "exec", "-i", "supabase_db_pt5-dropshipping", "psql", "-XAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
  ], { timeout: 38_000 });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.on("error", (error) => { stderr += error.message; });
  const completion = new Promise<{ committed: boolean; error: string }>((resolve) => {
    child.once("error", (error) => resolve({ committed: false, error: error.message }));
    child.once("close", (code) => resolve({ committed: code === 0 && stdout.trim().endsWith("COMMIT"), error: stderr.trim() }));
  });
  // 上传登记先持有目录锁，再等待上传者外键。这里只锁本次专属账号资料，退出或超时自动释放。
  child.stdin.write(`begin;
    set local idle_in_transaction_session_timeout = '35s';
    set local application_name = '${applicationName}';
    select user_id from public.user_profiles where user_id='${actorId}' for update;\n`);

  return {
    isReady: () => executeLearningSql(`select exists(select 1 from pg_stat_activity
      where application_name='${applicationName}' and state='idle in transaction' and query like '%for update%');`) === "t",
    blocked: (expectDeletion: boolean) => executeLearningSql(`select exists(
      select 1 from pg_stat_activity holder cross join pg_stat_activity upload
      where holder.application_name='${applicationName}' and upload.query like '%document_library_command%'
        and holder.pid=any(pg_blocking_pids(upload.pid))
        ${expectDeletion ? "and exists(select 1 from pg_stat_activity deletion where deletion.query like '%delete_wholesale_customer%' and upload.pid=any(pg_blocking_pids(deletion.pid)))" : ""}
    );`) === "t",
    async release() {
      if (!child.stdin.writableEnded) child.stdin.end("commit;\n");
      return completion;
    },
  };
}
