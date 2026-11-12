"use client";

import { DayPicker, type Matcher } from "@daypicker/react";
import { enUS, zhCN } from "@daypicker/react/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  datePickerValueToDate,
  dateToDatePickerValue,
  getDatePickerYearRange,
  type DatePickerLocale,
} from "@/components/ui/date-picker-values";

export type DatePickerCalendarCopy = {
  monthLabel: string;
  nextMonth: string;
  previousMonth: string;
  yearLabel: string;
};

type DatePickerCalendarProps = {
  copy: DatePickerCalendarCopy;
  displayMonth: Date;
  locale: DatePickerLocale;
  max?: string;
  min?: string;
  onDisplayMonthChange: (month: Date) => void;
  onSelect: (value: string) => void;
  selectedValue: string;
};

/**
 * 这层只负责“某一天”的日历网格与月份导航。
 * 日期文本解析、表单提交和日期时间的小时分钟选择都留在其他模块，避免日历组件承担业务状态。
 */
export function DatePickerCalendar({
  copy,
  displayMonth,
  locale,
  max,
  min,
  onDisplayMonthChange,
  onSelect,
  selectedValue,
}: DatePickerCalendarProps) {
  const selected = datePickerValueToDate(selectedValue);
  const minDate = min ? datePickerValueToDate(min) : undefined;
  const maxDate = max ? datePickerValueToDate(max) : undefined;
  // 上下限只生成最多两个匹配器，直接创建比为一个微小数组维护复杂依赖更清楚。
  const disabled: Matcher[] = [];
  if (minDate) disabled.push({ before: minDate });
  if (maxDate) disabled.push({ after: maxDate });

  return (
    <div className="grid gap-3" data-slot="date-picker-calendar">
      <CalendarNavigation
        copy={copy}
        displayMonth={displayMonth}
        locale={locale}
        max={max}
        min={min}
        onDisplayMonthChange={onDisplayMonthChange}
      />
      <DayPicker
        autoFocus
        classNames={{
          caption_label: "sr-only",
          day: "p-0.5 text-center",
          day_button:
            "mx-auto flex size-11 cursor-pointer items-center justify-center rounded-[12px] text-sm text-content-strong outline-none transition sm:size-10 hover:bg-surface-inset focus-visible:ring-4 focus-visible:ring-ring",
          disabled: "opacity-35 [&_button]:pointer-events-none [&_button]:cursor-not-allowed",
          month: "w-full",
          month_caption: "sr-only",
          month_grid: "w-full border-collapse",
          months: "w-full",
          outside: "opacity-45",
          root: "w-full",
          selected:
            "[&_button]:bg-surface-brand-soft [&_button]:font-semibold [&_button]:text-primary",
          today: "[&_button]:border [&_button]:border-filter-control-hover [&_button]:text-primary",
          weekday: "pb-2 text-center text-[11px] font-semibold text-content-muted",
          weekdays: "border-b border-border-subtle",
        }}
        disabled={disabled}
        fixedWeeks
        hideNavigation
        locale={locale === "zh" ? zhCN : enUS}
        mode="single"
        month={displayMonth}
        onMonthChange={onDisplayMonthChange}
        onSelect={(date) => {
          if (date) onSelect(dateToDatePickerValue(date));
        }}
        selected={selected}
        showOutsideDays
        weekStartsOn={locale === "zh" ? 1 : 0}
      />
    </div>
  );
}

function CalendarNavigation({
  copy,
  displayMonth,
  locale,
  max,
  min,
  onDisplayMonthChange,
}: Omit<DatePickerCalendarProps, "onSelect" | "selectedValue">) {
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const yearRange = getDatePickerYearRange(year, min, max);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        label: new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
          month: "long",
        }).format(new Date(2020, index, 1)),
        value: String(index),
      })),
    [locale],
  );
  const yearOptions = useMemo(
    () =>
      Array.from({ length: yearRange.end - yearRange.start + 1 }, (_, index) => {
        const value = String(yearRange.start + index);
        return { label: locale === "zh" ? `${value}年` : value, value };
      }),
    [locale, yearRange.end, yearRange.start],
  );
  const previousMonth = moveMonth(displayMonth, -1);
  const nextMonth = moveMonth(displayMonth, 1);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        aria-label={copy.previousMonth}
        disabled={!isMonthWithinBounds(previousMonth, min, max)}
        onClick={() => onDisplayMonthChange(previousMonth)}
        size="icon-compact"
        type="button"
        variant="ghost"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Select
        aria-label={copy.monthLabel}
        className="min-w-0 flex-1"
        controlSize="compact"
        onValueChange={(value) =>
          onDisplayMonthChange(clampMonth(new Date(year, Number(value), 1), min, max))
        }
        options={monthOptions}
        value={String(month)}
      />
      <Select
        aria-label={copy.yearLabel}
        className="w-[7.25rem] shrink-0"
        controlSize="compact"
        onValueChange={(value) =>
          onDisplayMonthChange(clampMonth(new Date(Number(value), month, 1), min, max))
        }
        options={yearOptions}
        value={String(year)}
      />
      <Button
        aria-label={copy.nextMonth}
        disabled={!isMonthWithinBounds(nextMonth, min, max)}
        onClick={() => onDisplayMonthChange(nextMonth)}
        size="icon-compact"
        type="button"
        variant="ghost"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

function moveMonth(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function clampMonth(value: Date, min: string | undefined, max: string | undefined) {
  const key = getMonthKey(value);
  const minMonth = min?.slice(0, 7);
  const maxMonth = max?.slice(0, 7);
  if (minMonth && key < minMonth) return datePickerValueToDate(`${minMonth}-01`) ?? value;
  if (maxMonth && key > maxMonth) return datePickerValueToDate(`${maxMonth}-01`) ?? value;
  return value;
}

function isMonthWithinBounds(value: Date, min: string | undefined, max: string | undefined) {
  const key = getMonthKey(value);
  return (!min || key >= min.slice(0, 7)) && (!max || key <= max.slice(0, 7));
}

function getMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}
