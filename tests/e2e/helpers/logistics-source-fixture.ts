import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { readLocalPostgresRows, localSqlValue } from "./local-postgres-query";

/** 只用于本地 Edge 的来源夹具；不能把真实 API 地址或凭证传入此测试。 */
export async function startLogisticsSourceFixture() {
  // 必须在启动 Docker 后、任何夹具写入前核验整库任务暂停；只停某个 job 不足以防外联。
  const [isolation] = readLocalPostgresRows<{ cron_paused: boolean; queue_empty: boolean }>(
    "select current_setting('cron.launch_active_jobs')='off' as cron_paused, not exists(select 1 from net.http_request_queue) as queue_empty",
  );
  if (!isolation?.cron_paused || !isolation.queue_empty) throw new Error("请先暂停本地定时任务并确认 HTTP 队列为空，再运行同步测试。");
  const collisions = readLocalPostgresRows("select 1 from public.wholesale_logistics_records where package_number like 'LOCAL-RETRY-%' or (source_system='dianxiaomi' and observation_bucket=18000)");
  if (collisions.length) throw new Error("本地夹具编号已存在，不能覆盖或清理已有记录。");
  const [originalState] = readLocalPostgresRows<Record<string, unknown>>(
    "select * from public.wholesale_logistics_sync_state where sync_key='dianxiaomi-archive'",
  );
  if (originalState?.is_running) throw new Error("本地已有物流同步，不能覆盖其进度。");
  const originalCheckpoints = readLocalPostgresRows<Record<string, unknown>>("select * from public.wholesale_logistics_checkpoints");
  const [originalSecret] = readLocalPostgresRows<Record<string, unknown>>("select * from public.internal_job_request_secrets where name='wholesale-logistics-sync'");
  const jobs = readLocalPostgresRows<{ jobid: number; active: boolean }>("select jobid,active from cron.job where command like '%wholesale_logistics_sync%' or command like '%dispatch_due_operation_runs%'");
  const operationIds = new Set<string>();
  const calls: { orderId: number; at: number }[] = [];
  let blocked = true;
  const server = createServer(async (request, response) => {
    if (request.url !== "/source" || request.headers["x-logistics-integration-token"] !== "local-fixture") {
      response.writeHead(403).end(); return;
    }
    let text = "";
    for await (const chunk of request) text += chunk;
    const body = JSON.parse(text);
    const orderId = Number(body.cursor.order_id);
    calls.push({ orderId, at: Date.now() });
    if (blocked && orderId >= 9_000_025) {
      response.writeHead(429, { "Content-Type": "application/json", "Retry-After": "120" })
        .end(JSON.stringify({ message: "Rate limit exceeded. Retry after 120000ms." }));
      return;
    }
    const start = orderId >= 9_000_025 ? 26 : 1;
    const rows = Array.from({ length: 25 }, (_, index) => ({
      source_order_id: 9_000_000 + start + index,
      package_number: `LOCAL-RETRY-${start + index}`,
      store_name: "Local Retry Shop", order_created_at: new Date().toISOString(),
      tracking_number: `RETRY-TRACK-${start + index}`, logistics_status: "运输中",
      logistics_provider: "Fixture", has_tracking: true, has_shipping_cost: true,
      shipping_cost: 10, shipping_currency: "USD",
    }));
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
      rows, next_cursor: { ...body.cursor, order_id: 9_000_000 + start + 24 }, has_more: start === 1,
    }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject); server.listen(43194, "0.0.0.0", resolve);
  });
  // 调度入口也限定在本地，防止测试生成的排队任务被本地 cron 发送到线上。
  executeLocalSql(`
    begin;
    ${jobs.map((job) => `select cron.alter_job(job_id:=${job.jobid},active:=false);`).join("\n")}
    delete from public.wholesale_logistics_checkpoints;
    update public.wholesale_logistics_sync_state set is_running=false,locked_until=null,lock_token=null,
      retry_not_before=null,last_successful_at=null,last_order_id=0,last_tracking_id=0,last_shipping_id=0,
      last_tracking_updated_at='1970-01-01Z',last_shipping_updated_at='1970-01-01Z';
    insert into public.internal_job_request_secrets(name,endpoint,shared_secret)
      values ('wholesale-logistics-sync','http://kong:8000/functions/v1/wholesale-logistics-sync','local-job-fixture')
      on conflict(name) do update set endpoint=excluded.endpoint,shared_secret=excluded.shared_secret;
    commit;
  `);
  return {
    calls, operationIds,
    recover: () => { blocked = false; },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      const restoreRow = (table: string, row: Record<string, unknown>) =>
        `insert into ${table} select * from jsonb_populate_record(null::${table},${localSqlValue(JSON.stringify(row))}::jsonb);`;
      executeLocalSql(`begin;
        delete from public.wholesale_logistics_records where package_number like 'LOCAL-RETRY-%';
        delete from public.wholesale_logistics_observations where source_system='dianxiaomi' and observation_bucket=18000;
        delete from public.wholesale_logistics_checkpoints;
        ${originalCheckpoints.map((row) => restoreRow("public.wholesale_logistics_checkpoints", row)).join("\n")}
        delete from public.wholesale_logistics_sync_state where sync_key='dianxiaomi-archive';
        ${restoreRow("public.wholesale_logistics_sync_state", originalState)}
        delete from public.internal_job_request_secrets where name='wholesale-logistics-sync';
        ${originalSecret ? restoreRow("public.internal_job_request_secrets", originalSecret) : ""}
        ${Array.from(operationIds).map((id) => `delete from private.operation_runs where id=${localSqlValue(id)}::uuid;`).join("\n")}
        ${jobs.map((job) => `select cron.alter_job(job_id:=${job.jobid},active:=${job.active});`).join("\n")}
        commit;`);
    },
  };
}

/** 每次修改前走独立查询的本地地址保护；SQL 从 stdin 传入，不经 shell 插值。 */
export function executeLocalSql(sql: string) {
  readLocalPostgresRows("select 1");
  execFileSync("docker", ["exec", "-i", "supabase_db_pt5-dropshipping", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] });
}
