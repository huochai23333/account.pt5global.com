"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { DashboardListSection } from "@/components/dashboard/dashboard-section-panel";
import { FeedbackNotice } from "@/components/dashboard/dashboard-shared-ui";
import type {
  BusinessParameterSetting,
  CommissionRuleCode,
} from "@/lib/commission-settings";

import { BusinessParameterSettingsTable } from "./admin-commission-settings-ui";
import { BusinessParameterEditDialog } from "./business-parameter-edit-dialog";
import { BusinessParameterHistoryDialog } from "./business-parameter-history-dialog";
import { useBusinessParameterSettingsViewModel } from "./use-business-parameter-settings-view-model";

/**
 * 参数中心区块只负责组合列表和两个弹窗。查询、发布、取消、最终回读和表单状态
 * 分别放在数据模块及 view-model 中，避免页面组件同时承担多个职责。
 */
export function AdminCommissionSettingsSection({
  canManageSettings,
  onRowsChange,
  ruleCodes,
  rows,
}: {
  canManageSettings: boolean;
  onRowsChange?: (rows: BusinessParameterSetting[]) => void;
  ruleCodes?: readonly CommissionRuleCode[];
  rows: BusinessParameterSetting[];
}) {
  const { locale } = useLocale();
  const viewModel = useBusinessParameterSettingsViewModel({
    onRowsChange,
    rows,
  });
  const visibleSettings = ruleCodes
    ? viewModel.settings.filter((setting) =>
        ruleCodes.includes(setting.parameterCode),
      )
    : viewModel.settings;

  if (!canManageSettings) return null;

  return (
    <DashboardListSection bodyClassName="flex flex-col gap-5">
      {viewModel.feedback ? (
        <FeedbackNotice tone={viewModel.feedback.tone}>
          {viewModel.feedback.message}
        </FeedbackNotice>
      ) : null}

      <BusinessParameterSettingsTable
        locale={locale}
        onCancelSchedule={(setting) => void viewModel.cancelSchedule(setting)}
        onEdit={viewModel.openEditor}
        onHistory={viewModel.openHistory}
        pendingKey={viewModel.pendingKey}
        settings={visibleSettings}
      />

      <BusinessParameterEditDialog
        editor={viewModel.editor}
        locale={locale}
        onClose={viewModel.closeEditor}
        onPublish={() => void viewModel.publish()}
        onUpdate={viewModel.updateEditor}
        pending={viewModel.pendingKey?.startsWith("publish:") ?? false}
      />

      <BusinessParameterHistoryDialog
        locale={locale}
        onClose={viewModel.closeHistory}
        onRestore={(version) => {
          if (!viewModel.historySetting) return;
          const setting = viewModel.historySetting;
          viewModel.closeHistory();
          viewModel.openEditor(setting, version);
        }}
        pending={viewModel.pendingKey !== null}
        setting={viewModel.historySetting}
      />
    </DashboardListSection>
  );
}
