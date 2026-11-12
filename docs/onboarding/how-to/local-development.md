# 本地启动

## 确认仓库与工具

两个 Git 仓库应相邻：`PT5-dropshipping-web` 与 `PT5-dropshipping-supabase`。工作区父目录本身不是 Web 仓库。使用 Node.js 24，npm 版本以 Web 的 `package.json` 为准；安装使用 `npm ci`，不要混用锁文件或在同一依赖目录混用 Windows 与 WSL 的 Node。

Windows PowerShell 适合进入目录、检查 Docker 和调用脚本。若选择 WSL，在 WSL 内运行整套 Node/npm 工作流，并先加载已有 nvm；不要从 WSL 调用 Windows 的 npm。版本输出应记录在验证报告中。

本机 npm 版本不一致时，可以显式使用 `npx --yes npm@11.16.0 run doctor` 等命令；它不改变全局 npm。第一次使用需要取得该固定版本。

## 启动顺序

当前本机 API 为 `http://127.0.0.1:48021`，以同级后端 `[api].port` 与本机 `.env.local` 的一致声明为准。Windows 容器健康却无法访问时，先按[端口排查](../../../../PT5-dropshipping-supabase/docs/onboarding/local-api-port.md)检查保留范围；不要反复重建或重置数据。

1. 启动 Docker Desktop，等待引擎就绪。
2. 在后端仓库运行 `supabase --help`，确认当前 CLI 能力，再运行 `supabase start`。只启动当前项目，不停止其他项目。
3. 对已有本地实例先比较迁移版本。增量补齐使用 `supabase migration up --local`；存在历史缺口时先核对缺失文件，再使用当前 CLI 支持的 `--include-all`。不要直接 reset 已有数据。
4. 在 Web 仓库从 `.env.example` 准备本机 `.env.local`，确认数据库地址是本地回环地址。发布密钥和服务密钥分别按文件说明配置，不能提交或粘贴到聊天。
5. 执行 `npm ci` 和 `npm run doctor`。缺少 Web 服务时该项会失败，这是下一步要解决的内容。
6. 先检查 3000/3001 端口及项目 Node 进程，复用已有服务；没有现有服务时执行 `npm run dev -- --hostname localhost`。
7. 打开 `http://localhost:3000/login`，再次运行 doctor，并用本地测试角色验证目标工作台。

## 需要后台函数的测试

先查看 `supabase functions serve --help`，在后端仓库运行对应本地函数服务。仅网页与数据库启动不代表媒体、同步等后台链路可用。Windows 包装程序若报 `ENAMETOOLONG`，检查同一官方安装目录中的 `supabase-go.exe`，使用它提供的相同命令，不更改云端配置。

原固定账号套件需要可重建的隔离数据库。按[后端种子恢复说明](../../../../PT5-dropshipping-supabase/docs/onboarding/environment.md#恢复固定测试种子)检查容器后，再恢复固定账号及业务夹具。平时用独立学习测试的专属账号，避免影响开发数据。

## 配置文件分工

- `next.config.ts` 接入双语请求、设置浏览器响应头和图片来源，并把生产页面构建并行度限制为 2。报价单正文的同源嵌入例外紧跟全站响应头。 [Next.js 响应头](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
- `tsconfig.json` 检查项目 TypeScript 和 Next.js 生成的路由类型。`eslint.config.mjs` 检查源代码，忽略生成文件和测试输出。`postcss.config.mjs` 接入 Tailwind 的编译插件。
- `playwright.config.ts` 属于原固定种子套件。需要验证已运行的本地 Web 时设置 `PLAYWRIGHT_SKIP_WEB_SERVER=1`；独立学习套件自带配置，默认使用已启动的本地 Web。 [Playwright Web 服务](https://playwright.dev/docs/test-webserver)

## 写入测试前

确认应用、Auth 和数据库属于同一个专用本地实例，外部计划任务已暂停、外部 HTTP 请求队列为空、夹具归属明确。doctor 的只读检查提供线索，但不能证明所有外部出口和数据隔离。详见[验证手册](verification.md)。
