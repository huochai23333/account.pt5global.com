import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TestInfo } from "@playwright/test";
import { createCommissionMergeOrder } from "../../test-support/commission-merge-order";
import { createCommissionMergeReadFault } from "../../test-support/commission-merge-read-fault";
import { prepareCurrentExchangeRateFixture } from "./current-exchange-rate-fixture";
import { runLocalSupabaseSql } from "./local-supabase";

/** 原认证入口保留；此处只组装专属数据能力，不读取账号或启动服务。 */
export function createCommissionMergeFixture() {
  const order = createCommissionMergeOrder(runLocalSupabaseSql);
  const fault = createCommissionMergeReadFault(runLocalSupabaseSql);
  let cleanupRate: (() => Promise<void>) | undefined;
  let rateState: "not_prepared" | "preparing" | "prepared" | "restored" =
    "not_prepared";
  let evidencePath: string | undefined;
  return {
    order,
    fault,
    async prepare(info: TestInfo) {
      if (info.config.workers !== 1)
        throw new Error("commission_fixture_requires_single_worker");
      if (rateState !== "not_prepared")
        throw new Error("commission_fixture_prepare_already_attempted");
      evidencePath = info.outputPath(`commission-fixture-${order.id}.json`);
      rateState = "preparing";
      cleanupRate = await prepareCurrentExchangeRateFixture();
      rateState = "prepared";
      order.prepare();
    },
    async cleanup() {
      let orderCleanup;
      try {
        // 报价准备响应丢失时没有安全的恢复凭证，不能将未准备或未知写成已恢复。
        if (rateState === "preparing")
          throw new Error("commission_rate_prepare_outcome_unknown");
        // 先恢复全局读取入口，再清订单，最后恢复报价；任何未知结果均保留依赖与证据。
        fault.restore();
        orderCleanup = order.cleanup();
        await cleanupRate?.();
        if (rateState === "prepared") rateState = "restored";
      } finally {
        if (evidencePath) {
          mkdirSync(path.dirname(evidencePath), { recursive: true });
          writeFileSync(
            evidencePath,
            JSON.stringify(
              {
                order: order.evidence(),
                fault: fault.evidence(),
                orderCleanup,
                rateState,
              },
              null,
              2,
            ),
          );
        }
      }
    },
  };
}
