import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { webRoot } from "./catalogue.mjs";
import { moduleDefinitions } from "./module-definitions.mjs";
import { scanLearningSources } from "./scan-module-sources.mjs";
import {
  renderModuleGuides,
  renderModuleIndex,
} from "./render-module-guides.mjs";
import { writeLearningIndexes } from "./write-learning-indexes.mjs";
import { renderReviewCoverage } from "./review-coverage.mjs";

// 刷新入口只调度事实收集、可读指南和机器索引；明确审查始终由台账独立维护。
const home = path.join(webRoot, "docs/onboarding");
mkdirSync(path.join(home, "modules"), { recursive: true });
const priorFile = path.join(home, "module-map.json");
const priorMap = existsSync(priorFile)
  ? JSON.parse(readFileSync(priorFile, "utf8"))
  : null;
const result = scanLearningSources(moduleDefinitions, priorMap);
renderModuleGuides(result.modules);
renderModuleIndex(result.modules);
writeLearningIndexes(result);
const ledger = JSON.parse(
  readFileSync(path.join(home, "manual-review.json"), "utf8"),
);
writeFileSync(
  path.join(home, "reference/manual-review-coverage.md"),
  renderReviewCoverage(result.modules, ledger.records),
);
console.log(
  `已更新 ${result.modules.length} 个模块，${result.review.length} 份运行源码结构记录，${result.database.length} 份迁移历史索引。`,
);
