"use client";

import { Select } from "@/components/ui/select";

import type {
  OperatorReimbursementPeriod,
  OperatorReimbursementStatus,
} from "@/lib/operator-reimbursements";

import {
  DashboardFilterField,
  DashboardSearchInput,
} from "../dashboard-section-panel";
import { DashboardResourceFilterSection } from "../dashboard-resource-filter-section";
import { formatOperatorReimbursementPeriod } from "./operator-reimbursements-display";

type OperatorReimbursementsFilterSectionProps = {
  copy: {
    ownerLabel: string;
    mine: string;
    allOperators: string;
    allPeriods: string;
    allStatuses: string;
    periodLabel: string;
    searchPlaceholder: string;
    statusLabel: string;
    statusOptions: Record<OperatorReimbursementStatus, string>;
  };
  owner: string;
  operators: { id: string; name: string }[];
  onOwnerChange: (value: string) => void;
  locale: string;
  onPeriodFilterChange: (value: string) => void;
  onReset: () => void;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: OperatorReimbursementStatus | "all") => void;
  periodFilter: string;
  periodOptions: OperatorReimbursementPeriod[];
  searchQuery: string;
  statusFilter: OperatorReimbursementStatus | "all";
};

export function OperatorReimbursementsFilterSection({
  copy,
  owner,
  operators,
  onOwnerChange,
  locale,
  onPeriodFilterChange,
  onReset,
  onSearchQueryChange,
  onStatusFilterChange,
  periodFilter,
  periodOptions,
  searchQuery,
  statusFilter,
}: OperatorReimbursementsFilterSectionProps) {
  return (
    <DashboardResourceFilterSection
      activeFilterCount={
        [
          owner !== "mine",
          Boolean(searchQuery),
          periodFilter !== "all",
          statusFilter !== "all",
        ].filter(Boolean).length
      }
      gridClassName="sm:grid-cols-2 xl:grid-cols-3"
      onReset={onReset}
      primary={
        <DashboardSearchInput
          ariaLabel={copy.searchPlaceholder}
          onChange={onSearchQueryChange}
          placeholder={copy.searchPlaceholder}
          value={searchQuery}
        />
      }
      resetDisabled={
        owner === "mine" &&
        !searchQuery &&
        periodFilter === "all" &&
        statusFilter === "all"
      }
    >
      <DashboardFilterField label={copy.ownerLabel}>
        <Select
          value={owner}
          onValueChange={onOwnerChange}
          options={[
            { value: "mine", label: copy.mine },
            { value: "all", label: copy.allOperators },
            ...operators.map((operator) => ({
              value: operator.id,
              label: operator.name,
            })),
          ]}
        />
      </DashboardFilterField>
      <DashboardFilterField label={copy.periodLabel}>
        <Select
          onValueChange={onPeriodFilterChange}
          options={[
            { label: copy.allPeriods, value: "all" },
            // 周期选项来自已存在的记录；没有记录的周期不展示，避免用户选到空月份。
            ...periodOptions.map((period) => ({
              label: formatOperatorReimbursementPeriod(period, locale),
              value: period.start,
            })),
          ]}
          value={periodFilter}
        />
      </DashboardFilterField>

      <DashboardFilterField label={copy.statusLabel}>
        <Select
          onValueChange={onStatusFilterChange}
          options={[
            { label: copy.allStatuses, value: "all" },
            {
              label: copy.statusOptions.unreimbursed,
              value: "unreimbursed",
            },
            { label: copy.statusOptions.reimbursed, value: "reimbursed" },
          ]}
          value={statusFilter}
        />
      </DashboardFilterField>
    </DashboardResourceFilterSection>
  );
}
