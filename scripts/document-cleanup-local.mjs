import { createClient } from "@supabase/supabase-js";
import { runDocumentCleanup } from "../../PT5-dropshipping-supabase/supabase/functions/_shared/document-cleanup.ts";

// 本地验收入口只允许 Docker 地址；不打印服务密钥，不替代 Edge 调度入口验收。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url ?? "")) throw new Error("local_supabase_required");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const bucket = admin.storage.from("document-library");
const result = await runDocumentCleanup({
  claim: async () => { const result = await admin.rpc("document_library_claim_cleanup"); if (result.error) throw result.error; return result.data; },
  exists: (path) => bucket.exists(path),
  remove: (path) => bucket.remove([path]),
  finish: async (target, success) => {
    const result = await admin.rpc("document_library_finish", { p_operation: target.operation_id, p_actor: target.actor_id, p_success: success, p_cleanup: true });
    if (result.error) throw result.error; return result.data;
  },
});
process.stdout.write(JSON.stringify(result));
