import { spawn } from "node:child_process";

import { executeLearningSql } from "../../scripts/learning/local-fixture-session.mjs";

export function startCompetingCustomerDelete(customerId: string, actorId: string) {
  const applicationName = `learning-delete-${customerId}`;
  // 先完成竞争请求的删除，再保持事务，直到页面请求真的等待这一行。超时会回滚本次夹具。
  const sql = `begin;
    set local application_name = '${applicationName}';
    set local statement_timeout = '12s';
    set local role authenticated;
    set local "request.jwt.claim.sub" = '${actorId}';
    select public.delete_wholesale_customer('${customerId}');
    reset role;
    do $wait_for_page$ begin
      loop
        perform pg_stat_clear_snapshot();
        exit when exists(select 1 from pg_stat_activity
          where query like '%delete_wholesale_customer%'
            and pg_backend_pid() = any(pg_blocking_pids(pid)));
        perform pg_sleep(0.05);
      end loop;
    end $wait_for_page$;
    commit;`;

  const completion = new Promise<{ committed: boolean; error: string }>((resolve) => {
    const child = spawn("docker", [
      "exec", "-i", "supabase_db_pt5-dropshipping", "psql", "-XAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
    ], { timeout: 17_000 });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdin.on("error", (error) => { stderr += error.message; });
    child.once("error", (error) => resolve({ committed: false, error: error.message }));
    child.once("close", (code) => resolve({ committed: code === 0 && stdout.trim().endsWith("COMMIT"), error: stderr.trim() }));
    child.stdin.end(sql);
  });

  return {
    completion,
    isWaitingForPage: () => executeLearningSql(`select exists(select 1 from pg_stat_activity
      where application_name='${applicationName}' and query like 'do $wait_for_page$%');`) === "t",
  };
}
