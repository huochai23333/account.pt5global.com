import type { BusinessVipAdjustmentAction, BusinessVipMembershipAction, BusinessVipRow } from "@/lib/business-vip-management";

export type BusinessVipOperationRecord = {
  actorName: string | null;
  amount: number | null;
  createdAt: string | null;
  currency: string | null;
  customerLabel: string;
  id: string;
  kind: BusinessVipAdjustmentAction | BusinessVipMembershipAction;
  nextExpiresAt: string | null;
  note: string | null;
  previousExpiresAt: string | null;
};

export type BusinessVipMembershipRecord = {
  actorName: string | null;
  amount: number | null;
  createdAt: string | null;
  currency: string | null;
  id: string;
  kind: BusinessVipMembershipAction;
  nextExpiresAt: string | null;
  note: string | null;
  previousExpiresAt: string | null;
};

// 操作记录来自已授权读取的客户行，列表和弹窗各自决定哪些记录需要显示。
export function getBusinessVipOperationRecords(
  rows: readonly BusinessVipRow[],
): BusinessVipOperationRecord[] {
  return rows
    .flatMap((row) => [
      ...row.rechargeRecords.flatMap((record) =>
        record.operationType
          ? [
              {
                actorName: record.confirmedByName,
                amount: record.amount,
                createdAt: record.confirmedAt,
                currency: record.currency,
                customerLabel: row.customerLabel,
                id: `recharge:${record.id}`,
                kind: record.operationType,
                nextExpiresAt: record.nextExpiresAt,
                note: record.note,
                previousExpiresAt: record.previousExpiresAt,
              } satisfies BusinessVipOperationRecord,
            ]
          : [],
      ),
      ...row.adjustments.map(
        (adjustment) =>
          ({
            actorName: adjustment.createdByName,
            // 手动调整没有收费动作，金额字段保持为空，便于记录列表统一渲染。
            amount: null,
            createdAt: adjustment.createdAt,
            currency: null,
            customerLabel: row.customerLabel,
            id: `adjustment:${adjustment.id}`,
            kind: adjustment.action,
            nextExpiresAt: adjustment.nextExpiresAt,
            note: adjustment.note,
            previousExpiresAt: adjustment.previousExpiresAt,
          }) satisfies BusinessVipOperationRecord,
      ),
    ])
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

      // 同一时刻的记录用唯一编号固定次序，翻页和刷新后不会交换位置。
      return rightTime - leftTime || right.id.localeCompare(left.id);
    });
}

export function getBusinessVipMembershipRecords(
  row: BusinessVipRow,
): BusinessVipMembershipRecord[] {
  // 客户弹窗只展示开通和续费，取消或手动调整仍保留在页面下方的总操作记录里。
  return row.rechargeRecords
    .flatMap((record) =>
      record.operationType
        ? [
            {
              actorName: record.confirmedByName,
              amount: record.amount,
              createdAt: record.confirmedAt,
              currency: record.currency,
              id: record.id,
              kind: record.operationType,
              nextExpiresAt: record.nextExpiresAt,
              note: record.note,
              previousExpiresAt: record.previousExpiresAt,
            } satisfies BusinessVipMembershipRecord,
          ]
        : [],
    )
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

      return rightTime - leftTime;
    });
}
