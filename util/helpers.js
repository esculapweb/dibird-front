import { Config } from "../constants/config";
import i18n from "../services/i18n";
import { buildDeepLinkParams } from "./buildDeepLinkParams";

export const isoToFlagEmoji = (isoCode) => {
  if (!isoCode) return "";
  return isoCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt()));
};

export const formatDate = (isoDate) => {
  if (!isoDate) return "";
  const d = isoDate instanceof Date ? isoDate : new Date(isoDate);
  return new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(d);
};

export const formatDateLong = (isoDate) => {
  const date = isoDate ? new Date(isoDate) : null;
  return date
    ? date.toLocaleDateString(i18n.language, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
};

export const formatDateTime = (isoDate) => {
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

export const formatDateFilterMain = (value) => {
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

export const formatDateFilterCheckboxHero = (value) => {
  if (value?.type === "range") {
    if (value?.from && value?.to)
      return `${formatDate(value?.from)} – ${formatDate(value?.to)}`;

    if (value?.from) return `${i18n.t("from")} ${formatDate(value?.from)}`;
    if (value?.to) return `${i18n.t("to")} ${formatDate(value?.to)}`;
  }
  if (value?.type === "year" && value?.year) return value.year.toString();
  if (value?.type === "today") return i18n.t("today");
  if (value?.type === "this_year") return new Date().getFullYear();

  return i18n.t("all_period");
};

export const normalizeValue = (value, allowed_values) => {
  if (!value) return allowed_values[0];
  if (!allowed_values.includes(value)) return allowed_values[0];
  return value;
};

const addOneDay = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return toDateOnly(d);
};

export const toDateOnly = (date) => {
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

export const buildDateParams = (date) => {
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

export const cleanFilters = (filters) =>
  Object.fromEntries(Object.entries(filters).filter(([_, v]) => v != null));

export const langBaseUrl = () => {
  const lang = i18n.language || "en";
  if (i18n.language === "en") return Config.baseUrl;
  return `${Config.baseUrl}/${lang}`;
};

export const buildShareUrl = (path, filters = null, sort = null) => {
  const base = `${langBaseUrl()}/${path}`;

  if (!filters && !sort) return base;

  const params = {
    ...(buildDeepLinkParams(filters, sort) || {}),
    share: 1,
  };

  const query = new URLSearchParams(params).toString();

  return query ? `${base}?${query}` : base;
};

export const formatDateShort = (dateStr) => {
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

export const formatMonthLabel = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString(i18n.language, { month: "short", year: "numeric" });
};

export const formatDayLabel = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString(i18n.language, { day: "numeric", month: "short" });
};

export const stableStringify = (obj) => {
  if (!obj) return null;

  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        const value = obj[key];

        if (value !== undefined) {
          acc[key] = value;
        }

        return acc;
      }, {}),
  );
};
