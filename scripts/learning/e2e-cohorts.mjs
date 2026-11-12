/**
 * 历史测试集合是一次审计的固定对象，当前目录则会随功能增加而增长。
 * 二者必须分开比较；新增文件只代表新入口，不能继承历史通过记录。
 */
export function compareE2eCohorts(originalFiles, currentFiles, renames = {}) {
  const original = new Set(originalFiles);
  const current = new Set(currentFiles);
  if (original.size !== originalFiles.length || current.size !== currentFiles.length) {
    throw new Error("测试清单存在重复路径，请先核对清单来源。");
  }
  const targets = new Set();
  for (const [before, after] of Object.entries(renames)) {
    if (
      !original.has(before) ||
      original.has(after) ||
      current.has(before) ||
      !current.has(after) ||
      targets.has(after)
    ) {
      throw new Error(`测试改名映射无效：${before} -> ${after}`);
    }
    targets.add(after);
  }
  return {
    added: [...current].filter((file) => !original.has(file) && !targets.has(file)).sort(),
    removed: [...original].filter((file) => !current.has(file) && !renames[file]).sort(),
    renamed: Object.entries(renames).map(([before, after]) => ({ before, after })),
  };
}
