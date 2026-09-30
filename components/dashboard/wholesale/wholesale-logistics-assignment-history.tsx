"use client";

import { Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { RecordCard } from "@/components/ui/data-display";
import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import type { WholesaleLogisticsStoreAssignment } from "@/lib/wholesale-logistics-page";

import {
  formatWholesaleLogisticsDateTime,
  getWholesaleLogisticsCustomerName,
  getWholesaleLogisticsProfileName,
} from "./wholesale-logistics-display";

/**
 * 店铺归属历史单独负责展示时间区间和行级操作。
 * 这样设置弹窗只维护表单状态，初学者可以分别理解“编辑表单”和“历史列表”。
 */
export function WholesaleLogisticsAssignmentHistory({
  assignments,
  customers,
  onEdit,
  onEnd,
  pendingKey,
  profiles,
}: {
  assignments: WholesaleLogisticsStoreAssignment[];
  customers: WholesaleCustomer[];
  onEdit: (assignment: WholesaleLogisticsStoreAssignment) => void;
  onEnd: (assignmentId: string, effectiveTo: string) => Promise<boolean>;
  pendingKey: string | null;
  profiles: WholesaleProfile[];
}) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
  const locale = useLocale();
  const t = useTranslations("WholesaleBusiness.logisticsArchive");
  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles],
  );
  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const endAssignment = async (
    assignment: WholesaleLogisticsStoreAssignment,
  ) => {
    // 结束会改变此后的订单归属，因此提交前让业务人员再次确认店铺名称。
    if (
      !(await confirm({
        description: t("assignments.confirmEnd", {
          store: assignment.store_name,
        }),
        title: confirmT("title"),
        tone: "warning",
      }))
    ) {
      return;
    }
    await onEnd(assignment.id, new Date().toISOString());
  };

  return (
    <section>
      <div className="flex min-w-0 items-center gap-2">
        <Store className="size-5 shrink-0 text-primary" />
        <h4 className="font-semibold text-content-strong">
          {t("assignments.history")}
        </h4>
      </div>
      <div className="mt-3 grid gap-3">
        {assignments.length === 0 ? (
          <p className="rounded-record-card border border-dashed border-border-subtle p-4 text-sm text-content-muted">
            {t("assignments.noHistory")}
          </p>
        ) : (
          assignments.map((assignment) => (
            <RecordCard key={assignment.id}>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-content-strong">
                    {assignment.store_name}
                  </p>
                  <p className="mt-1 break-words text-sm text-content-muted">
                    {getWholesaleLogisticsProfileName(
                      profilesById,
                      assignment.sales_user_id,
                      t("fallbacks.unassigned"),
                    )}
                    {" · "}
                    {getWholesaleLogisticsCustomerName(
                      customersById,
                      assignment.customer_id,
                      t("fallbacks.noCustomer"),
                    )}
                  </p>
                  <p className="mt-1 break-words text-xs leading-5 text-content-muted">
                    {t("assignments.range", {
                      from: assignment.effective_from
                        ? formatWholesaleLogisticsDateTime(
                            assignment.effective_from,
                            locale,
                          )
                        : t("assignments.allHistory"),
                      to: assignment.effective_to
                        ? formatWholesaleLogisticsDateTime(
                            assignment.effective_to,
                            locale,
                          )
                        : t("assignments.current"),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    disabled={Boolean(pendingKey)}
                    onClick={() => onEdit(assignment)}
                    size="compact"
                    type="button"
                    variant="outline"
                    wrap
                  >
                    {t("assignments.adjust")}
                  </Button>
                  {!assignment.effective_to ? (
                    <Button
                      disabled={Boolean(pendingKey)}
                      loading={pendingKey === `end:${assignment.id}`}
                      onClick={() => void endAssignment(assignment)}
                      size="compact"
                      type="button"
                      variant="danger"
                      wrap
                    >
                      {pendingKey === `end:${assignment.id}`
                        ? t("assignments.ending")
                        : t("assignments.end")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </RecordCard>
          ))
        )}
      </div>
    </section>
  );
}
