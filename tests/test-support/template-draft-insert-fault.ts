import { randomUUID } from "node:crypto";

type ExecuteSql = (statement: string) => string;
const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
// PostgreSQL将oid编码为JSON字符串；不能把真实目录凭证误判成缺失。
const validOid = (value: unknown) =>
  (typeof value === "string" || typeof value === "number") &&
  /^[1-9]\d*$/.test(String(value)) &&
  Number.isSafeInteger(Number(value));

/** 只向明确提供的专属SQL能力安装故障；本模块不找账号、不选容器、不修改原业务函数。 */
export function createTemplateDraftInsertFault(draftId: string, execute: ExecuteSql) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(draftId))
    throw new Error("draft_fault_id_invalid");
  const owner = randomUUID();
  const name = "pt5_draft_fault_" + owner.replaceAll("-", "");
  const ownerTag = `pt5-draft-fault:${owner}:${draftId}`;
  let attempted = false;
  let removed = false;
  let installed: Record<string, unknown> | undefined;

  // 完整目录行及xmin识别同值重建/改写，不能只按名字删除可能已被另一运行改动的对象。
  const fingerprint = `jsonb_build_object(
    'procedure',(select to_jsonb(p)||jsonb_build_object('_xmin',p.xmin::text,'ownerTag',obj_description(p.oid,'pg_proc'))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='${name}'),
    'trigger',(select to_jsonb(t)||jsonb_build_object('_xmin',t.xmin::text,'ownerTag',obj_description(t.oid,'pg_trigger'))
      from pg_trigger t where t.tgrelid='public.company_template_documents'::regclass and t.tgname='${name}'))`;

  return {
    install() {
      if (attempted) throw new Error("draft_fault_install_already_attempted");
      attempted = true;
      const result = execute(`begin;
        do $$ begin
          perform id from public.company_template_document_drafts where id='${draftId}'::uuid for share;
          if not found then raise exception 'draft_fault_target_missing'; end if;
        end $$;
        create function private.${name}() returns trigger language plpgsql set search_path=pg_catalog as $$
        begin
          if new.id='${draftId}'::uuid then return null; end if;
          return new;
        end $$;
        revoke all on function private.${name}() from public,anon,authenticated;
        comment on function private.${name}() is ${quote(ownerTag)};
        create trigger ${name} before insert on public.company_template_documents for each row execute function private.${name}();
        comment on trigger ${name} on public.company_template_documents is ${quote(ownerTag)};
        select ${fingerprint};
        commit;`);
      const receipt = JSON.parse(result);
      if (
        receipt?.procedure?.proname !== name ||
        receipt?.trigger?.tgname !== name ||
        receipt.procedure.ownerTag !== ownerTag ||
        receipt.trigger.ownerTag !== ownerTag ||
        !validOid(receipt.procedure.oid) ||
        !validOid(receipt.trigger.oid)
      )
        throw new Error("draft_fault_install_receipt_invalid");
      installed = receipt;
      return { owner, draftId, name };
    },
    remove() {
      if (!attempted || removed) return;
      // 安装响应丢失不能猜测目录现状；保留专属实例与目标，先独立调查再恢复。
      if (!installed) throw new Error("draft_fault_install_outcome_unknown");
      const result = execute(`begin;
        lock table public.company_template_documents in share row exclusive mode;
        create temp table expected_draft_fault on commit drop as select ${quote(JSON.stringify(installed))}::jsonb value;
        do $$ begin
          if ${fingerprint} is distinct from (select value from pg_temp.expected_draft_fault) then
            raise exception 'draft_fault_catalog_changed';
          end if;
        end $$;
        drop trigger ${name} on public.company_template_documents;
        drop function private.${name}();
        select jsonb_build_object('removed',${fingerprint}->'procedure'='null'::jsonb and ${fingerprint}->'trigger'='null'::jsonb);
        commit;`);
      if (JSON.parse(result)?.removed !== true) throw new Error("draft_fault_remove_unconfirmed");
      // 新连接再查零；只有真实目录终态确认后才允许测试继续重试原转正操作。
      const after = JSON.parse(execute(`select ${fingerprint};`));
      if (after.procedure !== null || after.trigger !== null) throw new Error("draft_fault_remove_not_final");
      removed = true;
    },
  };
}
