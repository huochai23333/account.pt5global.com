import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const nativeRequire = createRequire(__filename);
const root = path.resolve(__dirname, "../../..");
const cache = new Map<string, { exports: Record<string, unknown> }>();

// 直接加载真实 TSX 及其产品依赖，第三方依赖使用已安装的包。
// 受控文档只验证编辑器标记和基本几何，完整样式和拖动由真实页面套件验收。
function load(file: string): Record<string, unknown> {
  const cached = cache.get(file);
  if (cached) return cached.exports;
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (!/^(components|lib)\//.test(relative)) throw new Error(`Unapproved first-party module: ${relative}`);
  const source = fs.readFileSync(file, "utf8");
  const result = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  } });
  const compiledModule = { exports: {} };
  cache.set(file, compiledModule);
  function resolve(name: string) {
    if (!name.startsWith(".") && !name.startsWith("@/")) return nativeRequire(name);
    const base = name.startsWith("@/") ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
    const target = [base + ".ts", base + ".tsx", path.join(base, "index.ts"), path.join(base, "index.tsx")].find((p) => fs.existsSync(p));
    if (!target) throw new Error(`Unresolved first-party dependency: ${name}`);
    return load(target);
  }
  const wrapper = new vm.Script(`(function(require,module,exports){${result.outputText}\n})`, { filename: file }).runInThisContext();
  wrapper(resolve, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

export function renderHomeEditor() {
  const { DashboardHomeWidgetCard } = load(path.join(root, "components/dashboard/dashboard-home/dashboard-home-widget-card.tsx")) as typeof import("../../../components/dashboard/dashboard-home/dashboard-home-widget-card");
  // 固定卡片夹具独立于产品默认布局，避免实现和期望一起变化而漏掉问题。
  const fixtures = [
    { type: "greeting", width: 5, height: 1 },
    { type: "todos", width: 3, height: 3 },
    { type: "announcements", width: 2, height: 2 },
    { type: "clock", width: 2, height: 2 },
    { type: "invite", width: 3, height: 2 },
  ] as const;
  const copy = { adjustWidget: "调整组件", removeWidget: "移除组件", sizeLabel: (w: number, h: number) => `${w} × ${h}`,
    widgets: Object.fromEntries(fixtures.map(({ type }) => [type, { title: type, description: type }])) } as import("../../../components/dashboard/dashboard-home/dashboard-home-customizer-copy").HomeCustomizerCopy;
  const noop = () => {};
  // React 从 createElement 的第三个参数接收 children，类型标注据此允许传入子节点。
  // 此处使用工厂调用，避免 Playwright 将测试中的 JSX 当作组件测试元数据。
  type Props = React.ComponentProps<typeof DashboardHomeWidgetCard>;
  const CardWithChildArgument = DashboardHomeWidgetCard as React.ComponentType<Omit<Props, "children"> & { children?: React.ReactNode }>;
  const editorCards = fixtures.map((fixture, index) =>
    React.createElement(
      CardWithChildArgument,
      {
        key: fixture.type,
        widget: { ...fixture, id: `fixture-${fixture.type}`, x: 0, y: index },
        copy,
        deleting: false,
        dragging: false,
        editing: true,
        entering: false,
        index,
        onAdjust: noop,
        onDragEnd: noop,
        onDragStart: noop,
        onMove: noop,
        onRemove: noop,
        onResize: noop,
        onResizeEnd: noop,
        onResizeStart: noop,
        pauseWiggle: true,
        resizing: false,
      },
      React.createElement("p", null, `Synthetic ${fixture.type} body`),
    ),
  );
  return renderToStaticMarkup(React.createElement("main", null, editorCards));
}
