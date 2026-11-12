import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

type ExecuteSql = (statement: string) => string;
type Row = Record<string, unknown>;
const original = "get_wholesale_referral_commission_rows";
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";

/** 仅在已准入的可重建实例改名原函数；完整目录行、注释和xmin共同保护恢复归属。 */
export function createCommissionMergeReadFault(execute: ExecuteSql) {
  const name = "pt5_commission_fault_" + randomUUID().replaceAll("-", "");
  let attempted = false,
    restoreAttempted = false,
    restored = false;
  let baseline: Row | undefined, installed: Row | undefined;
  const fingerprint = (
    functionName: string,
  ) => `(select to_jsonb(p)||jsonb_build_object('_xmin',p.xmin::text,
    '_comment',obj_description(p.oid,'pg_proc')) from pg_proc p where p.oid=to_regprocedure('public.${functionName}()'))`;
  function logical(row: Row) {
    const copy = { ...row };
    delete copy._xmin;
    copy.proname = original;
    return copy;
  }
  function valid(row: Row | undefined, functionName: string) {
    return (
      row?.proname === functionName &&
      /^[1-9]\d*$/.test(String(row.oid)) &&
      Number.isSafeInteger(Number(row.oid)) &&
      /^\d+$/.test(String(row._xmin))
    );
  }
  return {
    name,
    install() {
      if (attempted) throw new Error("commission_fault_already_attempted");
      baseline = JSON.parse(execute(`select ${fingerprint(original)};`));
      if (!valid(baseline, original))
        throw new Error("commission_fault_original_missing");
      attempted = true;
      // 目录锁覆盖比对与改名之间的窗口；只在专属实例执行，不向共享项目注入全局故障。
      const result = JSON.parse(
        execute(`begin;lock table pg_catalog.pg_proc in share row exclusive mode;
        do $commission_fault$begin
          if ${fingerprint(original)} is distinct from ${quote(JSON.stringify(baseline))}::jsonb then
            raise exception 'commission_fault_original_changed';end if;
          if to_regprocedure('public.${name}()') is not null then raise exception 'commission_fault_name_taken';end if;
          alter function public.${original}() rename to ${name};
        end $commission_fault$;
        select ${fingerprint(name)};commit;`),
      );
      if (
        !valid(result, name) ||
        !isDeepStrictEqual(logical(result), logical(baseline!))
      )
        throw new Error("commission_fault_install_receipt_invalid");
      installed = result;
      const after = JSON.parse(
        execute(
          `select jsonb_build_object('original',${fingerprint(original)},'renamed',${fingerprint(name)});`,
        ),
      );
      if (
        after.original !== null ||
        !isDeepStrictEqual(after.renamed, installed)
      )
        throw new Error("commission_fault_install_not_final");
    },
    restore() {
      if (!attempted || restored) return;
      if (!installed)
        throw new Error("commission_fault_install_outcome_unknown");
      if (restoreAttempted)
        throw new Error("commission_fault_restore_outcome_unknown");
      restoreAttempted = true;
      const result = JSON.parse(
        execute(`begin;lock table pg_catalog.pg_proc in share row exclusive mode;
        do $commission_restore$begin
          if to_regprocedure('public.${original}()') is not null then raise exception 'commission_fault_original_name_taken';end if;
          if ${fingerprint(name)} is distinct from ${quote(JSON.stringify(installed))}::jsonb then
            raise exception 'commission_fault_catalog_changed';end if;
          alter function public.${name}() rename to ${original};
        end $commission_restore$;
        select ${fingerprint(original)};commit;`),
      );
      if (
        !valid(result, original) ||
        !isDeepStrictEqual(logical(result), logical(baseline!))
      )
        throw new Error("commission_fault_restore_receipt_invalid");
      const after = JSON.parse(
        execute(
          `select jsonb_build_object('original',${fingerprint(original)},'renamed',${fingerprint(name)});`,
        ),
      );
      if (after.renamed !== null || !isDeepStrictEqual(after.original, result))
        throw new Error("commission_fault_restore_not_final");
      restored = true;
    },
    evidence() {
      return {
        name,
        attempted,
        restoreAttempted,
        restored,
        baseline: structuredClone(baseline),
        installed: structuredClone(installed),
      };
    },
  };
}
