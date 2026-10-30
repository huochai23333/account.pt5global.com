# 上传时发现的托管构建资源限制

Global 修复提交 `76e519415e9c400137a00c165158ab90e16c242d` 已推送 GitHub。Hostinger 自动部署 `01a18e03-13b2-72c3-851f-1429b7526888` 安装依赖时报告 0 漏洞，编译和 TypeScript 均通过；在 `Collecting page data using 63 workers` 后因 `OS can't spawn worker thread: Resource temporarily unavailable (os error 11)` 失败，未完成上线。

已核对 [Next.js 16.4.3 构建源码](https://github.com/vercel/next.js/blob/v16.4.3/packages/next/src/build/index.ts) 的 `getNumberOfWorkers`，以及本机同版本安装包。`experimental.cpus` 的显式值控制页面构建进程数；仅降低每进程的静态页面并发不能约束这 63 个进程。相关 [官方资源使用说明](https://nextjs.org/blog/next-15-rc2#advanced-static-generation-control-experimental) 也提示过高并发可能耗尽资源。

`next.config.ts` 设置 `experimental.cpus: 2`，保留原有构建、类型检查和安全设置。配置文件从 62 行增至 67 行，仅增加构建并发限制，无需拆分模块。README 部署部分补充原因和处理方式。

按 `web-change-quality-gate` 的 Non-rendered 路径验证：`eslint next.config.ts`、`git diff --check`、`npm run build` 均通过。生产构建明确显示使用 2 个进程，静态生成 58/58，完成页面优化和构建跟踪，进程退出码 0。没有变更页面或运行时业务，因此本次配置补丁不重复启动本地服务或执行响应式／认证测试；前次布局证据与真实认证未验证项仍见主报告。

此文件记录重新上传前的本地验证。托管重新部署、线上响应及漏洞复扫应分别检查实际终态；Supabase Cloud 与 China 站点不在本次写入范围。
