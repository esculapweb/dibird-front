// "10:30:00" или "10:30" → "10:30"
export const formatTimeString = (value) => {
  if (!value) return "";
  const parts = value.split(":");
  if (parts.length < 2) return value;
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
};

export const dateToTimeString = (date) => {
  if (!date) return null;
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}:00`;
};

export const timeStringToDate = (value) => {
  const base = new Date(); // сегодня
  if (!value) return base;
  const parts = value.split(":");
  base.setHours(parseInt(parts[0], 10) || 0);
  base.setMinutes(parseInt(parts[1], 10) || 0);
  base.setSeconds(0);
  base.setMilliseconds(0);
  return base;
};