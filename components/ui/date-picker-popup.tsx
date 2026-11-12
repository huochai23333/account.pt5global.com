"use client";

import { Popover } from "@base-ui/react/popover";
import type { RefObject } from "react";

import { DatePickerCalendar } from "@/components/ui/date-picker-calendar";
import {
  DatePickerDayFooter,
  DateTimePickerPanel,
  MonthPickerPanel,
  type DatePickerPanelCopy,
} from "@/components/ui/date-picker-panels";
import {
  getShanghaiDatePickerValue,
  type DatePickerLocale,
  type DatePickerMode,
} from "@/components/ui/date-picker-values";
import { cn } from "@/lib/utils";

export type DatePickerPopupLabels = {
  chooseDate: string;
  chooseDateTime: string;
  chooseMonth: string;
  clear: string;
  close: string;
  today: string;
};

type DatePickerPopupProps = {
  anchorRef: RefObject<HTMLDivElement | null>;
  copy: DatePickerPanelCopy;
  currentValue: string;
  dateTimeDraft: string;
  displayMonth: Date;
  labels: DatePickerPopupLabels;
  locale: DatePickerLocale;
  max?: string;
  min?: string;
  mode: DatePickerMode;
  onClose: () => void;
  onCommit: (value: string) => boolean;
  onDateTimeDraftChange: (value: string) => void;
  onDisplayMonthChange: (month: Date) => void;
  required: boolean;
};

/**
 * 这个模块只编排浮层表面和三类选择面板。
 * 输入草稿、表单值与错误仍由 DatePicker 主组件管理，避免面板反向拥有业务状态。
 */
export function DatePickerPopup({
  anchorRef,
  copy,
  currentValue,
  dateTimeDraft,
  displayMonth,
  labels,
  locale,
  max,
  min,
  mode,
  onClose,
  onCommit,
  onDateTimeDraftChange,
  onDisplayMonthChange,
  required,
}: DatePickerPopupProps) {
  const title =
    mode === "month"
      ? labels.chooseMonth
      : mode === "datetime-local"
        ? labels.chooseDateTime
        : labels.chooseDate;
  const commitAndClose = (nextValue: string) => {
    if (onCommit(nextValue)) onClose();
  };

  return (
    <Popover.Portal>
      <Popover.Positioner
        align="start"
        anchor={anchorRef}
        className="z-[65] max-w-[calc(100vw-1.5rem)] outline-none"
        collisionAvoidance={{
          align: "shift",
          fallbackAxisSide: "none",
          side: "flip",
        }}
        collisionPadding={12}
        sideOffset={8}
      >
        <Popover.Popup
          aria-label={title}
          className={cn(
            "max-h-[min(38rem,var(--available-height))] w-[min(22rem,calc(100vw-1.5rem))] origin-[var(--transform-origin)] overflow-y-auto overscroll-contain rounded-[18px] border border-border-subtle bg-surface-overlay p-3 text-popover-foreground shadow-[var(--surface-shadow-floating)] outline-none backdrop-blur-2xl backdrop-saturate-150",
            "transition-[opacity,transform] duration-200 data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0 data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0 motion-reduce:transition-none",
          )}
          data-mode={mode}
          data-slot="date-picker-popup"
          initialFocus={false}
        >
          <Popover.Title className="sr-only">{title}</Popover.Title>
          <Popover.Close className="sr-only">{labels.close}</Popover.Close>
          {mode === "month" ? (
            <MonthPickerPanel
              copy={copy}
              displayYear={displayMonth.getFullYear()}
              locale={locale}
              max={max}
              min={min}
              onDisplayYearChange={(year) => onDisplayMonthChange(new Date(year, 0, 1))}
              onSelect={commitAndClose}
              selectedValue={currentValue}
            />
          ) : mode === "datetime-local" ? (
            <DateTimePickerPanel
              copy={copy}
              displayMonth={displayMonth}
              draftValue={dateTimeDraft}
              locale={locale}
              max={max}
              min={min}
              onCancel={onClose}
              onClear={required ? null : () => commitAndClose("")}
              onComplete={commitAndClose}
              onDisplayMonthChange={onDisplayMonthChange}
              onDraftChange={onDateTimeDraftChange}
            />
          ) : (
            <>
              <DatePickerCalendar
                copy={copy}
                displayMonth={displayMonth}
                locale={locale}
                max={max}
                min={min}
                onDisplayMonthChange={onDisplayMonthChange}
                onSelect={commitAndClose}
                selectedValue={currentValue}
              />
              <DatePickerDayFooter
                clearLabel={labels.clear}
                onClear={required ? null : () => commitAndClose("")}
                onToday={() => commitAndClose(getShanghaiDatePickerValue("date"))}
                todayLabel={labels.today}
              />
            </>
          )}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}
