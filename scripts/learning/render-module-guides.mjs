import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repositoryRoots } from "./catalogue.mjs";
import { validateManualReviews } from "./manual-review.mjs";

function sourceLink(from, repo, file, roots) {
  return path
    .relative(path.dirname(from), path.join(roots[repo], file))
    .replaceAll("\\", "/")
    .split("/")
    .map((part) =>
      encodeURIComponent(part).replaceAll("(", "%28").replaceAll(")", "%29"),
    )
    .join("/");
}
function describeCandidateFile(file) {
  if (/migrations\//.test(file)) return "按版本顺序应用的历史数据库变更";
  if (/rollbacks\//.test(file)) return "限定范围的回滚资料，执行前核对前提";
  if (/tests\/|\.test\.|\.spec\./.test(file))
    return "验证源码；执行前核对夹具与访问准入";
  if (/types|\/model\.|\/types\./.test(file)) return "数据形状与输入输出类型";
  if (/^use-|\/use-/.test(file)) return "交互状态、请求调度或恢复 Hook";
  if (/mutation|handler/.test(file))
    return "写入或请求处理；核验权限与最终凭证";
  if (/quer|repository/.test(file)) return "数据读取、过滤与持久化边界";
  if (/dialog|form/.test(file)) return "弹窗或表单展示与字段关联";
  if (/table|list|cards|sections/.test(file)) return "列表、卡片或页面区块展示";
  if (/client\.tsx|page\.tsx/.test(file)) return "页面组装或客户端交互入口";
  if (/\.css$/.test(file)) return "共享主题、布局与样式";
  return "领域服务或共享实现；从导出与调用方追踪职责";
}

/** 指南只引用当前有效的明确审查；过期摘要和不完整记录不能继续显示已审职责。 */
export function describeLearningSource(
  repo,
  file,
  record,
  roots = repositoryRoots,
) {
  if (record?.status === "blocked") return "受限：只登记路径，不读取内容。";
  if (!record || !["retained", "refactored"].includes(record.status))
    return "待审候选：" + describeCandidateFile(file);
  const errors = validateManualReviews(
    [record],
    new Set([repo + ":" + file]),
    roots,
  );
  if (errors.length) return "待重新审查：摘要或审查内容已失效。";
  return (
    (record.status === "refactored" ? "已审拆分：" : "已审保留：") +
    record.responsibilities.join("；")
  );
}
function tableText(value) {
  return value.replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

/** 业务介绍由模块定义提供；文件职责以有效台账为准，不按文件名自动批准。 */
export function renderModuleGuides(
  modules,
  { roots = repositoryRoots, records } = {},
) {
  const file = path.join(roots.web, "docs/onboarding/manual-review.json");
  const entries =
    records ??
    (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).records : []);
  const reviews = new Map(
    entries.map((entry) => [entry.repo + ":" + entry.file, entry]),
  );
  // 指南的业务说明人工维护，下面的源码表由清单生成，避免手工复制大量路径后失真。
  for (const entry of modules) {
    entry.backendObjects.functions = [
      ...new Set(entry.backendObjects.functions),
    ].sort();
    entry.backendObjects.tables = [
      ...new Set(entry.backendObjects.tables),
    ].sort();
    const target = path.resolve(roots.web, entry.guide);
    if (!target.startsWith(path.resolve(roots.web) + path.sep))
      throw new Error("模块指南路径越出仓库：" + entry.guide);
    mkdirSync(path.dirname(target), { recursive: true });
    const lines = [
      `# ${entry.title}`,
      "",
      `当前范围：${entry.status}。`,
      "",
      "## 业务与阅读顺序",
      "",
      entry.purpose,
      "",
      `数据流：${entry.flow}。`,
      "",
      "先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。",
      "",
      "## 权限与完成凭证",
      "",
      entry.permissions,
      "",
      `完成依据：${entry.evidence}`,
      "",
      "## 常见维护",
      "",
      entry.maintenance,
      "",
      `验证入口：${entry.verification}。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。`,
      "",
      "## 数据库调用与关联测试",
      "",
      `源码中直接调用的数据库函数：${entry.backendObjects.functions.map((name) => `\`${name}\``).join("、") || "本模块未发现字面量函数调用，沿服务导入继续追踪"}。`,
      "",
      `源码中直接引用的数据表/存储桶：${entry.backendObjects.tables.map((name) => `\`${name}\``).join("、") || "本模块未发现字面量 from 调用"}。`,
      "",
      "这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。",
      "",
      ...Object.entries(entry.tests).flatMap(([repo, files]) =>
        files.map(
          (file) =>
            `- [${repo}: ${file}](${sourceLink(target, repo, file, roots)})`,
        ),
      ),
      "",
      "## 源码定位",
      "",
      "已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。",
      "",
    ];
    for (const repo of Object.keys(roots)) {
      const files = entry.sources[repo];
      if (!files.length) continue;
      lines.push(
        `### ${repo === "web" ? "Web" : "Supabase"}`,
        "",
        "| 文件 | 阅读重点 |",
        "| --- | --- |",
      );
      for (const file of files)
        lines.push(
          `| [${file}](${sourceLink(target, repo, file, roots)}) | ${tableText(describeLearningSource(repo, file, reviews.get(repo + ":" + file), roots))} |`,
        );
      lines.push("");
    }
    // 各章节已插入空行，文件结尾统一保留一个换行，避免生成额外空白行。
    writeFileSync(target, lines.join("\n").trimEnd() + "\n");
  }
}

export function renderModuleIndex(modules, roots = repositoryRoots) {
  const index = [
    "# 功能与源码地图",
    "",
    "每一行对应一个模块，点击名称查看阅读顺序、权限、完成凭证和完整源码表。",
    "",
    "| 模块 | 当前范围 | Web 文件 | 后端文件 |",
    "| --- | --- | ---: | ---: |",
  ];
  for (const entry of modules)
    index.push(
      `| [${entry.title}](modules/${entry.id}.md) | ${entry.status} | ${entry.sources.web.length} | ${entry.sources.supabase.length} |`,
    );
  index.push(
    "",
    "机器清单：[module-map.json](module-map.json)。静态结构扫描：[source-review.json](source-review.json)。[逐文件审查覆盖](reference/manual-review-coverage.md)。",
    "",
    "源码扫描未读取环境文件、种子账号或两份受限测试辅助文件。扫描结果不能代替人工业务判断、真实页面和数据库终态验证。",
    "",
  );
  writeFileSync(
    path.join(roots.web, "docs/onboarding/module-index.md"),
    index.join("\n"),
  );
}
