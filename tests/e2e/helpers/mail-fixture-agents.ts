import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptMailValue } from "../../../lib/mail/mail-security";
import { insertMailFixtureRecords } from "./mail-fixture-records";
import {
  SALESMAN_ID,
  PEER_SALESMAN_ID,
  CONTENT_KEY,
} from "./mail-fixture-identity";

/** 两名业务员的发件资料和飞书绑定；管理员资料仍由真实应用首次进入时建立。 */
export async function seedMailFixtureAgents(client: SupabaseClient) {
  await insertMailFixtureRecords(
    client,
    "mail_agent_profiles",
    [
      {
        user_id: SALESMAN_ID,
        alias_local_part: "local-sales",
        ref_prefix: "LOCAL",
        sender_display_name_enc: encryptMailValue("PT5 Sales", CONTENT_KEY),
        signature_html_enc: encryptMailValue("<p>PT5 Team</p>", CONTENT_KEY),
        enabled: true,
      },
      {
        user_id: PEER_SALESMAN_ID,
        alias_local_part: "peer-sales",
        ref_prefix: "PEER",
        sender_display_name_enc: encryptMailValue("PT5 Peer", CONTENT_KEY),
        signature_html_enc: encryptMailValue("<p>PT5 Team</p>", CONTENT_KEY),
        enabled: true,
      },
    ],
    "user_id",
  );
  await insertMailFixtureRecords(
    client,
    "mail_feishu_bindings",
    [
      {
        user_id: SALESMAN_ID,
        open_id: "local-sales-open-id",
        display_name_enc: encryptMailValue("PT5 Sales", CONTENT_KEY),
      },
      {
        user_id: PEER_SALESMAN_ID,
        open_id: "peer-sales-open-id",
        display_name_enc: encryptMailValue("PT5 Peer", CONTENT_KEY),
      },
    ],
    "user_id",
  );
}
