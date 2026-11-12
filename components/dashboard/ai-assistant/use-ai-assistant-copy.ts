"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { AiAssistantLocale, AiAssistantSettlementReleaseAction } from "@/lib/ai-assistant/assistant-types";
import { getCompanyText } from "@/lib/company-config";

// 集中把翻译键组装成面板文案，让入口组件只处理打开、关闭和聊天调度。
export function useAiAssistantCopy(assistantLocale: AiAssistantLocale) {
  const t = useTranslations("DashboardShell.aiAssistant");
  const companyText = getCompanyText(assistantLocale);
  return useMemo(
    () => ({
      close:
        assistantLocale === "en"
          ? `Close ${companyText.assistantName}`
          : `关闭${companyText.assistantName}`,
      greeting: t("greeting"),
      inputLabel: t("inputLabel"),
      open:
        assistantLocale === "en"
          ? `Open ${companyText.assistantName}`
          : `打开${companyText.assistantName}`,
      placeholder: t("placeholder"),
      reset: t("reset"),
      resetConfirmAction: t("resetConfirmAction"),
      resetConfirmCancel: t("resetConfirmCancel"),
      resetConfirmDescription: t("resetConfirmDescription"),
      requestTooLarge: t("requestTooLarge"),
      resultConfirming: t("resultConfirming"),
      send: t("send"),
      serviceUnavailable: t("serviceUnavailable"),
      settlementRelease: {
        amountLabel: t("settlementAmount"),
        cancel: t("settlementCancel"),
        cancelled: t("settlementCancelled"),
        cancelledMessage: (action: AiAssistantSettlementReleaseAction) =>
          t("settlementCancelledMessage", {
            customer: action.customerName,
          }),
        confirmationIntro: t("settlementConfirmationIntro"),
        confirm: t("settlementConfirm"),
        customerLabel: t("settlementCustomer"),
        dateLabel: t("settlementDate"),
        errorMessages: {
          customerChanged: t("settlementErrorCustomerChanged"),
          forbidden: t("settlementErrorForbidden"),
          invalidInput: t("settlementErrorInvalidInput"),
          notSignedIn: t("settlementErrorNotSignedIn"),
          requestConflict: t("settlementErrorRequestConflict"),
          requestTooLarge: t("settlementErrorRequestTooLarge"),
          serviceUnavailable: t("settlementErrorServiceUnavailable"),
        },
        existingCustomer: t("settlementExistingCustomer"),
        guidance: {
          ambiguousCustomer: t("settlementGuidanceAmbiguousCustomer"),
          invalidAmount: t("settlementGuidanceInvalidAmount"),
          invalidCurrency: t("settlementGuidanceInvalidCurrency"),
          invalidDate: t("settlementGuidanceInvalidDate"),
          missingAmount: t("settlementGuidanceMissingAmount"),
          missingCurrency: t("settlementGuidanceMissingCurrency"),
          missingCustomer: t("settlementGuidanceMissingCustomer"),
          multipleAmounts: t("settlementGuidanceMultipleAmounts"),
          notAllowed: t("settlementGuidanceNotAllowed"),
        },
        inputCustomerLabel: t("settlementInputCustomer"),
        noNote: t("settlementNoNote"),
        noteLabel: t("settlementNote"),
        published: t("settlementPublished"),
        publishedMessage: (action: AiAssistantSettlementReleaseAction) =>
          t("settlementPublishedMessage", {
            amount: formatSettlementAmount(action.amount, assistantLocale),
            currency: action.currency,
            customer: action.customerName,
            date: action.receivedOn,
          }),
        publishing: t("settlementPublishing"),
        retry: t("settlementRetry"),
        temporaryCustomer: t("settlementTemporaryCustomer"),
        title: t("settlementTitle"),
      },
      thinking: t("thinking"),
      title: companyText.assistantName,
      tooManyRequests: t("tooManyRequests"),
    }),
    [assistantLocale, companyText.assistantName, t],
  );
}

function formatSettlementAmount(amount: number, locale: AiAssistantLocale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}
