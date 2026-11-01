import { combineReminder, splitReminder } from "../reminderDateTime";

describe("combineReminder", () => {
  it("reads the two fields as local wall-clock time", () => {
    expect(combineReminder("2099-05-01", "07:30:00")).toEqual(
      new Date(2099, 4, 1, 7, 30, 0, 0),
    );
  });

  it.each([
    [null, "07:30:00"],
    ["2099-05-01", null],
    ["garbage", "07:30:00"],
  ])("is no moment at all for %p / %p", (date, time) => {
    expect(combineReminder(date, time)).toBeNull();
  });
});

describe("splitReminder", () => {
  it("is the inverse of combineReminder", () => {
    const iso = new Date(2099, 4, 1, 7, 30).toISOString();

    expect(splitReminder(iso)).toEqual({ date: "2099-05-01", time: "07:30:00" });
  });

  it.each([[null], [undefined], ["not a date"]])("leaves both fields empty for %p", (iso) => {
    expect(splitReminder(iso)).toEqual({ date: null, time: null });
  });
});
