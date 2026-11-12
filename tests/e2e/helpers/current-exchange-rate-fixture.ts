import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { runLocalSupabaseSql } from "./local-supabase";
import { localSqlValue as quote } from "./local-postgres-query";

type QuoteRow = Record<string, unknown> & { id: string; rate_date: string };
export type QuoteFixture = {
  id: string;
  date: string;
  source: "manual" | "nowapi";
  dayFinal: boolean;
  rate: number;
  attempted: boolean;
  before?: QuoteRow;
  proof?: QuoteRow;
  cleaned?: boolean;
};

/** 夹具约定最多六位小数，保证固定样本的整数期望一致；数据库原始报价保留其实际精度。 */
function quoteRateValues(rate: number) {
  assert(
    Number.isFinite(rate) && rate > 0 && Number(rate.toFixed(6)) === rate,
    "quote_fixture_rate_invalid",
  );
  return {
    daily_exchange_rate: rate,
    bank_quote: Number((rate * 100).toFixed(6)),
  };
}

/** 本地失败边界：检查主进程和函数专属环境均无供应商凭据，实际provider会在fetch之前失败。 */
export function assertQuoteProviderUnavailable() {
  const readRuntimeJson = (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("quote_provider_config_unreadable");
    }
  };
  // 先由共用端口确认完整专属API/DB身份，不能仅凭一个环境变量判断项目归属。
  runLocalSupabaseSql("select 1;");
  const project = process.env.PT5_E2E_DATABASE_PROJECT;
  assert(
    project && /^pt5-(?:e2e|learning)-[a-z0-9][a-z0-9_-]*$/.test(project),
    "quote_provider_requires_disposable_project",
  );
  const [runtime] = readRuntimeJson(
    execFileSync("docker", ["inspect", `supabase_edge_runtime_${project}`], {
      encoding: "utf8",
      timeout: 12000,
      windowsHide: true,
    }),
  );
  assert(
    runtime?.State?.Running &&
      runtime.Config?.Labels?.["com.supabase.cli.project"] === project,
    "quote_provider_runtime_mismatch",
  );
  const values = Object.fromEntries(
    (runtime.Config.Env as string[]).map((value) => {
      const at = value.indexOf("=");
      return [value.slice(0, at), value.slice(at + 1)];
    }),
  );
  // JSON异常可能包含环境原文片段，统一固定错误，避免在测试日志泄露配置内容。
  const config = readRuntimeJson(
    values.SUPABASE_INTERNAL_FUNCTIONS_CONFIG ?? "{}",
  );
  assert(
    config["exchange-rate-sync"],
    "quote_provider_function_config_missing",
  );
  // CLI主服务把两份环境合并给用户worker；只检查，不修改，也不输出任何值。
  const worker = { ...values, ...(config["exchange-rate-sync"].env ?? {}) };
  assert(
    !worker.NOWAPI_APP_KEY && !worker.NOWAPI_SIGN,
    "quote_provider_credentials_present",
  );
}
/** 只登记明确USD/CNY日期和本次随机编号；专属SQL端口每次核验真实项目和off/0/0。 */
export function createQuoteFixture(
  date: string,
  historical = false,
  rate = 7,
): QuoteFixture {
  quoteRateValues(rate);
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      new Date(date).toISOString().slice(0, 10) === date,
    "quote_fixture_date_invalid",
  );
  return {
    id: randomUUID(),
    date,
    source: historical ? "nowapi" : "manual",
    dayFinal: historical,
    rate,
    attempted: false,
  };
}
export function readQuoteFixture(date: string): QuoteRow | null {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date), "quote_fixture_date_invalid");
  return JSON.parse(
    runLocalSupabaseSql(`select coalesce((select to_jsonb(r)||jsonb_build_object('_xmin',xmin::text)
    from public.exchange_rate r where original_currency='USD' and target_currency='CNY' and rate_date=${quote(date)}::date),'null'::jsonb);`),
  );
}

