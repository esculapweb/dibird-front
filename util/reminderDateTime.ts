import { toDateOnly } from "./helpers";
import { dateToTimeString } from "./timeHelpers";

// A reminder is picked as two fields — DateInput's "YYYY-MM-DD" and
// TimeChip's "HH:mm:ss" — and stored as one ISO moment.

/**
 * Built from parts rather than parsed from "YYYY-MM-DDTHH:mm": the moment the
 * user picked is local wall-clock time, and the string form's timezone
 * handling is exactly what not to rely on.
 */
export const combineReminder = (
  date: string | null,
  time: string | null,
): Date | null => {
  if (!date || !time) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const result = new Date(y, m - 1, d, h, min, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
};

export const splitReminder = (
  iso: string | null | undefined,
): { date: string | null; time: string | null } => {
  const current = iso ? new Date(iso) : null;
  if (!current || Number.isNaN(current.getTime())) return { date: null, time: null };
  return { date: toDateOnly(current), time: dateToTimeString(current) };
};
