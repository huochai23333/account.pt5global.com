# 开发配置与本地启动

当前范围：开发。

## 业务与阅读顺序

统一依赖、构建、本地诊断和两仓库运行方式。

数据流：依赖锁文件 → 本地服务 → doctor → 定向检查 → 构建/回归。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

开发脚本只在明确的本地目标运行；密钥保存在本机，不写文档。

完成依据：版本、服务身份、配置存在性和迁移集合核对一致。

## 常见维护

新增命令同步帮助与 README；诊断只读，重置和修复必须显式执行。

验证入口：npm run doctor；npm run build；学习工具单元测试。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：本模块未发现字面量函数调用，沿服务导入继续追踪。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/contracts/playwright.config.ts](../../../tests/contracts/playwright.config.ts)
- [web: tests/learning/package.json](../../../tests/learning/package.json)
- [web: tests/learning/playwright.config.ts](../../../tests/learning/playwright.config.ts)
- [web: tests/public/playwright.config.ts](../../../tests/public/playwright.config.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [eslint.config.mjs](../../../eslint.config.mjs) | 已审保留：配置 Next.js 与 TypeScript 检查规则；忽略构建和测试输出 |
| [next.config.ts](../../../next.config.ts) | 已审保留：接入双语请求与构建配置；声明全站与嵌入响应头；声明图片来源及质量 |
| [package.json](../../../package.json) | 已审保留：项目版本与运行入口；依赖声明与固定覆盖 |
| [playwright.config.ts](../../../playwright.config.ts) | 已审保留：定义原浏览器套件与证据输出；安排串行和开发服务复用 |
| [postcss.config.mjs](../../../postcss.config.mjs) | 已审保留：接入 Tailwind 的 PostCSS 插件 |
| [tsconfig.json](../../../tsconfig.json) | 已审保留：声明 TypeScript 严格检查与解析；纳入 Next.js 生成的路由类型 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [restore-local-seed.ps1](../../../../PT5-dropshipping-supabase/restore-local-seed.ps1) | 已审拆分：校验本机 Docker 和专属临时数据库；在指定容器事务恢复固定种子；查询恢复后的夹具计数 |
| [scripts/repair-local-gateway.mjs](../../../../PT5-dropshipping-supabase/scripts/repair-local-gateway.mjs) | 已审拆分：核对本项目网关配置与暂停条件；预览、热重载及失败回滚 |
| [scripts/repair-local-job-endpoints.mjs](../../../../PT5-dropshipping-supabase/scripts/repair-local-job-endpoints.mjs) | 已审保留：本地任务端点预览与映射；受保护批量更新和读回 |
| [scripts/repair-local-vector.mjs](../../../../PT5-dropshipping-supabase/scripts/repair-local-vector.mjs) | 已审拆分：预检项目与日志容器；重建本机日志容器；保存原配置并在失败时尝试回滚 |
| [supabase/config.toml](../../../../PT5-dropshipping-supabase/supabase/config.toml) | 已审拆分：本机服务端口与初始化；Auth/Storage配置；Edge入口配置 |
