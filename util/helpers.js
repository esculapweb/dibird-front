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

export const normalizeValue = (value, allowed_values) => {
  if (!value) return allowed_values[0];
  if (!allowed_values.includes(value)) return allowed_values[0];
  return value;
};

const toDateOnly = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

export const buildDateParams = (date) => {
  if (!date || date.type === "any") return {};

  switch (date.type) {
    case "today":
      return {
        date_time_min: toDateOnly(new Date()) + " 00:00:00",
        date_time_max: toDateOnly(new Date()) + " 23:59:59",
      };
    case "this_year": {
      const now = new Date();
      const year = now.getFullYear();

      return {
        date_time_min: `${year}-01-01 00:00:00`,
        date_time_max: `${year}-12-31 23:59:59`,
      };
    }
    case "year":
      return {
        date_time_min: `${date.year}-01-01 00:00:00`,
        date_time_max: `${date.year}-12-31 23:59:59`,
      };

    case "range":
      return {
        ...(date.from && {
          date_time_min: `${toDateOnly(date.from)} 00:00:00`,
        }),
        ...(date.to && { date_time_max: `${toDateOnly(date.to)} 23:59:59` }),
      };

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
