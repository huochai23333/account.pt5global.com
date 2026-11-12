type Quote = Record<string, unknown> & { id: string; _xmin: string };
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

/** 专用XTS场景只在空范围准备；不删除“以前留下”的报价，也不读取原账号或环境。 */
export function createBocManualRateCase(
  execute: (sql: string) => string,
  date: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error("boc_manual_date_invalid");
  const pair = `original_currency='XTS' and target_currency='CNY' and rate_date=${quote(date)}::date`;
  let prepared = false,
    deleted = false,
    cleaned = false;
  let last: Quote | undefined;
  const scope = () => `(${pair})${last ? ` or id='${last.id}'::uuid` : ""}`;
  const read = (): Quote[] =>
    JSON.parse(
      execute(`select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('_xmin',r.xmin::text) order by r.id),'[]')
    from public.exchange_rate r where ${scope()};`),
    );
  function active() {
    if (!prepared || cleaned) throw new Error("boc_manual_case_not_active");
  }
  function check(value: Quote, rate: number, minute: string) {
    if (
      !value ||
      !uuid.test(value.id) ||
      typeof value._xmin !== "string" ||
      !/^\d+$/.test(value._xmin) ||
      value.original_currency !== "XTS" ||
      value.target_currency !== "CNY" ||
      value.rate_date !== date ||
      value.source !== "manual" ||
      value.bank_code !== "BOC" ||
      value.quote_type !== "spot_buy" ||
      value.provider_rate_date !== date ||
      Number(value.daily_exchange_rate) !== rate ||
      Number(value.bank_quote) !== rate * 100 ||
      Date.parse(String(value.provider_updated_at)) !==
        Date.parse(date + "T00:" + minute + ":00+08:00")
    )
      throw new Error("boc_manual_record_invalid");
  }
  return {
    prepare() {
      if (prepared) throw new Error("boc_manual_prepare_repeated");
      if (read().length !== 0) throw new Error("boc_manual_scope_occupied");
      prepared = true;
    },
    saved() {
      active();
      if (last || deleted) throw new Error("boc_manual_save_repeated");
      const rows = read();
      if (rows.length !== 1) throw new Error("boc_manual_saved_count");
      check(rows[0], 7, "01");
      last = rows[0];
      return structuredClone(last);
    },
    updated() {
      active();
      if (!last || deleted) throw new Error("boc_manual_saved_receipt_missing");
      const rows = read(),
        row = rows[0];
      if (rows.length !== 1) throw new Error("boc_manual_updated_count");
      check(row, 8, "02");
      const mutable = [
        "daily_exchange_rate",
        "bank_quote",
        "provider_updated_at",
        "fetched_at",
        "_xmin",
      ];
      const stable = (value: Quote) =>
        Object.fromEntries(
          Object.entries(value).filter(([key]) => !mutable.includes(key)),
        );
      if (
        row.id !== last.id ||
        row._xmin === last._xmin ||
        !same(stable(row), stable(last))
      )
        throw new Error("boc_manual_updated_identity_or_version");
      last = row;
      return structuredClone(last);
    },
    unchanged() {
      active();
      const rows = read();
      if (
        deleted
          ? rows.length !== 0
          : !last || rows.length !== 1 || !same(rows[0], last)
      )
        throw new Error("boc_manual_version_changed");
      return last ? structuredClone(last) : null;
    },
    deleted() {
      active();
      if (!last || deleted || read().length !== 0)
        throw new Error("boc_manual_delete_not_final");
      deleted = true;
      return { id: last.id, deleted: 1 };
    },
    cleanup() {
      if (!prepared || cleaned) return { deleted: 0, inactive: true };
      const rows = read();
      if ((deleted || !last) && rows.length === 0) {
        cleaned = true;
        return { deleted: 0, alreadyAbsent: true };
      }
      if (!last || deleted || rows.length !== 1 || !same(rows[0], last))
        throw new Error("boc_manual_cleanup_version_changed");
      const expected = last;
      const receipt = JSON.parse(
        execute(`begin;
        do $$ declare actual jsonb; affected integer; ref record; referenced boolean; begin
          -- 行锁阻止新增外键引用；SET NULL也会改写别的业务，必须在删除前检查所有引用。
          perform 1 from public.exchange_rate where id='${expected.id}' for update;
          select to_jsonb(r)||jsonb_build_object('_xmin',r.xmin::text) into actual from public.exchange_rate r where id='${expected.id}';
          if actual is distinct from ${quote(JSON.stringify(expected))}::jsonb or
            (select count(*) from public.exchange_rate where ${scope()})<>1 then raise exception 'boc_manual_cleanup_version_changed'; end if;
          for ref in select c.conrelid,a.attname,array_length(c.conkey,1) as key_count from pg_constraint c
            join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
            where c.contype='f' and c.confrelid='public.exchange_rate'::regclass loop
            if ref.key_count<>1 then raise exception 'boc_manual_unsupported_reference'; end if;
            execute format('select exists(select 1 from %s where %I=$1)',ref.conrelid::regclass,ref.attname) into referenced using '${expected.id}'::uuid;
            if referenced then raise exception 'boc_manual_referenced'; end if;
          end loop;
          delete from public.exchange_rate where id='${expected.id}' and xmin::text=${quote(expected._xmin)};
          get diagnostics affected=row_count;
          if affected<>1 then raise exception 'boc_manual_cleanup_zero_affected'; end if;
        end $$;
        select jsonb_build_object('id','${expected.id}','deleted',1); commit;`),
      );
      if (receipt.id !== expected.id || receipt.deleted !== 1)
        throw new Error("boc_manual_cleanup_receipt_invalid");
      if (read().length !== 0) throw new Error("boc_manual_cleanup_not_final");
      cleaned = true;
      return receipt as { id: string; deleted: number };
    },
    evidence() {
      return structuredClone({ date, prepared, deleted, cleaned, last });
    },
  };
}
