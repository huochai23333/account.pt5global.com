# 早期迁移职责与隔离重放

2026-11-06。本批逐份审查最初 16 份迁移和新增的重放脚本。历史文件原文与顺序保留。数据库迁移与回滚资料已有 34 / 237 份有效职责记录。[职责覆盖](manual-review-coverage.md) · [后端学习指南](../../../../PT5-dropshipping-supabase/docs/onboarding/history-bootstrap.md)

## 重放结果

裸 PostgreSQL 镜像执行到早期 RLS 时缺少平台安装的 `auth.jwt()`。直接在当前结构副本运行原清理脚本，又遇到现代标识序列与表的依赖。最终采用当前本地 Auth、Storage 结构，单独重建专属副本的 `public` schema，再按原顺序重放。脚本运行在无网络、无端口的 Docker 容器内，执行前检查调度器为 off。

16 份迁移全部执行成功，逐份 SHA-256 与源码一致。7 个检查点覆盖访问令牌钩子授权、本人档案策略、隐私审核视图及权限、私有媒体与派发权限、订单 RLS 和两个外键，以及旧订单备注新增和移除。终态启用任务数和请求队列均为零，容器及结构副本已清理。最终输出在后端 `output/learning-history-20261106/prefix-result.json`。

## 当前权限缺陷复现

在另一轮仅含当前结构的隔离库中，使用合成的活跃客户会话提交写入。独立查询确认该会话能为自己直接写入已通过的隐私申请、正式隐私资料和已通过的媒体登记，各一行。这里仅核对媒体登记行，未创建 Storage 对象。事务回滚后账号和请求队列均为零。后端 `output/learning-history-20261106/current-review-boundary-baseline.log` 保留结果。

后续修复、回归和实际权限见[隐私与媒体提交权限验证](verification-2026-11-06-review-submission-boundaries.md)。

本轮为早期前缀重放及当前数据库权限复现。后续迁移的完整职责审查与全链路回归继续单独记账。
