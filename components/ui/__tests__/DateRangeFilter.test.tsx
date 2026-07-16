jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));

const mockRadioGroupCapture = jest.fn();
jest.mock("../RadioGroup", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockRadioGroupCapture(props);
    return null;
  },
}));
const mockDropdownCapture = jest.fn();
jest.mock("../DropdownInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDropdownCapture(props);
    return null;
  },
}));
const mockDateInputCapture = jest.fn();
jest.mock("../DateInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDateInputCapture(props);
    return null;
  },
}));

import { render, screen } from "@testing-library/react-native";
import DateRangeFilter from "../DateRangeFilter";

const mockSetDateFilter = jest.fn();

const radioProps = () => mockRadioGroupCapture.mock.calls.at(-1)![0] as {
  value: string;
  onChange: (v: string) => void;
};
const dropdownProps = () => mockDropdownCapture.mock.calls.at(-1)![0] as {
  value: number | null;
  setValue: (v: number | null) => void;
  query: { data: { label: string; value: number }[] };
};
const dateInputPropsAt = (index: number) =>
  mockDateInputCapture.mock.calls[index][0] as {
    value: string | null;
    onChange: (v: string | null) => void;
    error?: boolean;
    minimumDate?: string;
  };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("mode derivation", () => {
  it("defaults to 'all' with a null value", async () => {
    await render(<DateRangeFilter value={null} setDateFilter={mockSetDateFilter} />);
    expect(radioProps().value).toBe("all");
    expect(mockDropdownCapture).not.toHaveBeenCalled();
    expect(mockDateInputCapture).not.toHaveBeenCalled();
  });

  it("shows the year dropdown only in year mode", async () => {
    await render(
      <DateRangeFilter value={{ type: "year", year: 2020 }} setDateFilter={mockSetDateFilter} />,
    );
    expect(dropdownProps().value).toBe(2020);
  });

  it("shows the from/to date inputs only in range mode", async () => {
    await render(
      <DateRangeFilter value={{ type: "range", from: "2026-01-01", to: "2026-01-31" }} setDateFilter={mockSetDateFilter} />,
    );
    expect(dateInputPropsAt(0).value).toBe("2026-01-01");
    expect(dateInputPropsAt(1).value).toBe("2026-01-31");
  });
});

describe("handleModeChange", () => {
  it("clears the filter for 'all'", async () => {
    await render(<DateRangeFilter value={{ type: "today" }} setDateFilter={mockSetDateFilter} />);
    radioProps().onChange("all");
    expect(mockSetDateFilter).toHaveBeenCalledWith(null);
  });

  it("sets {type:'today'} for 'today'", async () => {
    await render(<DateRangeFilter value={null} setDateFilter={mockSetDateFilter} />);
    radioProps().onChange("today");
    expect(mockSetDateFilter).toHaveBeenCalledWith({ type: "today" });
  });

  it("sets {type:'this_year'} for 'this_year'", async () => {
    await render(<DateRangeFilter value={null} setDateFilter={mockSetDateFilter} />);
    radioProps().onChange("this_year");
    expect(mockSetDateFilter).toHaveBeenCalledWith({ type: "this_year" });
  });

  it("sets {type:'year', year:null} for 'year'", async () => {
    await render(<DateRangeFilter value={null} setDateFilter={mockSetDateFilter} />);
    radioProps().onChange("year");
    expect(mockSetDateFilter).toHaveBeenCalledWith({ type: "year", year: null });
  });

  it("sets {type:'range'} (no from/to) for 'range'", async () => {
    await render(<DateRangeFilter value={null} setDateFilter={mockSetDateFilter} />);
    radioProps().onChange("range");
    expect(mockSetDateFilter).toHaveBeenCalledWith({ type: "range" });
  });
});

describe("year dropdown", () => {
  it("offers a descending year range down to 1900", async () => {
    await render(<DateRangeFilter value={{ type: "year" }} setDateFilter={mockSetDateFilter} />);
    const data = dropdownProps().query.data;
    expect(data[data.length - 1].value).toBe(1900);
    expect(data[0].value).toBe(new Date().getFullYear());
  });

  it("sets {type:'year', year} on selection, or clears the filter when reset to null", async () => {
    await render(<DateRangeFilter value={{ type: "year" }} setDateFilter={mockSetDateFilter} />);
    dropdownProps().setValue(2019);
    expect(mockSetDateFilter).toHaveBeenCalledWith({ type: "year", year: 2019 });

    dropdownProps().setValue(null);
    expect(mockSetDateFilter).toHaveBeenLastCalledWith(null);
  });
});

describe("range date inputs", () => {
  it("sets a from-only range", async () => {
    await render(<DateRangeFilter value={{ type: "range" }} setDateFilter={mockSetDateFilter} />);
    dateInputPropsAt(0).onChange("2026-01-01");
    expect(mockSetDateFilter).toHaveBeenCalledWith({ type: "range", from: "2026-01-01", to: null });
  });

  it("sets a to-only range", async () => {
    await render(<DateRangeFilter value={{ type: "range" }} setDateFilter={mockSetDateFilter} />);
    dateInputPropsAt(1).onChange("2026-01-31");
    expect(mockSetDateFilter).toHaveBeenCalledWith({ type: "range", from: null, to: "2026-01-31" });
  });

  it("clears the filter when both from and to end up empty", async () => {
    await render(<DateRangeFilter value={{ type: "range" }} setDateFilter={mockSetDateFilter} />);
    dateInputPropsAt(0).onChange(null);
    expect(mockSetDateFilter).toHaveBeenCalledWith(null);
  });

  it("clears the filter when from ends up after to (invalid range)", async () => {
    await render(
      <DateRangeFilter value={{ type: "range", from: "2026-01-01", to: "2026-01-10" }} setDateFilter={mockSetDateFilter} />,
    );
    dateInputPropsAt(0).onChange("2026-02-01");
    expect(mockSetDateFilter).toHaveBeenCalledWith(null);
  });

  it("flags both inputs as invalid and shows an error message once from > to", async () => {
    await render(
      <DateRangeFilter value={{ type: "range", from: "2026-02-01", to: "2026-01-10" }} setDateFilter={mockSetDateFilter} />,
    );
    expect(dateInputPropsAt(0).error).toBe(true);
    expect(dateInputPropsAt(1).error).toBe(true);
    expect(screen.getByText("date_range_invalid")).toBeOnTheScreen();
  });

  it("does not flag an error for a valid range", async () => {
    await render(
      <DateRangeFilter value={{ type: "range", from: "2026-01-01", to: "2026-01-10" }} setDateFilter={mockSetDateFilter} />,
    );
    expect(dateInputPropsAt(0).error).toBeFalsy();
    expect(screen.queryByText("date_range_invalid")).not.toBeOnTheScreen();
  });

  it("passes `from` as the `to` input's minimumDate", async () => {
    await render(
      <DateRangeFilter value={{ type: "range", from: "2026-01-01" }} setDateFilter={mockSetDateFilter} />,
    );
    expect(dateInputPropsAt(1).minimumDate).toBe("2026-01-01");
  });
});
