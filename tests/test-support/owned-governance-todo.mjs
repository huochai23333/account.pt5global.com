import assert from "node:assert/strict";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 单次随机标题是清理边界，读取与删除都必须继续携带它，不能退化成清空某个账号。 */
function checkRows(rows, title) {
  assert(Array.isArray(rows), "待办核对结果必须是数组");
  assert(rows.length <= 1, "专属标题出现多条待办，停止自动删除并保留排查证据");
  for (const row of rows) {
    assert.equal(row.title, title, "查询越过专属待办边界");
    assert(uuid.test(row.id) && uuid.test(row.user_id), "待办凭证缺少有效编号");
  }
  return rows;
}

/**
 * 操作通过参数注入；本模块不导入账号、管理员入口、浏览器或数据库连接。
 * 页面创建或后续断言失败时仍执行限定清理；清理失败与原错误一起保留。
 */
export async function withOwnedGovernanceTodo(title, operations, provide) {
  assert(/^governance-todo-[0-9a-f-]+$/i.test(title), "拒绝非本次生成的待办标题");
  assert(uuid.test(title.slice("governance-todo-".length)), "标题必须携带完整随机编号");
  assert.equal(checkRows(await operations.read(title), title).length, 0, "标题已存在，不取得既有数据的清理权");
  let failure;
  let failed = false;
  let created;
  try {
    await operations.createFromPage(title);
    const rows = checkRows(await operations.read(title), title);
    assert.equal(rows.length, 1, "页面创建后没有唯一权威记录");
    created = rows[0];
    // provide 交付专属记录给测试正文，不是 React 的 use Hook。
    await provide(created);
  } catch (error) {
    failed = true;
    failure = error;
  }

  let removed = [];
  try {
    const remaining = checkRows(await operations.read(title), title);
    if (remaining.length) {
      // 已核对过创建凭证时还必须核对同一编号与所有者，不能删除后来替换的记录。
      if (created) assert.deepEqual(remaining[0], created, "待办创建凭证发生变化");
      removed = checkRows(await operations.remove(remaining[0]), title);
      assert.deepEqual(removed, remaining, "清理影响行数或编号不符");
    }
    assert.equal(checkRows(await operations.read(title), title).length, 0, "清理后仍有待办残留");
  } catch (cleanupError) {
    if (failed) throw new AggregateError([failure, cleanupError], "页面流程与限定清理均未完成");
    throw cleanupError;
  }
  if (failed) throw failure;
  return { created, removed, remaining: 0 };
}
