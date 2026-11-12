import type { SupabaseClient } from "@supabase/supabase-js";
import { readStorageObjectPresence } from "../../../lib/storage-operation-object-presence";
import type {
  MediaCasePorts,
  MediaScope,
  MediaSnapshot,
} from "../../test-support/user-media-owned-case";
import { runLocalSupabaseSql } from "./local-supabase";

type ExecuteSql = (statement: string) => string;
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const ids = (values: string[]) =>
  `array[${values.map(quote).join(",")}]::uuid[]`;
const paths = (values: string[]) =>
  `array[${values.map(quote).join(",")}]::text[]`;

/** 默认每次SQL由已有执行器核对真实专属DB/API/网关及off/0/0；不读取原账号辅助模块。 */
export function readOperatorMediaOwner(
  email: string,
  execute: ExecuteSql = runLocalSupabaseSql,
) {
  const rows = JSON.parse(
    execute(`select coalesce(jsonb_agg(u.id),'[]')from auth.users u
    join public.user_profiles p on p.user_id=u.id where u.email=${quote(email)}and p.status='active'
    and exists(select 1 from public.user_roles_data d join public.user_roles r on r.id=d.role_id
      where d.user_id=u.id and r.role='operator');`),
  );
  if (!Array.isArray(rows) || rows.length !== 1)
    throw new Error("media_case_operator_identity_missing");
  return rows[0] as string;
}

/** 只读Storage目录获取内容版本；物理删除/下载始终使用传入的真实SDK服务，不以SQL删对象。 */
export function createUserMediaOwnedStore(
  admin: SupabaseClient,
  identity: { userId: string; fileName: string },
  apiOrigin: string,
  execute: ExecuteSql = runLocalSupabaseSql,
): MediaCasePorts {
  // 当前锁定SDK的实例持有初始化地址；不匹配显式专属API便停止，不能把SQL凭证和另一项目的Storage混用。
  const actual = new URL(Reflect.get(admin, "supabaseUrl"));
  const declared = new URL(apiOrigin);
  if (
    actual.origin !== declared.origin ||
    declared.protocol !== "http:" ||
    !declared.port ||
    !["localhost", "127.0.0.1", "[::1]"].includes(declared.hostname)
  )
    throw new Error("media_case_api_target_mismatch");
  return {
    async read(scope: MediaScope) {
      if (
        scope.userId !== identity.userId ||
        scope.fileName !== identity.fileName
      )
        throw new Error("media_case_store_scope_mismatch");
      const prefix = scope.userId + "/image/",
        suffix = "-" + scope.fileName;
      const assetWhere = `(user_id=${quote(scope.userId)}::uuid and original_name=${quote(scope.fileName)})or id=any(${ids(scope.assetIds)})or storage_path=any(${paths(scope.paths)})`;
      return JSON.parse(
        execute(`select jsonb_build_object(
        'assets',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('_xmin',xmin::text)order by id),'[]')
          from public.user_media_assets a where ${assetWhere}),
        'reviews',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('_xmin',xmin::text)order by id),'[]')
          from public.user_media_image_ai_reviews r where asset_id in(select id from public.user_media_assets where ${assetWhere})
            or id=any(${ids(scope.reviewIds)})),
        'objects',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket_id',bucket_id,'name',name,
          'version',version,'metadata',metadata,'created_at',created_at,'owner_id',owner_id)order by id),'[]')
          from storage.objects where bucket_id='user-media'and(
            (left(name,${prefix.length})=${quote(prefix)}and right(name,${suffix.length})=${quote(suffix)})
            or id=any(${ids(scope.objectIds)})or name=any(${paths(scope.paths)}))));`),
      );
    },
    async download(path) {
      const { data, error } = await admin.storage
        .from("user-media")
        .download(path);
      if (error || !data)
        throw error ?? new Error("media_case_download_missing");
      return new Uint8Array(await data.arrayBuffer());
    },
    async present(path) {
      return readStorageObjectPresence(admin.storage.from("user-media"), path);
    },
    async remove(path) {
      const { error } = await admin.storage.from("user-media").remove([path]);
      if (error) throw error;
    },
    async deleteRows(snapshot: MediaSnapshot) {
      if (
        snapshot.assets.length > 1 ||
        snapshot.assets.some(
          (a) =>
            a.user_id !== identity.userId ||
            a.original_name !== identity.fileName ||
            a.bucket_name !== "user-media" ||
            !a.storage_path.startsWith(identity.userId + "/image/") ||
            !a.storage_path.endsWith("-" + identity.fileName),
        )
      )
        throw new Error("media_case_row_delete_scope_invalid");
      if (snapshot.assets.length === 0) return [];
      // Storage确认消失后只回收原完整行和xmin；并发变化或实际0行必须回滚并保留未确认。
      return JSON.parse(
        execute(`begin;set local standard_conforming_strings=on;
        lock table public.user_media_assets,public.user_media_image_ai_reviews in share row exclusive mode;
        create temp table media_case_expected(data jsonb)on commit drop;
        insert into media_case_expected values(${quote(JSON.stringify(snapshot.assets))}::jsonb);
        do $media_case$declare actual jsonb;affected integer;begin
          select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('_xmin',xmin::text)order by id),'[]')into actual
          from public.user_media_assets a where id=any(${ids(snapshot.assets.map((a) => a.id))});
          if actual is distinct from(select data from media_case_expected)then raise exception 'media_case_row_version_changed';end if;
          if exists(select 1 from pg_constraint where contype='f'and confrelid='public.user_media_assets'::regclass
            and conrelid<>'public.user_media_image_ai_reviews'::regclass)then raise exception 'media_case_unknown_child';end if;
          select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('_xmin',xmin::text)order by id),'[]')into actual
            from public.user_media_image_ai_reviews r where asset_id=any(${ids(snapshot.assets.map((a) => a.id))})
              or id=any(${ids(snapshot.reviews.map((r) => String(r.id)))});
          if actual is distinct from ${quote(JSON.stringify(snapshot.reviews))}::jsonb then raise exception 'media_case_review_version_changed';end if;
          delete from public.user_media_assets where id=any(${ids(snapshot.assets.map((a) => a.id))});
          get diagnostics affected=row_count;
          if affected<>${snapshot.assets.length} then raise exception 'media_case_row_delete_zero';end if;
        end $media_case$;commit;select ${quote(JSON.stringify(snapshot.assets.map((a) => a.id)))}::jsonb;`),
      );
    },
  };
}
