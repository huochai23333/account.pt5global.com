import type {
  DocumentFixtureStore,
  FixtureBatch,
  FixtureRow,
} from "./document-fixture-store";

type Folder = FixtureRow & {
  parent_id: string | null;
  name: string;
  system_key: string | null;
};
type File = FixtureRow & {
  name: string;
  original_name: string;
  folder_id: string;
  storage_path: string;
};
type Document = FixtureRow & { name: string; folder_id: string };
type Operation = FixtureRow & { payload: unknown; receipt: unknown };

function requireRunPrefix(prefix: string) {
  const runId =
    /\d{13}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
  if (typeof prefix !== "string" || prefix.length < 13 || !runId.test(prefix)) {
    throw new Error("fixture_cleanup_requires_run_prefix");
  }
}
function named(value: unknown, prefix: string) {
  return typeof value === "string" && value.startsWith(prefix);
}
function referencesFixture(
  value: unknown,
  ids: Set<string>,
  prefix: string,
): boolean {
  if (Array.isArray(value))
    return value.some((item) => referencesFixture(item, ids, prefix));
  if (!value || typeof value !== "object")
    return typeof value === "string" && ids.has(value);
  return Object.entries(value).some(
    ([key, item]) =>
      ((key === "name" || key === "original_name") && named(item, prefix)) ||
      referencesFixture(item, ids, prefix),
  );
}

/** 清理当前运行独占的目录、文件及操作记录，所有实际访问由明确提供的 store 执行。 */
export async function cleanupDocumentFixtures(
  prefix: string,
  store: DocumentFixtureStore,
) {
  requireRunPrefix(prefix);
  const folders = await store.listRows<Folder>(
    "document_folders",
    "id,parent_id,name,system_key",
  );
  const files = await store.listRows<File>(
    "document_files",
    "id,name,original_name,folder_id,storage_path",
  );
  const documents = await store.listRows<Document>(
    "company_template_documents",
    "id,name,folder_id",
  );
  const batches = await store.listRows<FixtureBatch>(
    "document_batches",
    "id,actor_id,manifest,request",
  );
  const folderIds = new Set(
    folders
      .filter((row) => !row.system_key && named(row.name, prefix))
      .map((row) => row.id),
  );
  // 根目录归属明确后，默认名称的后代也归本次夹具；系统目录始终不进入删除集合。
  while (true) {
    const children = folders.filter(
      (row) =>
        row.parent_id && folderIds.has(row.parent_id) && !folderIds.has(row.id),
    );
    if (children.some((row) => row.system_key))
      throw new Error("fixture_contains_system_folder");
    if (!children.length) break;
    for (const row of children) folderIds.add(row.id);
  }
  const ownedFiles = files.filter(
    (row) =>
      named(row.name, prefix) ||
      named(row.original_name, prefix) ||
      folderIds.has(row.folder_id),
  );
  const ownedDocuments = documents.filter(
    (row) => named(row.name, prefix) || folderIds.has(row.folder_id),
  );
  const ids = new Set([
    ...folderIds,
    ...ownedFiles.map((row) => row.id),
    ...ownedDocuments.map((row) => row.id),
  ]);
  const entryOwned = (entry: FixtureBatch["manifest"][number]) =>
    ids.has(entry.id) ||
    Boolean(entry.anchor && folderIds.has(entry.anchor)) ||
    Boolean(entry.folderId && folderIds.has(entry.folderId)) ||
    referencesFixture(entry.record, ids, prefix);
  const ownedBatches = batches.filter((batch) => {
    if (!Array.isArray(batch.manifest))
      throw new Error("fixture_batch_manifest_invalid");
    const matches = batch.manifest.map(entryOwned);
    // 混合批次不能因为含有一个测试文件，就释放或删除另一运行的记录。
    if (matches.some(Boolean) && !matches.every(Boolean))
      throw new Error("fixture_batch_has_unowned_entries");
    return matches.length > 0 && matches.every(Boolean);
  });
  const fileIds = new Set(ownedFiles.map((row) => row.id));
  const paths = [...new Set(ownedFiles.map((row) => row.storage_path))];
  if (
    files.some(
      (row) => !fileIds.has(row.id) && paths.includes(row.storage_path),
    )
  )
    throw new Error("fixture_storage_has_unowned_reference");
  const operations = await store.listRows<Operation>(
    "document_operations",
    "id,payload,receipt",
  );
  const operationIds = operations
    .filter(
      (row) =>
        referencesFixture(row.payload, ids, prefix) ||
        referencesFixture(row.receipt, ids, prefix),
    )
    .map((row) => row.id);
  const folderGroups: string[][] = [];
  const remaining = new Set(folderIds);
  // 写入前先排定顺序并检测环，避免删完文件后才发现目录结构无法回收。
  while (remaining.size) {
    const leaves = folders.filter(
      (row) =>
        remaining.has(row.id) &&
        !folders.some(
          (child) => child.parent_id === row.id && remaining.has(child.id),
        ),
    );
    if (!leaves.length) throw new Error("fixture_folder_graph_has_cycle");
    folderGroups.push(leaves.map((row) => row.id));
    for (const leaf of leaves) remaining.delete(leaf.id);
  }
  // 先释放批次锁，再清理对象及记录。失败立即向调用者传播，不把剩余记录当空集合。
  for (const batch of ownedBatches) await store.releaseBatch(batch);
  for (const path of paths) await store.removeObject(path);
  await store.deleteRows("document_files", [...fileIds]);
  await store.deleteRows(
    "company_template_documents",
    ownedDocuments.map((row) => row.id),
  );
  for (const group of folderGroups)
    await store.deleteRows("document_folders", group);
  await store.deleteRows("document_operations", operationIds);
  await store.deleteRows(
    "document_batches",
    ownedBatches.map((row) => row.id),
  );

  // 最后重新读取，不只依赖删除响应；可检测清理期间新增的同运行记录。
  for (const [table, columns] of [
    ["document_folders", "id,name"],
    ["document_files", "id,name,original_name"],
    ["company_template_documents", "id,name"],
    ["document_operations", "id,payload,receipt"],
    ["document_batches", "id,manifest"],
  ] as const) {
    const rows = await store.listRows<FixtureRow & Record<string, unknown>>(
      table,
      columns,
    );
    if (
      rows.some((row) => ids.has(row.id) || referencesFixture(row, ids, prefix))
    )
      throw new Error("fixture_cleanup_has_remaining_records");
  }
  return ownedBatches.map((batch) => ({
    id: batch.id,
    entries: batch.manifest.map(({ kind, id, version }) => ({
      kind,
      id,
      version,
    })),
  }));
}
