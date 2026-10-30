import type { TFunction } from "i18next";

import i18n from "../services/i18n";
import { ActivityGroup, ActivityResponse } from "../types";
import { toDateOnly } from "./helpers";

// Period starts come from the server (ActivityResponse.periods). Date-only
// strings are parsed as local midnight: `new Date("2026-05-01")` is UTC
// midnight and would render as April 30 west of Greenwich.
const parseDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);

const minusOneDay = (iso: string) => {
  const d = parseDay(iso);
  d.setDate(d.getDate() - 1);
  return toDateOnly(d) as string;
};

const formatDay = (iso: string) =>
  parseDay(iso).toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "short",
  });

// Hourly starts carry the profile's local time with its offset
// ("2026-05-01T07:00:00+03:00"). The wall-clock part is read off the string
// as is: converting through Date would shift it into the device's zone.
const formatHour = (iso: string) => iso.slice(11, 16);

// Inclusive date range a column covers — what a DateFilter "range" expects
// (buildDateParams adds the exclusive day itself). An hourly column opens its
// whole day: the lists filter by date, not by hour.
export const periodRange = (
  periods: string[],
  index: number,
  group: ActivityGroup,
  lastDay: string,
): { from: string; to: string } => {
  const from = periods[index].slice(0, 10);
  if (group === "hour") return { from, to: from };
  const next = periods[index + 1];
  return { from, to: next ? minusOneDay(next) : lastDay };
};

// Full label for the selected column and the top list.
export const formatPeriodLabel = (
  periods: string[],
  index: number,
  group: ActivityGroup,
  lastDay: string,
): string => {
  const start = periods[index];
  switch (group) {
    case "hour": {
      const next = periods[index + 1];
      const end = next ? formatHour(next) : "";
      return `${formatDay(start)}, ${formatHour(start)}${end ? `–${end}` : ""}`;
    }
    case "day":
      return parseDay(start).toLocaleDateString(i18n.language, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    case "week": {
      const { from, to } = periodRange(periods, index, group, lastDay);
      return from === to
        ? formatDay(from)
        : `${formatDay(from)} – ${formatDay(to)}`;
    }
    case "month":
      return parseDay(start).toLocaleDateString(i18n.language, {
        month: "long",
        year: "numeric",
      });
    case "year":
      return start.slice(0, 4);
  }
};

// Short label under the X axis.
export const formatAxisLabel = (start: string, group: ActivityGroup): string => {
  switch (group) {
    case "hour":
      return formatHour(start);
    case "day":
    case "week":
      return formatDay(start);
    case "month":
      return parseDay(start).toLocaleDateString(i18n.language, {
        month: "short",
      });
    case "year":
      return start.slice(0, 4);
  }
};

// Which columns get an X-axis label: about `maxLabels` of them, counted from
// the end so the latest column — the one the eye goes to — is always labelled.
export const axisLabelIndexes = (count: number, maxLabels = 5): number[] => {
  if (count <= 0) return [];
  const step = Math.max(1, Math.ceil(count / maxLabels));
  const result: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) result.unshift(i);
  return result;
};

// Busiest columns first; on a tie the more recent one wins. Empty columns
// never make the list.
export const topPeriodIndexes = (data: number[], limit = 5): number[] =>
  data
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value > 0)
    .sort((a, b) => b.value - a.value || b.index - a.index)
    .slice(0, limit)
    .map(({ index }) => index);

// What the delta is measured over ("last 7 days"), or null when there is
// nothing to compare. Responses without delta_window (an older backend or
// offline cache) still carry the old bucket-based key.
export const deltaWindowLabel = (
  t: TFunction,
  meta: Partial<ActivityResponse["meta"]>,
): string | null => {
  const window = meta.delta_window;
  if (window === undefined)
    return meta.delta_label_key
      ? t(meta.delta_label_key, { n: meta.recent_window })
      : null;
  if (!window) return null;
  return window.unit === "hours"
    ? t("activity_delta_hours", { count: window.n })
    : t("activity_delta_days", { count: window.n });
};

// Round the Y-axis maximum up to 1/2/4/6/8 × 10^k: the gridline labels read
// as round numbers, and (above 1) the middle line lands on a whole one.
export const niceMax = (max: number): number => {
  if (max <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 4, 6, 8, 10]) {
    if (m * power >= max) return m * power;
  }
  return 10 * power;
};
