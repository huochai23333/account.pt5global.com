import { validateManualReviews } from "./manual-review.mjs";
import { repositoryRoots } from "./catalogue.mjs";

/** 汇总取当前模块路径与有效审查交集；旧摘要降回待审，受限记录不读内容。 */
export function renderReviewCoverage(
  modules,
  records,
  roots = repositoryRoots,
) {
  const reviews = new Map(
    records.map((entry) => [entry.repo + ":" + entry.file, entry]),
  );
  const total = [0, 0, 0, 0];
  const rows = modules.map((module) => {
    const counts = [0, 0, 0, 0];
    for (const [repo, files] of Object.entries(module.sources)) {
      for (const file of files) {
        const key = repo + ":" + file;
        const entry = reviews.get(key);
        const approved =
          entry &&
          ["retained", "refactored"].includes(entry.status) &&
          validateManualReviews([entry], new Set([key]), roots).length === 0;
        counts[approved ? 0 : entry?.status === "blocked" ? 2 : 1]++;
        counts[3]++;
      }
    }
    counts.forEach((count, index) => {
      total[index] += count;
    });
    return `| [${module.title}](../modules/${module.id}.md) | ${counts.join(" | ")} |`;
  });
  return [
    "# 逐文件审查覆盖快照",
    "",
    "由 learning:refresh 按当前模块路径和有效人工摘要生成；check:learning 拒绝过期覆盖表。职责审查与运行验收分别记录。",
    "",
    "| 模块 | 已审 | 待审 | 受阻 | 合计 |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...rows,
    `| **总计** | ${total.join(" | ")} |`,
    "",
    "逐文件理由见 [manual-review.json](../manual-review.json)。过期或不完整审查计为待审，受限入口只登记。完整门槛为 npm run check:learning:complete。",
    "",
    "更新步骤见[逐文件职责审查](../how-to/source-review.md)，业务与环境结果见[改造报告](../implementation-report.md)。",
    "",
  ].join("\n");
}

/** 检查只报告漂移，不自动刷新或修改人工批准状态。 */
export function validateReviewCoverage(
  markdown,
  modules,
  records,
  roots = repositoryRoots,
) {
  return markdown.replaceAll("\r\n", "\n") ===
    renderReviewCoverage(modules, records, roots)
    ? []
    : ["人工审查覆盖表已过期，请执行 npm run learning:refresh 后核对。"];
}
