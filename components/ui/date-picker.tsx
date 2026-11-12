"use client";

import { Popover } from "@base-ui/react/popover";
import type { VariantProps } from "class-variance-authority";
import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type AriaAttributes,
  type KeyboardEvent,
} from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import {
  DatePickerPopup,
  type DatePickerPopupLabels,
} from "@/components/ui/date-picker-popup";
import type { DatePickerPanelCopy } from "@/components/ui/date-picker-panels";
import {
  formatDatePickerValue,
  getDatePickerPlaceholder,
  getInitialDatePickerMonth,
  getInitialDateTimeDraft,
  getShanghaiDatePickerValue,
  isCanonicalDatePickerValue,
  normalizeDatePickerLocale,
  type DatePickerMode,
} from "@/components/ui/date-picker-values";
import { controlVariants, Input } from "@/components/ui/form-controls";
import {
  useFormFieldControlAttributes,
  useFormFieldRequired,
} from "@/components/ui/form-field-context";
import { useDatePickerField } from "@/components/ui/use-date-picker-field";
import { cn } from "@/lib/utils";

export type DatePickerProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  "aria-required"?: AriaAttributes["aria-required"];
  "aria-label"?: string;
  "data-testid"?: string;
  className?: string;
  controlSize?: VariantProps<typeof controlVariants>["controlSize"];
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  max?: string;
  min?: string;
  mode?: DatePickerMode;
  name?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  value?: string;
};

/**
 * 全站唯一的日期族控件。
 *
 * 可见 Input 负责键盘输入和原生表单校验，隐藏 input 只提交稳定业务值；
 * 弹层只操作同一个值，因此业务页面不需要分别维护文本、日历和 FormData 三套状态。
 */
export function DatePicker({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
  className,
  controlSize,
  defaultValue = "",
  disabled = false,
  id,
  max,
  min,
  mode = "date",
  name,
  onValueChange,
  placeholder,
  readOnly = false,
  required,
  value,
}: DatePickerProps) {
  const t = useTranslations("DatePicker");
  const resolvedRequired = useFormFieldRequired(required);
  const locale = normalizeDatePickerLocale(useLocale());
  const editable = !disabled && !readOnly;
  const {
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
  } = useDatePickerField({
    defaultValue,
    editable,
    locale,
    max,
    min,
    mode,
    onValueChange,
    resolvedRequired,
    value,
  });
  const restoreFocusRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() =>
    getInitialDatePickerMonth(currentValue, mode),
  );
  const [dateTimeDraft, setDateTimeDraft] = useState(() =>
    getInitialDateTimeDraft(currentValue),
  );
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const errorId = `${useId()}-error`;
  const fieldAttributes = useFormFieldControlAttributes({
    ariaDescribedBy,
    ariaInvalid,
    ariaRequired,
    id,
  });
  const describedBy =
    [fieldAttributes["aria-describedby"], error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const copy: DatePickerPanelCopy = {
    cancel: t("cancel"),
    clear: t("clear"),
    complete: t("complete"),
    hour: t("hour"),
    minute: t("minute"),
    monthLabel: t("monthLabel"),
    nextMonth: t("nextMonth"),
    now: t("now"),
    previousMonth: t("previousMonth"),
    yearLabel: t("yearLabel"),
  };
  const popupLabels: DatePickerPopupLabels = {
    chooseDate: t("chooseDate"),
    chooseDateTime: t("chooseDateTime"),
    chooseMonth: t("chooseMonth"),
    clear: t("clear"),
    close: t("close"),
    today: t("today"),
  };

  const closeAndRestoreFocus = useCallback(() => {
    restoreFocusRef.current = true;
    setOpen(false);
  }, []);

  return (
    <Popover.Root
      modal="trap-focus"
      onOpenChange={(nextOpen, details) => {
        if (!editable) return;
        if (nextOpen) preparePanel();
        if (!nextOpen && details.reason === "escape-key") {
          // Escape 关闭浮层时，同时丢弃尚未提交的键盘草稿，回到最后一个有效业务值。
          resetInput();
          setDateTimeDraft(getInitialDateTimeDraft(currentValue));
          restoreFocusRef.current = true;
        }
        setOpen(nextOpen);
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen && restoreFocusRef.current) {
          restoreFocusRef.current = false;
          inputRef.current?.focus();
        }
      }}
      open={open}
    >
      <div
        className={cn("grid min-w-0 gap-1.5", className)}
        data-slot="date-picker-root"
      >
        <div className="relative min-w-0" ref={anchorRef}>
          <Input
            {...fieldAttributes}
            aria-describedby={describedBy}
            aria-haspopup="dialog"
            aria-invalid={Boolean(error) || fieldAttributes["aria-invalid"]}
            aria-label={ariaLabel}
            aria-required={resolvedRequired || undefined}
            className="pr-12"
            controlSize={controlSize}
            data-mode={mode}
            data-testid={dataTestId}
            data-value={currentValue}
            disabled={disabled}
            inputMode="numeric"
            onBlur={handleBlur}
            onChange={(event) => handleChange(event.target.value)}
            onFocus={handleFocus}
            onInvalid={handleInvalid}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder ?? getDatePickerPlaceholder(mode, locale)}
            readOnly={readOnly}
            ref={inputRef}
            required={resolvedRequired}
            type="text"
            value={inputText}
          />
          <Popover.Trigger
            aria-label={t(
              mode === "month"
                ? "openMonth"
                : mode === "datetime-local"
                  ? "openDateTime"
                  : "openDate",
            )}
            className={cn(
              buttonVariants({ size: "icon-compact", variant: "ghost" }),
              "absolute top-1/2 right-0.5 -translate-y-1/2",
            )}
            disabled={disabled || readOnly}
            type="button"
          >
            <CalendarDays aria-hidden="true" className="size-4" />
          </Popover.Trigger>
        </div>
        {name ? (
          <input
            disabled={disabled}
            name={name}
            type="hidden"
            value={currentValue}
          />
        ) : null}
        {error ? (
          <p
            aria-live="polite"
            className="px-1 text-xs leading-5 text-status-danger"
            id={errorId}
          >
            {error}
          </p>
        ) : null}
      </div>

      <DatePickerPopup
        anchorRef={anchorRef}
        copy={copy}
        currentValue={currentValue}
        dateTimeDraft={dateTimeDraft}
        displayMonth={displayMonth}
        labels={popupLabels}
        locale={locale}
        max={max}
        min={min}
        mode={mode}
        onClose={closeAndRestoreFocus}
        onCommit={commitCanonicalValue}
        onDateTimeDraftChange={setDateTimeDraft}
        onDisplayMonthChange={setDisplayMonth}
        required={resolvedRequired}
      />
    </Popover.Root>
  );

  function preparePanel() {
    const seed =
      currentValue && isCanonicalDatePickerValue(currentValue, mode)
        ? currentValue
        : getShanghaiDatePickerValue(mode);
    setDisplayMonth(getInitialDatePickerMonth(seed, mode));
    setDateTimeDraft(getInitialDateTimeDraft(seed));
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 快捷键和按钮使用同一编辑权限，固定时间不能从键盘打开日历。
    if (!editable) return;
    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault();
      preparePanel();
      setOpen(true);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commitInputText();
      return;
    }
    if (
      event.key === "Escape" &&
      inputText !== formatDatePickerValue(currentValue, mode, locale)
    ) {
      event.preventDefault();
      event.stopPropagation();
      resetInput();
    }
  }
}
