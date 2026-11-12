/** 手机号输入只组合国家区号选择和号码字段；格式规范化与注册提交由上层表单处理。 */
"use client";

import { useMemo } from "react";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown, Phone, Search } from "lucide-react";
import type { CountryCode } from "libphonenumber-js";
import { useLocale, useTranslations } from "next-intl";

import { controlVariants, Field, Input } from "@/components/ui/form-controls";
import type { Locale } from "@/lib/locale";
import { cn } from "@/lib/utils";

import { createPhoneCountryOptions, type PhoneCountryOption } from "./register-phone-utils";

type RegisterPhoneFieldProps = {
  country: CountryCode;
  disabled?: boolean;
  onCountryChange: (country: CountryCode) => void;
  onPhoneChange: (phone: string) => void;
  phone: string;
};

export function RegisterPhoneField({
  country,
  disabled = false,
  onCountryChange,
  onPhoneChange,
  phone,
}: RegisterPhoneFieldProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("RegisterForm");
  const options = useMemo(() => createPhoneCountryOptions(locale), [locale]);
  const selectedOption = options.find((option) => option.country === country) ?? options[0] ?? null;

  return (
    <Field className="sm:col-span-2" hint={t("phoneOptionalHint")} label={t("phone")}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(180px,0.85fr)_minmax(0,1.4fr)]">
        <Combobox.Root<PhoneCountryOption>
          disabled={disabled}
          isItemEqualToValue={(item, value) => item.country === value.country}
          itemToStringLabel={(item) => item.label}
          items={options}
          onValueChange={(value) => {
            if (value) {
              onCountryChange(value.country);
            }
          }}
          value={selectedOption}
        >
          <Combobox.Label className="sr-only">{t("countryCode")}</Combobox.Label>
          <Combobox.Trigger
            className={cn(
              controlVariants({ controlSize: "large" }),
              "flex min-w-0 items-center justify-between gap-3 text-left hover:bg-surface-panel disabled:cursor-wait",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden>{selectedOption?.flag}</span>
              <span className="truncate">+{selectedOption?.callingCode}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-content-muted" />
          </Combobox.Trigger>

          <Combobox.Portal>
            <Combobox.Positioner align="start" className="z-[70]" sideOffset={6}>
              <Combobox.Popup className="w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-[22px] border border-border-subtle bg-surface-overlay p-2 shadow-[var(--surface-shadow-floating)] outline-none backdrop-blur-2xl">
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-content-muted" />
                  <Combobox.Input
                    aria-label={t("countrySearch")}
                    className={cn(controlVariants({ controlSize: "compact" }), "pl-10")}
                    placeholder={t("countrySearchPlaceholder")}
                  />
                </div>
                <Combobox.Empty className="px-4 py-8 text-center text-sm text-content-muted">
                  {t("countryEmpty")}
                </Combobox.Empty>
                <Combobox.List className="max-h-64 overflow-y-auto overscroll-contain py-1">
                  {(option: PhoneCountryOption) => (
                    <Combobox.Item
                      className="flex min-w-0 cursor-default items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm text-content-strong outline-none data-[highlighted]:bg-surface-inset data-[selected]:font-semibold data-[selected]:text-primary"
                      key={option.country}
                      value={option}
                    >
                      <span aria-hidden>{option.flag}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {option.label.replace(` +${option.callingCode}`, "")}
                      </span>
                      <span className="shrink-0 text-content-muted">+{option.callingCode}</span>
                      <Combobox.ItemIndicator className="shrink-0 text-primary">
                        <Check className="size-4" />
                      </Combobox.ItemIndicator>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>

        <div className="min-w-0">
          <div className="group relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4 text-content-subtle transition-colors group-focus-within:text-primary">
              <Phone className="size-4" />
            </span>
            <Input
              autoComplete="tel-national"
              className="min-w-0 pl-12!"
              controlSize="large"
              disabled={disabled}
              inputMode="tel"
              name="phone"
              onChange={(event) => onPhoneChange(event.target.value)}
              placeholder={t("phonePlaceholder")}
              type="tel"
              value={phone}
            />
          </div>
        </div>
      </div>
    </Field>
  );
}
