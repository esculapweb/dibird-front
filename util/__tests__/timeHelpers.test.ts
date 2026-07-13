import {
  formatTimeString,
  dateToTimeString,
  timeStringToDate,
} from "../timeHelpers";

describe("formatTimeString", () => {
  it("returns an empty string for undefined input", () => {
    expect(formatTimeString(undefined)).toBe("");
  });

  it("pads single-digit hours and minutes", () => {
    expect(formatTimeString("9:5")).toBe("09:05");
  });

  it("returns the value unchanged if it has no separator", () => {
    expect(formatTimeString("930")).toBe("930");
  });
});

describe("dateToTimeString", () => {
  it("returns null for undefined input", () => {
    expect(dateToTimeString(undefined)).toBeNull();
  });

  it("formats a date as zero-padded HH:MM:00", () => {
    const date = new Date(2026, 0, 1, 9, 5);
    expect(dateToTimeString(date)).toBe("09:05:00");
  });
});

describe("timeStringToDate", () => {
  it("returns a Date instance for undefined input", () => {
    expect(timeStringToDate(undefined)).toBeInstanceOf(Date);
  });

  it("parses a valid time string into hours/minutes/seconds", () => {
    const date = timeStringToDate("14:30");
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
    expect(date.getSeconds()).toBe(0);
    expect(date.getMilliseconds()).toBe(0);
  });
});
