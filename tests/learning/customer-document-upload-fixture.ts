import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { executeLearningSql, type createLearningUser } from "../../scripts/learning/local-fixture-session.mjs";

// 学习夹具按ESM加载，生产工具由Playwright转译为CommonJS；标准加载器复用原实现，避免复制核对逻辑。
const { readStorageObjectPresence } = createRequire(import.meta.url)("../../lib/storage-operation-object-presence") as typeof import("../../lib/storage-operation-object-presence");

const bucket = "document-library";

export function prepareCustomerDocumentUpload(actor: Awaited<ReturnType<typeof createLearningUser>>, withDestination = false) {
  const id = randomUUID();
  const name = `Learning document race ${id}`;
  const filename = `${id}.txt`;
  executeLearningSql(`insert into public.wholesale_customers(id,unique_name,created_by_user_id)
    values ('${id}','${name}','${actor.id}');`);
  const folderId = executeLearningSql(`select f.id from public.document_folders f join public.document_archives a on a.id=f.archive_id
    where a.customer_id='${id}' and f.system_key='personal';`);
  const destinationId = withDestination
    ? executeLearningSql(`insert into public.document_folders(archive_id,parent_id,zone,name)
        select archive_id,id,zone,'Learning destination' from public.document_folders where id='${folderId}' returning id;`)
    : folderId;
  // 批量用例共用同一专属目录，文件名和操作均按本次随机编号前缀限定。
  const ownedFolders = `select f.id from public.document_folders f join public.document_archives a on a.id=f.archive_id where a.customer_id='${id}'`;
  const fileScope = `folder_id in (${ownedFolders}) and uploaded_by='${actor.id}' and original_name like '${id}%'`;
  // 目录可能已被本次递归删除。凭证仍按专属账号和随机文件名前缀归属，
  // 不能再依赖“目录仍存在”，否则读取与清理会一起漏掉同一批上传记录。
  const operationScope = `actor_id='${actor.id}' and action='reserve_upload'
    and payload->>'name' like '${id}%'`;
  const read = () => JSON.parse(executeLearningSql(`select json_build_object(
    'customer',(select json_build_object('id',id,'version',xmin::text) from public.wholesale_customers where id='${id}'),
    'archiveCount',(select count(*) from public.document_archives where customer_id='${id}'),
    'files',(select coalesce(json_agg(f order by original_name),'[]') from (select id,folder_id,status,version,storage_path,sha256,size_bytes,original_name
      from public.document_files where ${fileScope}) f),
    'operations',(select coalesce(json_agg(o order by filename),'[]') from (select id,receipt->>'status' as status,receipt->>'affectedCount' as affected,payload->>'name' as filename
      from public.document_operations where ${operationScope}) o),
    'objects',(select coalesce(json_agg(name order by name),'[]') from storage.objects
      where bucket_id='${bucket}' and (owner_id='${actor.id}' or owner='${actor.id}' or name in (
        select storage_path from public.document_files where ${fileScope}
        union select receipt->'record'->>'storage_path' from public.document_operations where ${operationScope}
      ))));`));

  return {
    id, name, folderId, destinationId, filename, read,
    async download(storagePath: string) {
      // 独立读取实际字节，不能仅凭 storage.objects 的登记判定上传成功。
      const result = await actor.client.storage.from(bucket).download(storagePath);
      if (result.error) throw result.error;
      return Buffer.from(await result.data.arrayBuffer());
    },
    async cleanup() {
      const receipt = read();
      if (receipt.objects.length) {
        const storage = actor.client.storage.from(bucket);
        const removed = await storage.remove(receipt.objects);
        if (removed.error) throw removed.error;
        for (const storagePath of receipt.objects) {
          // 清理也必须读取成功且完整的对象列表；SDK返回false并附带错误不能证明对象已经移除。
          if (await readStorageObjectPresence(storage, storagePath)) throw new Error("本次 Storage 夹具仍存在");
        }
      }
      executeLearningSql(`begin;
        delete from public.document_files where ${fileScope};
        delete from public.document_operations where ${operationScope};
        -- 原批次包含文件和目录的操作；先按原结果清凭证，再清批次，保留完整归属依据。
        ${withDestination ? `delete from public.document_operations where actor_id='${actor.id}' and action in ('move_file','move_folder','delete_file','delete_folder','copy_file') and id in (
          select (step->>'operationId')::uuid from public.document_batches b cross join lateral jsonb_array_elements(b.results) step where b.actor_id='${actor.id}'
        );
        delete from public.document_batches where actor_id='${actor.id}';` : ""}
        delete from public.wholesale_customers where id='${id}' and created_by_user_id='${actor.id}' and unique_name='${name}';
        commit;`);
      return read();
    },
  };
}

