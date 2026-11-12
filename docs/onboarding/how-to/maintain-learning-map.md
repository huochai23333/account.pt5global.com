# 维护学习地图

## 新增或移动源码

1. 在对应模块完成代码；新增领域先从 `scripts/learning/module-definitions.mjs` 找到所属分组，编辑 `modules/` 中对应说明，写清业务、数据流、权限和完成凭证。
2. 运行 `npm run learning:refresh`，生成模块归属、源码表、结构扫描和数据库历史索引。
3. 检查生成的 `module-map.json`。自动建议只看目录和命名，必须评审真实归属；已有人工归属会被保留。
4. 必要时手动调整模块 sources，再运行 refresh 更新指南。
5. 运行 `npm run check:learning` 和 `npm run test:learning`，审查版本控制差异。

新增源码还需补齐[职责审查台账](source-review.md)。完整收尾使用 `npm run check:learning -- --require-reviewed`，不能只引用默认检查的路径覆盖结果。

refresh 会写入两仓库的文档索引；check 只读。不要在未准备同级后端仓库时刷新地图。

刷新入口 `scripts/learning/refresh-map.mjs` 只负责调度。源码发现与历史声明提取在 `scan-module-sources.mjs`，指南展示在 `render-module-guides.mjs`，机器索引落盘在 `write-learning-indexes.mjs`。修改生成规则时运行 `npm run test:learning`；不要直接修改生成后的说明来绕过规则。

## 什么需要人工维护

模块目的、权限、数据流、成功凭证、维护建议以及教程应由读过源码的人确认。生成工具只扫描路径、语法、行数、声明和摘要，不验证业务正确性。

源码表中的“已审保留/已审拆分”来自当前有效的明确审查台账。摘要或必填内容失效后显示“待重新审查”；“待审候选”只提示可能的文件类型，不能作为职责判断。刷新不会替你批准审查或更新旧摘要。

历史 SQL 索引展示各次迁移中的定义；同名函数可能后续被覆盖或删除。查看当前生效定义时需同时检查迁移集合与本地数据库目录，不能只引用第一次定义。

静态结构记录明确标为 `static_structure_scan`。它不是逐文件人工评审报告，也不是 E2E 通过凭证。需要人工追踪的复杂模块及未完成验证保存在实际交付报告中，不用自动生成的覆盖率替代。
