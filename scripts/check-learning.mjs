import { readFileSync } from "node:fs";
import path from "node:path";
import { validateReviewCoverage } from "./learning/review-coverage.mjs";
import {
  expectedReviewKeys,
  reviewFile,
  validateManualReviews,
} from "./learning/manual-review.mjs";
import {
  discoverSources,
  readModuleMap,
  repositoryRoots,
  webRoot,
} from "./learning/catalogue.mjs";
import {
  validateModuleMap,
  validateMarkdownLinks,
} from "./learning/module-validation.mjs";
import {
  validateSourceReview,
  validateDatabaseSnapshot,
} from "./learning/source-validation.mjs";

// 入口只汇总各类学习合同的检查；路径、摘要和人工审查各自保留独立验证职责。

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.join(webRoot, "scripts/check-learning.mjs")
) {
  const map = readModuleMap();
  const errors = validateModuleMap(map);
  const manual = JSON.parse(readFileSync(reviewFile, "utf8"));
  errors.push(
    ...validateReviewCoverage(
      readFileSync(
        path.join(
          webRoot,
          "docs/onboarding/reference/manual-review-coverage.md",
        ),
        "utf8",
      ),
      map.modules,
      manual.records,
    ),
  );
  errors.push(
    ...validateManualReviews(
      manual.records,
      expectedReviewKeys(map),
      repositoryRoots,
      process.argv.includes("--require-reviewed"),
    ),
  );
  const documents = map.documents.map((file) => path.resolve(webRoot, file));
  errors.push(...validateMarkdownLinks(documents));
  const review = JSON.parse(
    readFileSync(
      path.join(webRoot, "docs/onboarding/source-review.json"),
      "utf8",
    ),
  );
  errors.push(...validateSourceReview(review.records));
  errors.push(...validateDatabaseSnapshot());
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    const counts = Object.keys(repositoryRoots).map(
      (repo) => `${repo} ${discoverSources(repo).length} 份源码`,
    );
    console.log(
      `学习地图检查通过：${map.modules.length} 个模块，${counts.join("，")}，${documents.length} 份文档。`,
    );
    const approved = manual.records.filter((entry) =>
      ["retained", "refactored"].includes(entry.status),
    ).length;
    console.log(
      `职责审查：${approved}/${manual.records.length} 已审；其余待审或受阻。完整验收需加 --require-reviewed。`,
    );
  }
}
