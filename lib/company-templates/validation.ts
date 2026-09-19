const MAX_HTML_BYTES = 5 * 1024 * 1024;
const HTML_EXTENSION = /\.html?$/i;

type ValidatedHtmlFile = {
  content: string;
  filename: string;
};

/**
 * 模板允许内联样式和内联脚本，以便原始单文件继续交互；会访问其他页面或装载外部程序的标签在上传阶段直接拒绝。
 */
export async function validateHtmlFile(
  value: FormDataEntryValue | null,
  options: { optional?: boolean } = {},
): Promise<ValidatedHtmlFile | null> {
  if (!(value instanceof File) || value.size === 0) {
    if (options.optional) return null;
    throw new Error("company_template_file_required");
  }
  if (!HTML_EXTENSION.test(value.name)) throw new Error("company_template_file_type");
  if (value.size > MAX_HTML_BYTES) throw new Error("company_template_file_too_large");

  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(await value.arrayBuffer());
  } catch {
    throw new Error("company_template_file_encoding");
  }

  if (!/<html(?:\s|>)/i.test(content) || !/<body(?:\s|>)/i.test(content)) {
    throw new Error("company_template_file_document");
  }

  const blockedPatterns = [
    /<script\b[^>]*\bsrc\s*=/i,
    /<(?:iframe|object|embed|base)\b/i,
    /<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i,
    /<form\b[^>]*\baction\s*=/i,
    /\bformaction\s*=/i,
  ];
  if (blockedPatterns.some((pattern) => pattern.test(content))) {
    throw new Error("company_template_file_unsafe");
  }

  return { content, filename: value.name.slice(0, 255) };
}

export function normalizeTemplateSlug(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!normalized || normalized.length > 80) throw new Error("company_template_slug_invalid");
  return normalized;
}