function readQuoteId(id: string): QuoteRow | null {
  assert(/^[a-f0-9-]{36}$/i.test(id), "quote_fixture_id_invalid");
  return JSON.parse(
    runLocalSupabaseSql(`select coalesce((select to_jsonb(r)||jsonb_build_object('_xmin',xmin::text)
    from public.exchange_rate r where id=${quote(id)}::uuid),'null'::jsonb);`),
  );
}
function bindInitial(state: QuoteFixture, row: QuoteRow) {
  const expected = {
    id: state.id,
    original_currency: "USD",
    target_currency: "CNY",
    ...quoteRateValues(state.rate),
    rate_date: state.date,
    source: state.source,
    provider_rate_date: state.date,
    bank_code: "BOC",
    quote_type: "spot_buy",
    is_day_final: state.dayFinal,
    created_at: row.created_at,
    fetched_at: row.fetched_at,
    provider_updated_at: row.provider_updated_at,
    _xmin: row._xmin,
  };
  assert.deepEqual(row, expected, "quote_fixture_initial_changed");
  assert.equal(
    Date.parse(String(row.provider_updated_at)),
    Date.parse(state.date + "T00:01:00+08:00"),
  );
  assert(
    typeof row._xmin === "string" && /^\d+$/.test(row._xmin),
    "quote_fixture_version_missing",
  );
  for (const field of ["created_at", "fetched_at"] as const)
    assert(
      Number.isFinite(Date.parse(String(row[field]))),
      "quote_fixture_time_missing",
    );
  state.proof = row;
}
/** 不存在才插入；已有记录不改值、不抢归属，历史场景另要求它是可复用日末记录。 */
export function prepareQuoteFixture(state: QuoteFixture) {
  const values = quoteRateValues(state.rate);
  assert(!state.attempted && !state.before, "quote_fixture_prepare_repeated");
  const before = readQuoteFixture(state.date);
  if (before) {
    state.before = before;
    return before;
  }
  assert.equal(readQuoteId(state.id), null, "quote_fixture_preexisting_id");
  state.attempted = true;
  const result = JSON.parse(
    runLocalSupabaseSql(`insert into public.exchange_rate(id,original_currency,target_currency,daily_exchange_rate,
    rate_date,source,bank_quote,bank_code,quote_type,provider_updated_at,provider_rate_date,is_day_final,fetched_at)
    values(${quote(state.id)}::uuid,'USD','CNY',${values.daily_exchange_rate},${quote(state.date)}::date,${quote(state.source)},${values.bank_quote},'BOC','spot_buy',
      ${quote(state.date + "T00:01:00+08:00")}::timestamptz,${quote(state.date)}::date,${state.dayFinal},now())
    returning to_jsonb(exchange_rate)||jsonb_build_object('_xmin',xmin::text);`),
  );
  bindInitial(state, result);
  assert.deepEqual(
    readQuoteFixture(state.date),
    state.proof,
    "quote_fixture_prepare_readback_changed",
  );
  return result as QuoteRow;
}
/** 删除前锁行再比完整内容/xmin；同值新版本也拒绝，实际外键继续保护已有业务引用。 */
export function cleanupQuoteFixture(state: QuoteFixture) {
  const current = readQuoteFixture(state.date);
  if (state.before) {
    assert.deepEqual(current, state.before, "quote_fixture_existing_changed");
    return { deleted: 0 };
  }
  const byId = readQuoteId(state.id);
  if (state.cleaned) {
    assert.equal(current, null, "quote_fixture_reappeared");
    assert.equal(byId, null, "quote_fixture_id_reappeared");
    return { deleted: 0 };
  }
  if (!state.attempted) {
    assert.equal(byId, null, "quote_fixture_unattempted_row");
    return { deleted: 0 };
  }
  if (!current) {
    assert.equal(byId, null, "quote_fixture_date_changed");
    assert(!state.proof, "quote_fixture_missing_since_confirm");
    return { deleted: 0 };
  }
  assert.deepEqual(byId, current, "quote_fixture_identity_changed");
  // 单行报价没有客户档案那样的同事务版本锚点；插入回执丢失时不能猜测当前版本仍属于本次写入。
  assert(state.proof, "quote_fixture_insert_unconfirmed");
  assert.deepEqual(current, state.proof, "quote_fixture_cleanup_scope_changed");
  const receipt = JSON.parse(
    runLocalSupabaseSql(`begin;set local standard_conforming_strings=on;
    create temp table quote_fixture_input(data jsonb);insert into quote_fixture_input values(${quote(JSON.stringify(state.proof))}::jsonb);
    create temp table quote_fixture_receipt(data jsonb);
    do $quote_cleanup$declare expected jsonb;actual jsonb;affected integer;ref record;referenced boolean;begin
      select data into expected from quote_fixture_input;
      select to_jsonb(r)||jsonb_build_object('_xmin',xmin::text) into actual from public.exchange_rate r where id=(expected->>'id')::uuid for update;
      if actual is distinct from expected then raise exception 'quote_fixture_locked_scope_changed';end if;
      -- SET NULL外键也属于业务引用；先锁父行阻止新增引用，再拒绝任何现有引用，不能让删除隐式改写别的记录。
      for ref in select c.conrelid,a.attname,array_length(c.conkey,1)as key_count
        from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
        where c.contype='f'and c.confrelid='public.exchange_rate'::regclass loop
        if ref.key_count<>1 then raise exception 'quote_fixture_unsupported_reference';end if;
        execute format('select exists(select 1 from %s where %I=$1)',ref.conrelid::regclass,ref.attname)
          into referenced using(expected->>'id')::uuid;
        if referenced then raise exception 'quote_fixture_referenced';end if;
      end loop;
      delete from public.exchange_rate where id=(expected->>'id')::uuid and xmin::text=expected->>'_xmin';
      get diagnostics affected=row_count;if affected<>1 then raise exception 'quote_fixture_cleanup_zero';end if;
      insert into quote_fixture_receipt values(jsonb_build_object('id',expected->>'id','deleted',affected));
    end $quote_cleanup$;commit;select data from quote_fixture_receipt;`),
  );
  assert(
    receipt?.id === state.id && receipt.deleted === 1,
    "quote_fixture_cleanup_receipt_invalid",
  );
  assert.equal(
    readQuoteFixture(state.date),
    null,
    "quote_fixture_cleanup_readback_failed",
  );
  state.cleaned = true;
  return { deleted: 1 };
}
/** 当前报价夹具仍返回异步清理函数；它准备数据，不替代浏览器或后台的认证。 */
export async function prepareCurrentExchangeRateFixture() {
  const date = runLocalSupabaseSql(
    "select public.current_exchange_rate_date()::text;",
  );
  const state = createQuoteFixture(date);
  try {
    prepareQuoteFixture(state);
  } catch (error) {
    try {
      cleanupQuoteFixture(state);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "quote_fixture_prepare_and_cleanup_failed",
      );
    }
    throw error;
  }
  return async () => {
    cleanupQuoteFixture(state);
  };
}
