/**
 * 此函数整体装入隔离窗口，不能引用模块变量或本站接口。
 * 原 HTML 仍原样存储；仅在个人文档运行时为普通表单安装数据采集能力。
 */
export function installGenericTemplateAdapter() {
  type Field = { path: string; value: string; checked?: boolean; selected?: number[]; edited: boolean; data: Record<string, string> };
  type Image = { path: string; src: string; style: string; className: string; parentClass: string };
  type Values = { fields: Field[]; editable: { path: string; text: string }[]; images: Image[] };
  type Action = { path: string; kind: string; before: Values; answers: (string | boolean | null)[]; files?: { name: string; type: string; url: string }[] };
  type State = Values & { format: string; actions: Action[] };
  type API = { version: number; exportState: () => unknown; importState: (state: State) => unknown; subscribe: (notify: () => void) => unknown };
  const host = window as typeof window & { PT5Template?: API };
  // 已有接口继续拥有自己的业务状态，通用采集不能覆盖它。
  if (host.PT5Template) return;
  let replaying = false;
  let active: Action | null = null;
  let answers: Action["answers"] = [];
  let journal: Action[] = [];
  let notifyChange = () => {};
  const edited = new WeakSet<Element>();
  const pending = new Set<Promise<unknown>>();
  const initialImages = new Map<Element, string>();
  for (const image of document.images) initialImages.set(image, JSON.stringify(imageValue(image)));
  const pause = () => new Promise<void>(resolve => setTimeout(resolve, 30));
  // 使用元素在树中的位置，不依赖模板可能随机生成的编号；恢复必须锁定同一模板版本。
  function pathOf(element: Element): string {
    const parts: number[] = [];
    for (let node = element; node !== document.documentElement;) {
      const parent = node.parentElement;
      if (!parent) throw Error("detached");
      parts.unshift(Array.prototype.indexOf.call(parent.children, node)); node = parent;
    }
    return parts.join("/");
  }
  function locate(path: string): Element {
    let node: Element = document.documentElement;
    for (const part of path.split("/")) { node = node.children[Number(part)]; if (!node) throw Error("restore_target"); }
    return node;
  }
  function imageValue(element: HTMLImageElement): Image {
    let src = element.getAttribute("src") ?? "";
    // 临时图片地址不能跨刷新保存，转为实际像素；原静态商标等图片仍由锁定版本提供。
    if (src.startsWith("blob:")) {
      const canvas = document.createElement("canvas"); canvas.width = element.naturalWidth; canvas.height = element.naturalHeight;
      if (!canvas.width || !canvas.height) throw Error("image_pending");
      canvas.getContext("2d")!.drawImage(element, 0, 0); src = canvas.toDataURL("image/png");
    }
    return { path: pathOf(element), src, style: element.style.cssText, className: element.className, parentClass: element.parentElement?.className ?? "" };
  }
  function values(): Values {
    return {
      fields: Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:not([type=file]):not([type=password]),select,textarea")).map(element => ({
        path: pathOf(element), value: element.value, edited: edited.has(element),
        ...(element instanceof HTMLInputElement ? { checked: element.checked } : {}),
        ...(element instanceof HTMLSelectElement && element.multiple ? { selected: Array.from(element.selectedOptions, option => option.index) } : {}),
        data: { ...element.dataset } as Record<string, string>,
      })),
      editable: Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"]')).map(element => ({ path: pathOf(element), text: element.innerText })),
      images: Array.from(document.images).map(imageValue).filter(item => initialImages.get(locate(item.path)) !== JSON.stringify(item)),
    };
  }
  function pack(state: State) {
    const unique = new Set<string>();
    JSON.stringify(state, (_key, value) => { if (typeof value === "string" && value.length >= 512) unique.add(value); return value; });
    // jsonb 会重排对象属性，因此素材编号按内容排序，恢复后不能因属性顺序改变而误判失败。
    const assets = [...unique].sort(), indexes = new Map(assets.map((value, index) => [value, index]));
    // 操作快照会重复引用同一张图片；大字符串仅保存一次，不能因为多点几次按钮就重复占满容量。
    const data = JSON.parse(JSON.stringify(state, (_key, value) => {
      if (typeof value !== "string" || value.length < 512) return value;
      return { pt5Asset: indexes.get(value) };
    }));
    return { ...data, assets };
  }
  function unpack(state: State & { assets?: string[] }): State {
    const { assets, ...data } = state;
    if (!Array.isArray(assets)) throw Error("restore_assets");
    return JSON.parse(JSON.stringify(data), (_key, value) => {
      if (value && typeof value === "object" && Object.keys(value).length === 1 && Number.isInteger(value.pt5Asset)) {
        const asset = assets[value.pt5Asset]; if (typeof asset !== "string") throw Error("restore_asset"); return asset;
      }
      return value;
    });
  }
  function apply(state: Values) {
    const changed: Element[] = [];
    for (const field of state.fields) {
      const element = locate(field.path) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!element.matches("input:not([type=file]):not([type=password]),select,textarea")) throw Error("restore_field");
      const valueChanged = element.value !== field.value;
      element.value = field.value;
      if (element instanceof HTMLInputElement && field.checked !== undefined) element.checked = field.checked;
      if (element instanceof HTMLSelectElement && field.selected) Array.from(element.options).forEach(option => { option.selected = field.selected!.includes(option.index); });
      // 手动修改标记等数据属性属于模板的计算状态；禁止恢复 onclick 或其他执行代码。
      for (const key of Object.keys(element.dataset)) delete element.dataset[key];
      Object.assign(element.dataset, field.data);
      // 已由重放恢复的值不能重复触发：有些模板的地址输入会主动清空文件图片。
      if (field.edited) { edited.add(element); if (valueChanged && !element.matches('select,input[type=checkbox],input[type=radio]')) changed.push(element); }
    }
    for (const item of state.editable) { const element = locate(item.path) as HTMLElement; if (!element.isContentEditable) throw Error("restore_editable"); if (element.innerText !== item.text) { element.innerText = item.text; element.dispatchEvent(new Event("input", { bubbles: true })); } }
    // 先设置所有值再通知原处理函数，避免恢复到一半时参与计算。
    for (const element of changed) { element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true })); }
    for (const item of state.images) {
      const element = locate(item.path); if (!(element instanceof HTMLImageElement)) throw Error("restore_image");
      if (item.src) element.setAttribute("src", item.src); else element.removeAttribute("src");
      element.style.cssText = item.style; element.className = item.className;
      if (element.parentElement) element.parentElement.className = item.parentClass;
    }
  }
  // 记录模板对话框的真实回答；恢复时不用员工再次确认，也不重复打印或打开外部窗口。
  const nativePrompt = window.prompt.bind(window), nativeConfirm = window.confirm.bind(window);
  const nativeAlert = window.alert.bind(window), nativePrint = window.print.bind(window), nativeOpen = window.open.bind(window);
  window.prompt = (...args) => { if (replaying) return answers.shift() as string | null; const answer = nativePrompt(...args); active?.answers.push(answer); return answer; };
  window.confirm = (...args) => { if (replaying) return answers.shift() === true; const answer = nativeConfirm(...args); active?.answers.push(answer); return answer; };
  window.alert = (...args) => { if (!replaying) nativeAlert(...args); };
  window.print = () => { if (!replaying) nativePrint(); };
  window.open = (...args) => replaying ? null : nativeOpen(...args);
  function record(event: Event) {
    if (replaying || !(event.target instanceof Element) || (["click", "dblclick"].includes(event.type) && !event.isTrusted)) return;
    const target = event.target;
    if (event.type === "input" || event.type === "change") { edited.add(target); notifyChange(); }
    const clickable = target.closest('button,[role="button"],[tabindex]');
    const special = event.type === "change" && target.matches('select,input[type=checkbox],input[type=radio],input[type=file]');
    if (!(["click", "dblclick"].includes(event.type) && clickable && !target.matches("input,select,textarea")) && !special) return;
    const element = special ? target : clickable!;
    const action: Action = { path: pathOf(element), kind: event.type, before: values(), answers: [] };
    journal.push(action); active = action;
    notifyChange();
    if (element instanceof HTMLInputElement && element.type === "file") {
      // 文件被原脚本清空前读出实际字节，刷新后重新交给原文件处理函数。
      const files = Array.from(element.files ?? []);
      const reading = Promise.all(files.map(file => new Promise<{ name: string; type: string; url: string }>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, type: file.type, url: String(reader.result) }); reader.onerror = reject; reader.readAsDataURL(file);
      }))).then(files => { action.files = files; });
      pending.add(reading); void reading.finally(() => pending.delete(reading)).catch(() => {});
    }
    setTimeout(() => { if (active === action) active = null; }, 0);
  }
  for (const name of ["click", "dblclick", "input", "change"]) document.addEventListener(name, record, true);
  document.addEventListener("click", event => { if (replaying && event.target instanceof Element && event.target.closest('a,input[type=file]')) event.preventDefault(); }, true);
  host.PT5Template = {
    version: 1,
    async exportState() { await Promise.all(pending); return pack({ format: "pt5.form.v1", actions: journal, ...values() }); },
    async importState(saved) {
      const state = unpack(saved);
      if (state.format !== "pt5.form.v1" || !Array.isArray(state.actions)) throw Error("restore_format");
      // 初始往返不需要重放；正式恢复重放原操作，让动态元素仍由原函数创建和绑定事件。
      replaying = true;
      try {
        for (const action of state.actions) {
          apply(action.before); answers = [...action.answers]; const element = locate(action.path);
          if (action.files) {
            if (!(element instanceof HTMLInputElement) || element.type !== "file") throw Error("restore_file");
            const transfer = new DataTransfer();
            for (const file of action.files) {
              const comma = file.url.indexOf(","), binary = atob(file.url.slice(comma + 1));
              transfer.items.add(new File([Uint8Array.from(binary, char => char.charCodeAt(0))], file.name, { type: file.type }));
            }
            element.files = transfer.files;
          }
          element.dispatchEvent(action.kind !== "change" ? new MouseEvent(action.kind, { bubbles: true, cancelable: true }) : new Event("change", { bubbles: true }));
          await pause();
        }
        apply(state); await pause(); journal = state.actions;
      } finally { replaying = false; answers = []; }
    },
    subscribe(notify) {
      // 输入立即标记未保存，不能等轮询后才启用关闭提醒。
      notifyChange = notify;
      let previous = JSON.stringify({ actions: journal, ...values() });
      // 除用户输入外，也捕捉异步图片、脚本改值；只通知数据变化，避免计算 DOM 造成保存循环。
      const timer = setInterval(() => {
        if (replaying || pending.size) return;
        try {
          const current = JSON.stringify({ actions: journal, ...values() });
          if (current !== previous) { previous = current; notify(); }
        } catch { /* 图片尚在解码时留待下一轮，不把临时地址写入数据库。 */ }
      }, 300);
      return () => { clearInterval(timer); notifyChange = () => {}; };
    },
  };
}
