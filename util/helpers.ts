import { Config } from "../constants/config";
import i18n from "../services/i18n";
import { buildDeepLinkParams } from "./buildDeepLinkParams";
import { DateFilter, Filters } from "../types";

export const isoToFlagEmoji = (isoCode: string | null): string => {
  if (!isoCode) return "";
  return isoCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
};

export const formatDate = (
  isoDate: string | Date | null | undefined,
): string => {
  if (!isoDate) return "";
  const d = isoDate instanceof Date ? isoDate : new Date(isoDate);
  return new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(d);
};

export const formatDateLong = (
  isoDate: string | Date | null | undefined,
): string => {
  const date = isoDate ? new Date(isoDate) : null;
  return date
    ? date.toLocaleDateString(i18n.language, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
};

export const formatDateTime = (
  isoDate: string | Date | null | undefined,
): string => {
  if (!isoDate) return "";
  const d = isoDate instanceof Date ? isoDate : new Date(isoDate);
  return new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

export const formatDateFilterMain = (value: DateFilter): string => {
  if (value?.type === "range") {
    if (value?.from && value?.to)
      return `${formatDate(value?.from)} – ${formatDate(value?.to)}`;

    if (value?.from) return `${i18n.t("from")} ${formatDate(value?.from)}`;
    if (value?.to) return `${i18n.t("to")} ${formatDate(value?.to)}`;
  }
  if (value?.type === "year" && value?.year) return value.year.toString();
  if (value?.type === "today") return i18n.t("today");
  if (value?.type === "this_year") return i18n.t("this_year");

  return i18n.t("all_period");
};

export const formatDateFilterCheckboxHero = (value: DateFilter): string => {
  if (value?.type === "range") {
    if (value?.from && value?.to)
      return `${formatDate(value?.from)} – ${formatDate(value?.to)}`;

    if (value?.from) return `${i18n.t("from")} ${formatDate(value?.from)}`;
    if (value?.to) return `${i18n.t("to")} ${formatDate(value?.to)}`;
  }
  if (value?.type === "year" && value?.year) return value.year.toString();
  if (value?.type === "today") return i18n.t("today");
  if (value?.type === "this_year") return String(new Date().getFullYear());

  return i18n.t("all_period");
};

export const normalizeValue = (
  value: string | null | undefined,
  allowed_values: string[],
): string => {
  if (!value) return allowed_values[0];
  if (!allowed_values.includes(value)) return allowed_values[0];
  return value;
};

const addOneDay = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return toDateOnly(d);
};

export const toDateOnly = (
  date: Date | string | null | undefined,
): string | null => {
  if (!date) return null;
  const d =
    date instanceof Date
      ? date
      : new Date(
          typeof date === "string" && !date.includes("T")
            ? date + "T00:00:00"
            : date,
        );
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildDateParams = (
  date: DateFilter | null | undefined,
): Record<string, string | null> => {
  if (!date || date.type === "any") return {};

  switch (date.type) {
    case "today": {
      const today = toDateOnly(new Date());
      return { date_time_min: today, date_time_max: addOneDay(today) };
    }
    case "this_year": {
      const year = new Date().getFullYear();
      return {
        date_time_min: `${year}-01-01`,
        date_time_max: `${year + 1}-01-01`, // чище чем +1 день к 12-31
      };
    }
    case "year": {
      if (!date.year) return {};
      const y = date.year;
      return {
        date_time_min: `${y}-01-01`,
        date_time_max: `${y + 1}-01-01`,
      };
    }
    case "range": {
      return {
        ...(date.from && { date_time_min: date.from }),
        ...(date.to && { date_time_max: addOneDay(date.to) }),
      };
    }
    default:
      return {};
  }
};

export const cleanFilters = (filters: Filters): Filters =>
  Object.fromEntries(Object.entries(filters).filter(([_, v]) => v != null));

export const langBaseUrl = () => {
  const lang = i18n.language || "en";
  if (i18n.language === "en") return Config.baseUrl;
  return `${Config.baseUrl}/${lang}`;
};

export const buildShareUrl = (
  path: string,
  filters: Filters | null = null,
  sort: string | null = null,
): string => {
  const base = `${langBaseUrl()}/${path}`;

  if (!filters && !sort) return base;

  const params = {
    ...(buildDeepLinkParams(filters, sort) || {}),
    share: 1,
  };

  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return query ? `${base}?${query}` : base;
};

export const formatDateShort = (
  dateStr: string | null,
): { d: string; y: string } | null => {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  const d = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    month: "short",
  }).format(date);

  return {
    d,
    y: String(date.getFullYear()),
  };
};

export const formatMonthLabel = (isoStr: string | null | undefined): string => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString(i18n.language, {
    month: "short",
    year: "numeric",
  });
};

export const formatDayLabel = (isoStr: string | null | undefined): string => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "short",
  });
};

export const stableStringify = (
  obj: Record<string, unknown> | null | undefined,
): string | null => {
  if (!obj) return null;

  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const value = obj[key];

        if (value !== undefined) {
          acc[key] = value;
        }

        return acc;
      }, {}),
  );
};
