# 后台任务与数据库维护练习

## 练习一：追踪一次图片审核任务

先运行 `doctor`，确认所有任务地址指向本地、计划任务暂停、请求队列为空。用下面的只读命令确认现有 Edge Runtime 的图片审核模式，预期输出 `disabled`。

```powershell
docker exec supabase_edge_runtime_pt5-dropshipping printenv USER_MEDIA_IMAGE_REVIEW_PROVIDER
```

若没有得到这个值，在本项目后台函数的本地环境文件中设置 `USER_MEDIA_IMAGE_REVIEW_PROVIDER=disabled`，按[启动手册](../how-to/local-development.md#需要后台函数的测试)加载函数环境。该模式运行真实本地审核函数，把图片转入人工审核。

1. 使用本次专属本地账号进入个人中心，打开「个人照片」，点「上传照片」选择唯一命名的 PNG，例如 `learning-<本次编号>.png`。
2. 在开发者工具找到 `user-media-mutate` 的上传响应，记录 `operationId`、`uploadedAssetIds` 中的图片编号和 `reviewOperationId`。这三个编号用于后续查询。
3. 独立查询 `user_media_assets` 的对象路径/大小；从 Storage 下载字节核对 SHA-256，并检查 `user_media_image_ai_reviews`。预期后台记录为 `completed`、`provider=disabled`、`decision=manual_review`。
4. 按审核操作编号读取 `private.operation_runs`。预期终态 `succeeded`、成功数 1、失败数 0；这时图片仍为 `pending`，等待人工决定。
5. 用获授权的本地管理员从审核中心找到这条专属资料，点击通过并完成确认。独立核对媒体状态 `pass`、审核人编号，再刷新个人中心确认一致。
6. 从个人中心删除本次图片，记录删除响应的 `operationId` 并核对终态和成功数 1。独立确认媒体记录、`storage.objects`、成功的目录查询和刷新后界面均不再包含该对象。练习账号结束后按专属夹具的收尾流程回收。

在本地数据库的只读查询中，把占位符替换为本次上传、审核或删除的运行编号：

```sql
select id, operation_key, status, succeeded_count, failed_count, completed_at
from private.operation_runs
where id = '<本次运行 UUID>'::uuid;
```

阅读链路为 `user-media-mutations.ts` → `user-media-mutate/upload-handler.ts` → `request_user_media_image_review` → 审核函数的 provider/repository → 审核中心的人工处理。服务器发出的请求也必须落在本地，浏览器拦截网络不能替代后台地址检查。

进阶故障练习：本地测试工具可在实际上传完成后丢弃响应，再从页面点击“重试上传”。预期复用同一个操作编号、只有一份媒体记录；不得因网络异常重新创建副本。工具只能在专属夹具上注入故障。

[后台任务教程复走](../reference/verification-2026-11-11-media-tutorial.md)保存上传、转人工、审核通过、删除与独立清理证据。

## 练习二：新增一个事务 SQL 断言

目标是为已确认规则增加验证，而不是先改变业务规则。

1. 从对应业务的现有 SQL 测试复制事务与断言结构，新文件使用明确名称。
2. 使用 `begin` 和 `rollback` 包住测试；错误采用 `ON_ERROR_STOP` 立即中止。
3. 为缺权限或旧版本写入增加一条预期拒绝断言，并独立检查原记录没有变化。
4. 在隔离本地 Docker 中运行。先确认断言能检测错误结果，再保留正确预期。
5. 将测试路径登记到学习地图，更新对应模块的维护说明。

## 练习三：在隔离实例修改并回滚分页规则

在隔离数据库里，把线索查询上限从 100 临时改为 50，再验证回滚。开始前运行 `doctor`，确认主项目健康。随后在后端仓库运行：

```powershell
node scripts/prepare-learning-rule-sandbox.mjs
```

准备工具只读主项目结构，创建无网络、无端口、数据放在临时内存盘的专属容器。它暂停调度、确认队列为空，然后建立 75 条合成线索。终端的 `migration` 字段给出本次迁移草稿的路径。

如果本机已安装 Supabase CLI，但准备工具找不到它，可在 PowerShell 用 `$env:SUPABASE_CLI = (Get-Command supabase).Source` 指定已安装的命令，再运行准备步骤。

打开草稿，找到 `least(greatest(coalesce(p_limit, 20), 1), 100)`。把最后的 `100` 改成 `50`，保存文件。验证脚本读取这个草稿，允许的变动只有这一个值。

```powershell
node scripts/test-learning-page-limit.mjs
```

阅读 [SQL 断言](../../../../PT5-dropshipping-supabase/supabase/tests/learning_page_limit.sql)，核对结果里的 `changedLimit=50`、`returnedRows=50`、`fixtureRows=75`、`defaultLimit=20`、`minimumLimit=1` 和普通客户被拒绝。测试结束后，另一个数据库连接确认原函数摘要、线索总数和练习账号角色均已恢复。

查看 `output/learning-rule/rule-result.json` 和 SQL 日志，说明每个断言保护了什么。最后运行清理命令，核对只回收本次无网络练习容器。迁移草稿位于忽略目录，正式数据库变更须走[后端数据库手册](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md)里的迁移流程。

```powershell
node scripts/prepare-learning-rule-sandbox.mjs --cleanup
```

Web/API/函数的调用合同变化必须同步更新。生产 Cloud 迁移和外部供应商验收另行安排，不能拿本地通过代替。

本次复走的结果和限定清理见[数据库教程验收](../reference/verification-2026-11-11-page-tutorial.md)。
