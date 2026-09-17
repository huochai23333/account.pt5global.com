import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { uploadQuoteImage } from "@/lib/quotations/images";
import { getServerAuthContext } from "@/lib/server-auth";

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isPrivateAddress(address: string) {
  if (address.includes(":")) {
    const lower = address.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd")
      || lower.startsWith("fe80") || lower.startsWith("::ffff:");
  }
  const parts = address.split(".").map(Number);
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127
    || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31
    || parts[0] === 192 && parts[1] === 168 || parts[0] >= 224;
}

async function checkedUrl(raw: string) {
  // 图片网址只能指向公开 HTTPS 主机，重定向后的地址也要重新执行同一检查。
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Use a public HTTPS image URL.");
  if (isIP(url.hostname)) throw new Error("Use a public HTTPS image URL.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("Use a public HTTPS image URL.");
  return url;
}

export async function POST(request: Request) {
  try {
    // 先验证账号，再读取任何外部网址，避免未登录请求借此触发服务器访问。
    const access = await getServerAuthContext();
    if (!access.userId || access.status !== "active" || !access.role || access.role === "client")
      return Response.json({ error: "Access denied." }, { status: 403 });
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== "string" || body.url.length > 2048) return Response.json({ error: "Invalid image URL." }, { status: 400 });
    const supabase = await getServerSupabaseClient();
    let url = await checkedUrl(body.url);
    let response: Response | null = null;
    for (let step = 0; step < 3; step++) {
      response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error("Image redirect failed.");
      url = await checkedUrl(new URL(location, url).toString());
    }
    if (!response?.ok) throw new Error("Image could not be downloaded.");
    const type = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!IMAGE_TYPES.has(type)) throw new Error("Use a PNG, JPG or WebP image.");
    const length = Number(response.headers.get("content-length"));
    if (length > MAX_BYTES) throw new Error("Image exceeds 5 MB.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Image is empty.");
    // 按流累计真实字节数，不能只信远端声明的 Content-Length。
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Image exceeds 5 MB."); }
      chunks.push(value);
    }
    const file = new File(chunks.map((chunk) => new Uint8Array(chunk)), "product-image", { type });
    const path = await uploadQuoteImage(supabase, file);
    return Response.json({ path });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "Image import failed." }, { status: 400 });
  }
}
