"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatDatePickerValue,
  isCanonicalDatePickerValue,
  isDatePickerValueWithinBounds,
  parseDatePickerInput,
  type DatePickerLocale,
  type DatePickerMode,
} from "@/components/ui/date-picker-values";

type DatePickerFieldOptions = {
  defaultValue: string;
  editable: boolean;
  locale: DatePickerLocale;
  max?: string;
  min?: string;
  mode: DatePickerMode;
  onValueChange?: (value: string) => void;
  resolvedRequired: boolean;
  value?: string;
};

/** 可见草稿与规范值分开。只有通过校验的日期才会更新表单值。 */
export function useDatePickerField({
  defaultValue,
  editable,
  locale,
  max,
  min,
  mode,
  onValueChange,
  resolvedRequired,
  value,
}: DatePickerFieldOptions) {
  const t = useTranslations("DatePicker");
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;
  const [inputText, setInputText] = useState(() =>
    formatDatePickerValue(currentValue, mode, locale),
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputFocusedRef = useRef(false);
  const inputDraftRef = useRef(false);

  const updateValue = useCallback(
    (nextValue: string) => {
      if (value === undefined) setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  const showError = useCallback((message: string | null) => {
    setError(message);
    inputRef.current?.setCustomValidity(message ?? "");
  }, []);

  const commitCanonicalValue = useCallback(
    (nextValue: string) => {
      if (!nextValue) {
        inputDraftRef.current = false;
        setInputText("");
        showError(resolvedRequired ? t("required") : null);
        // 必填字段清空后保留最后一个有效业务值，只让可见输入进入无效状态；
        // 这样隐藏 FormData 不会短暂污染筛选条件，同时浏览器仍会阻止表单提交。
        if (!resolvedRequired && currentValue) updateValue("");
        return !resolvedRequired;
      }
      if (
        !isCanonicalDatePickerValue(nextValue, mode) ||
        !isDatePickerValueWithinBounds(nextValue, min, max)
      ) {
        showError(
          isCanonicalDatePickerValue(nextValue, mode)
            ? t("outOfRange")
            : t(
                mode === "month"
                  ? "invalidMonth"
                  : mode === "datetime-local"
                    ? "invalidDateTime"
                    : "invalidDate",
              ),
        );
        return false;
      }

      // 仅在规范值真正变化时通知业务层，避免用户只是打开日历就重复触发筛选或查询。
      if (nextValue !== currentValue) updateValue(nextValue);
      inputDraftRef.current = false;
      setInputText(formatDatePickerValue(nextValue, mode, locale));
      showError(null);
      return true;
    },
    [
      currentValue,
      locale,
      max,
      min,
      mode,
      resolvedRequired,
      showError,
      t,
      updateValue,
    ],
  );

  const commitInputText = useCallback(() => {
    const parsed = parseDatePickerInput(inputText, mode, locale);
    if (parsed === null) {
      showError(
        t(
          mode === "month"
            ? "invalidMonth"
            : mode === "datetime-local"
              ? "invalidDateTime"
              : "invalidDate",
        ),
      );
      return false;
    }
    return commitCanonicalValue(parsed);
  }, [commitCanonicalValue, inputText, locale, mode, showError, t]);

  useEffect(() => {
    // 用户正在输入但尚未确认时，外部筛选查询可能先返回旧值。
    // 此时保留输入草稿；等失焦、回车、日历确认或重置后，再接受受控值同步。
    if (inputFocusedRef.current && inputDraftRef.current) return;
    inputDraftRef.current = false;
    setInputText(formatDatePickerValue(currentValue, mode, locale));
    showError(null);
  }, [currentValue, locale, mode, showError]);

  useEffect(() => {
    if (value !== undefined) return;
    const form = inputRef.current?.form;
    if (!form) return;

    const handleReset = () => {
      inputDraftRef.current = false;
      setInternalValue(defaultValue);
      setInputText(formatDatePickerValue(defaultValue, mode, locale));
      showError(null);
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [defaultValue, locale, mode, showError, value]);

  function resetInput() {
    inputDraftRef.current = false;
    setInputText(formatDatePickerValue(currentValue, mode, locale));
    showError(null);
  }

  function handleBlur() {
    if (editable) commitInputText();
    inputFocusedRef.current = false;
  }
  function handleChange(text: string) {
    inputDraftRef.current = true;
    setInputText(text);
    showError(null);
  }
  function handleFocus() {
    inputFocusedRef.current = true;
  }
  function handleInvalid() {
    // 保留浏览器把焦点带回第一个无效字段的默认行为，同时显示系统内一致的错误说明。
    const invalidKey =
      mode === "month"
        ? "invalidMonth"
        : mode === "datetime-local"
          ? "invalidDateTime"
          : "invalidDate";
    showError(inputText.trim() ? t(invalidKey) : t("required"));
  }

  return {
    currentValue,
    inputText,
    error,
    inputRef,
    commitCanonicalValue,
    commitInputText,
    resetInput,
    handleBlur,
    handleChange,
    handleFocus,
    handleInvalid,
  };
}
