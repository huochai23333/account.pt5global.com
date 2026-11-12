import { createHash } from "node:crypto";
import { isDeepStrictEqual as same } from "node:util";

type Row = Record<string, unknown> & { id: string | number; _xmin: string };
const tables = {
  rates: "public.exchange_rate",
  runs: "private.operation_runs",
  attempts: "private.operation_attempts",
  alerts: "private.system_health_alerts",
  transport: "net._http_response",
  verifications: "public.boc_quote_verifications",
} as const;
type Graph = Record<keyof typeof tables, Row[]>;
type OperationReceipt = { payload: Record<string, unknown>; status: string };
const names = Object.keys(tables) as (keyof Graph)[];
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const expression =
  "jsonb_build_object(" +
  names
    .map(
      (key) =>
        `'${key}',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('_xmin',t.xmin::text) order by t.id),'[]') from ${tables[key]} t)`,
    )
    .join(",") +
  ")";

/** 整套仅接纳实际函数回包登记的任务；空命名空间、完整版本和终态是回收前提。 */
export function createBocQuoteJobCase(
  execute: (sql: string) => string,
  owner: string,
  today: string,
) {
  if (
    !uuid.test(owner) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(today) ||
    !Number.isFinite(Date.parse(today)) ||
    new Date(today).toISOString().slice(0, 10) !== today
  )
    throw new Error("boc_suite_identity_invalid");
  const operations = new Map<string, OperationReceipt>();
  const read = (): Graph => JSON.parse(execute(`select ${expression};`));
  let expected: Graph | undefined,
    attempted = false,
    cleanupAttempted = false,
    cleaned = false;
  function shape(graph: Graph) {
    if (
      !graph ||
      !names.every(
        (key) =>
          Array.isArray(graph[key]) &&
          graph[key].every(
            (row) =>
              row &&
              typeof row._xmin === "string" &&
              /^\d+$/.test(row._xmin) &&
              (key === "transport"
                ? Number.isSafeInteger(row.id) && Number(row.id) > 0
                : typeof row.id === "string" && uuid.test(row.id)),
          ),
      )
    )
      throw new Error("boc_suite_snapshot_invalid");
  }
  function active() {
    if (!expected || cleaned || cleanupAttempted)
      throw new Error("boc_suite_not_active");
    return expected;
  }
  const verifiedUrl = `https://www.boc.cn/sourcedb/whpj/?local-fixture-only=${owner}`;
  function own(graph: Graph) {
    shape(graph);
    if (
      graph.verifications.length !== 4 ||
      !graph.verifications.every(
        (row) =>
          row.boc_url === verifiedUrl &&
          row.history_complete === true &&
          ["USD", "EUR"].includes(String(row.currency)) &&
          ["current", "historical"].includes(String(row.quote_kind)),
      ) ||
      new Set(
        graph.verifications.map((row) => row.currency + ":" + row.quote_kind),
      ).size !== 4
    )
      throw new Error("boc_suite_type_fixture_changed");
    if (
      graph.rates.length > 2 ||
      graph.rates.some(
        (row) =>
          row.target_currency !== "CNY" ||
          row.rate_date !== today ||
          !["USD", "CNY"].includes(String(row.original_currency)) ||
          !Number.isFinite(Number(row.daily_exchange_rate)) ||
          !(Number(row.daily_exchange_rate) > 0) ||
          (row.original_currency === "USD"
            ? row.source !== "nowapi" ||
              row.bank_code !== "BOC" ||
              row.quote_type !== "spot_buy"
            : row.source !== "system" ||
              row.bank_code !== null ||
              row.quote_type !== "fixed" ||
              Number(row.daily_exchange_rate) !== 1),
      )
    )
      throw new Error("boc_suite_quote_scope_changed");
    // 正式Edge先验证管理员，再用服务身份登记任务；账本的申请人字段为空。
    if (
      graph.runs.length !== operations.size ||
      graph.runs.some((row) => {
        const observed = operations.get(String(row.id));
        return (
          !observed ||
          !same(row.request_payload, observed.payload) ||
          row.status !== observed.status ||
          row.operation_key !== "exchange-rate-sync" ||
          row.trigger_source !== "manual" ||
          row.requested_by_user_id !== null ||
          row.next_attempt_at !== null ||
          ![
            "succeeded",
            "partial_failed",
            "failed",
            "needs_attention",
            "skipped",
          ].includes(String(row.status)) ||
          !Number.isFinite(Date.parse(String(row.completed_at)))
        );
      })
    )
      throw new Error("boc_suite_run_not_owned_or_terminal");
    if (
      graph.attempts.some(
        (row) =>
          !operations.has(String(row.operation_run_id)) ||
          ![
            "succeeded",
            "partial_failed",
            "failed",
            "timed_out",
            "skipped",
          ].includes(String(row.status)) ||
          !Number.isFinite(Date.parse(String(row.completed_at))),
      ) ||
      graph.runs.some(
        (run) =>
          graph.attempts.filter((row) => row.operation_run_id === run.id)
            .length !== run.attempt_count,
      )
    )
      throw new Error("boc_suite_attempt_not_terminal");
    if (
      graph.alerts.some(
        (row) =>
          row.operation_key !== "exchange-rate-sync" ||
          !operations.has(String(row.operation_run_id)),
      )
    )
      throw new Error("boc_suite_foreign_alert");
    const transportIds = new Set(
      graph.attempts
        .map((row) => row.transport_request_id)
        .filter((value) => value !== null),
    );
    if (graph.transport.some((row) => !transportIds.has(row.id)))
      throw new Error("boc_suite_foreign_transport");
  }
  return {
    prepare() {
      if (attempted) throw new Error("boc_suite_prepare_repeated");
      attempted = true;
      const before = read();
      shape(before);
      if (names.some((key) => before[key].length))
        throw new Error("boc_suite_namespace_occupied");
      // 仅专属本地模拟的四行类型夹具。约束枚举保持原值，URL明确标记；绝不计真实中行核验。
      const graph: Graph = JSON.parse(
        execute(`begin;
        lock table ${Object.values(tables).join(",")} in share row exclusive mode;
        do $$ begin if ${expression} is distinct from ${quote(JSON.stringify(before))}::jsonb then raise exception 'boc_suite_prepare_scope_changed'; end if; end $$;
        insert into public.boc_quote_verifications(currency,quote_kind,quoted_at,nowapi_bank_quote,boc_bank_quote,boc_url,history_complete,verification_method,provider_row_count)
          select c,k,now(),700,700,${quote(verifiedUrl)},true,'official_page',1 from(values('USD'),('EUR'))currency(c)cross join(values('current'),('historical'))kind(k);
        select ${expression}; commit;`),
      );
      own(graph);
      expected = graph;
      if (!same(read(), expected))
        throw new Error("boc_suite_prepare_not_final");
    },
    recordOperation(
      id: unknown,
      payload: Record<string, unknown>,
      status: unknown,
    ) {
      active();
      if (
        typeof id !== "string" ||
        !uuid.test(id) ||
        typeof status !== "string" ||
        operations.has(id)
      )
        throw new Error("boc_suite_response_operation_invalid");
      operations.set(id, { payload: structuredClone(payload), status });
    },
    capture() {
      const before = active(),
        graph = read();
      own(graph);
      if (!same(graph.verifications, before.verifications))
        throw new Error("boc_suite_type_fixture_changed");
      const added = graph.runs.filter(
        (row) => !before.runs.some((old) => old.id === row.id),
      );
      if (!added.length && !same(graph, before))
        throw new Error("boc_suite_unattributed_change");
      // 报价行只有出现在本阶段任务的结果凭证里，才可纳入回收；旧行消失也不能默认为本次所致。
      const records = added.flatMap((run) => {
        const proof = run.result_proof as { records?: unknown } | null;
        return Array.isArray(proof?.records) ? proof.records : [];
      });
      if (
        before.rates.some(
          (old) => !graph.rates.some((row) => row.id === old.id),
        ) ||
        graph.rates.some(
          (row) =>
            !same(
              before.rates.find((old) => old.id === row.id),
              row,
            ) &&
            !records.some(
              (record) =>
                record?.rateRecordId === row.id &&
                record.baseCurrency === row.original_currency &&
                record.targetCurrency === row.target_currency &&
                record.rateDate === row.rate_date &&
                record.rate === Number(row.daily_exchange_rate) &&
                Date.parse(record.quotedAt) ===
                  Date.parse(String(row.provider_updated_at)),
            ),
        )
      )
        throw new Error("boc_suite_quote_receipt_missing");
      for (const key of ["runs", "attempts", "transport"] as const)
        if (
          !before[key].every((old) =>
            same(
              graph[key].find((row) => row.id === old.id),
              old,
            ),
          )
        )
          throw new Error("boc_suite_prior_receipt_changed");
      expected = graph;
    },
    cleanup() {
      if (!attempted || cleaned) return { inactive: true };
      const graph = active();
      if (!same(read(), graph))
        throw new Error("boc_suite_cleanup_version_changed");
      own(graph);
      cleanupAttempted = true;
      const ids = (key: keyof Graph) =>
        graph[key]
          .map(
            (row) =>
              quote(String(row.id)) +
              (key === "transport" ? "::bigint" : "::uuid"),
          )
          .join(",") || (key === "transport" ? "null::bigint" : "null::uuid");
      const receipt = JSON.parse(
        execute(`begin;
        lock table ${Object.values(tables).join(",")} in share row exclusive mode;
        do $$ declare ref record; ids text[]; referenced boolean; changed integer; begin
          ${names.map((key) => `perform 1 from ${tables[key]} where id in (${ids(key)}) for update;`).join("\n")}
          if ${expression} is distinct from ${quote(JSON.stringify(graph))}::jsonb then raise exception 'boc_suite_cleanup_version_changed'; end if;
          for ref in select c.conrelid,a.attname,array_length(c.conkey,1) as key_count,b.attname as parent_column,s.name from pg_constraint c
            join(values ${names.map((key) => `('${tables[key]}'::regclass,${quote(key)})`).join(",")})s(target,name)on s.target=c.confrelid
            join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
            join pg_attribute b on b.attrelid=c.confrelid and b.attnum=c.confkey[1]
            where c.contype='f' and c.conrelid not in (${Object.values(tables)
              .map((table) => quote(table) + "::regclass")
              .join(",")}) loop
            if ref.key_count<>1 or ref.parent_column<>'id' then raise exception 'boc_suite_unsupported_reference'; end if;
            select array_agg(value->>'id') into ids from jsonb_array_elements(${quote(JSON.stringify(graph))}::jsonb->ref.name);
            execute format('select exists(select 1 from %s where %I::text=any($1))',ref.conrelid::regclass,ref.attname) into referenced using ids;
            if referenced then raise exception 'boc_suite_external_reference'; end if;
          end loop;
          ${[...names]
            .reverse()
            .map(
              (
                key,
              ) => `delete from ${tables[key]} where id in (${ids(key)});get diagnostics changed=row_count;
            if changed<>${graph[key].length} then raise exception 'boc_suite_delete_count_${key}'; end if;`,
            )
            .join("\n")}
        end $$;
        select jsonb_build_object(${names.map((key) => quote(key) + "," + graph[key].length).join(",")}); commit;`),
      );
      if (
        !same(
          receipt,
          Object.fromEntries(names.map((key) => [key, graph[key].length])),
        )
      )
        throw new Error("boc_suite_cleanup_receipt_invalid");
      const after = read();
      shape(after);
      if (names.some((key) => after[key].length))
        throw new Error("boc_suite_cleanup_not_final");
      cleaned = true;
      return receipt;
    },
    evidence() {
      // 报告只给编号、版本、状态和摘要；任务载荷、错误正文和传输内容保留在内存，不写附件。
      return {
        owner,
        today,
        attempted,
        cleaned,
        cleanupAttempted,
        observedOperations: [...operations.keys()],
        realBankVerification: false,
        captured: expected
          ? Object.fromEntries(
              names.map((key) => [
                key,
                expected![key].map((row) => ({
                  id: row.id,
                  version: row._xmin,
                  status: row.status,
                })),
              ]),
            )
          : null,
        fingerprint: expected
          ? createHash("sha256").update(JSON.stringify(expected)).digest("hex")
          : null,
      };
    },
  };
}
