// "10:30:00" или "10:30" → "10:30"
export const formatTimeString = (value) => {
  if (!value) return "";
  const parts = value.split(":");
  if (parts.length < 2) return value;
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
};

// Date → "10:30:00" (формат для сервера/хранения)
export const dateToTimeString = (date) => {
  if (!date) return null;
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}:00`;
};

// "10:30:00" или "10:30" → Date (только часы/минуты, дата фиксирована)
export const timeStringToDate = (value) => {
  if (!value) return new Date();
  const parts = value.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return new Date(2000, 0, 1, h, m);
};