export type DocumentTreeReceipt = {
  folders: { id: string; parent_id: string | null; name: string; version: number }[];
  files: { id: string; folder_id: string; name: string; original_name: string; status: string; version: number; storage_path: string; sha256: string; size_bytes: number }[];
  documents: { id: string; folder_id: string; name: string; revision: number; template_version_id: string; state: Record<string, unknown>; state_sha256: string }[];
  batches: { id: string; action: string; status: string; results: { kind: string; id: string; status: string }[] }[];
};

/** 三层目录只作本次复制的来源；实际文件由页面上传，正式模板使用真实命令保存非空内容。 */
export async function prepareNestedDocumentTree(actor: Awaited<ReturnType<typeof createLearningUser>>) {
  const base = prepareCustomerDocumentUpload(actor, true);
  const folders = [randomUUID(), randomUUID(), randomUUID()];
  const documentId = randomUUID();
  const archiveFolders = `select f.id from public.document_folders f join public.document_archives a on a.id=f.archive_id where a.customer_id='${base.id}'`;
  const documentScope = `folder_id in (${archiveFolders}) and owner_id='${actor.id}' and name like '${base.id}%'`;
  const readTree = () => JSON.parse(executeLearningSql(`select json_build_object(
    'folders',(select coalesce(json_agg(r order by id),'[]') from (select id,parent_id,name,version from public.document_folders where id in (${archiveFolders})) r),
    'files',(select coalesce(json_agg(r order by id),'[]') from (select id,folder_id,name,original_name,status,version,storage_path,sha256,size_bytes from public.document_files
      where folder_id in (${archiveFolders}) and uploaded_by='${actor.id}' and original_name like '${base.id}%') r),
    'documents',(select coalesce(json_agg(r order by id),'[]') from (select id,folder_id,name,revision,template_version_id,state,state_sha256 from public.company_template_documents where ${documentScope}) r),
    'batches',(select coalesce(json_agg(r order by id),'[]') from (select id,action,status,results from public.document_batches where actor_id='${actor.id}') r));`)) as DocumentTreeReceipt;
  const cleanup = async () => {
    // 按专属账号和清单结束本次未完成批次，再清模板、凭证与客户；共享目录的删除保护保持原状。
    executeLearningSql(`begin;
      set local request.jwt.claims='{"sub":"${actor.id}","role":"authenticated"}';
      do $$ declare batch uuid; begin
        -- 中断测试可能留下删除保护；只通过原接口结束本账号、且清单确含本次根目录的未完成批次。
        for batch in select id from public.document_batches where actor_id='${actor.id}' and action='delete' and status<>'succeeded'
          and not coalesce((request->>'released')::boolean,false) and exists(select 1 from jsonb_array_elements(snapshot) e where e->>'id'='${folders[0]}') loop
          perform public.document_batch_release(batch);
        end loop;
      end $$;
      delete from public.company_template_document_operations where owner_id='${actor.id}' and receipt->>'document_id' in
        (select id::text from public.company_template_documents where ${documentScope} union select '${documentId}');
      delete from public.company_template_documents where ${documentScope};
      delete from public.document_operations where actor_id='${actor.id}' and action='create_folder' and payload->>'folderId' in
        (select id::text from (${archiveFolders}) owned);
      commit;`);
    return base.cleanup();
  };
  try {
    executeLearningSql(`begin;
      insert into public.document_folders(id,archive_id,parent_id,zone,name)
        select '${folders[0]}',archive_id,id,zone,'Tree source' from public.document_folders where id='${base.folderId}';
      insert into public.document_folders(id,archive_id,parent_id,zone,name)
        select '${folders[1]}',archive_id,id,zone,'Level one' from public.document_folders where id='${folders[0]}';
      insert into public.document_folders(id,archive_id,parent_id,zone,name)
        select '${folders[2]}',archive_id,id,zone,'Level two' from public.document_folders where id='${folders[1]}';
      set local request.jwt.claims='{"sub":"${actor.id}","role":"authenticated"}'; set local role authenticated;
      do $$ begin
        perform public.mutate_company_template_document(jsonb_build_object('action','create','documentId','${documentId}','operationId',gen_random_uuid(),
          'templateId','a3200000-0000-4000-8000-000000000001','folderId','${folders[2]}','name','${base.id} template'));
        perform public.mutate_company_template_document(jsonb_build_object('action','save','documentId','${documentId}','operationId',gen_random_uuid(),
          'expectedRevision',1,'state',jsonb_build_object('learningTree','${base.id}','nested',jsonb_build_object('value','保留填写内容'))));
      end $$;
      reset role; commit;`);
  } catch (error) {
    await cleanup();
    throw error;
  }
  return { ...base, folders, documentId, readTree, cleanup };
}
