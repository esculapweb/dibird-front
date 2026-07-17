jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({ Colors: { tabBorder: "#ccc", textSecondary: "#666" } }),
}));
jest.mock("../../../store/profile-context", () => ({ useProfile: jest.fn() }));
jest.mock("../../../store/language-context", () => ({ useLanguage: () => ({ language: "en" }) }));
jest.mock("../../../util/fetches", () => ({
  fetchTimezones: jest.fn(),
  fetchMyCountries: jest.fn(),
}));
jest.mock("../../../hooks/useDropdownQuery", () => ({ useDropdownQuery: jest.fn() }));

const mockInputCapture = jest.fn();
jest.mock("../../ui/Input", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockInputCapture(props);
    return null;
  },
}));
const mockDropdownCapture = jest.fn();
jest.mock("../../ui/DropdownInput", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDropdownCapture(props);
    return null;
  },
}));
const mockPrivacyToggleCapture = jest.fn();
jest.mock("../../ui/PrivacyToggle", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockPrivacyToggleCapture(props);
    return null;
  },
}));
const mockButtonCapture = jest.fn();
jest.mock("../../ui/AnimatedLoadingButton", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: { onPress: () => void; loading: boolean; success?: boolean; children: import("react").ReactNode }) => {
      mockButtonCapture(props);
      return (
        <TouchableOpacity testID="submit-button" onPress={props.onPress}>
          <Text>{props.children}</Text>
        </TouchableOpacity>
      );
    },
  };
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useProfile } from "../../../store/profile-context";
import { useDropdownQuery } from "../../../hooks/useDropdownQuery";
import ProfileForm from "../ProfileForm";

const mockSubmitHandler = jest.fn();

// Every mocked child re-captures its props on each render, so always read
// the most recent call for a given label/title/index — earlier ones are
// stale snapshots from before a state update took effect.
const inputProps = (label: string) =>
  mockInputCapture.mock.calls.map((c) => c[0]).reverse().find((p) => p.label === label);
const dropdownProps = (title: string) =>
  mockDropdownCapture.mock.calls.map((c) => c[0]).reverse().find((p) => p.title === title);
const privacyProps = (index: number) =>
  mockPrivacyToggleCapture.mock.calls.filter((_, i) => i % 2 === index).at(-1)![0];

const PROFILE = {
  user_data: { first_name: "Jane", last_name: "Doe", username: "jdoe" },
  private: true,
  private_diary: false,
  territory: 5,
  timezone: "Europe/Paris",
};

beforeEach(() => {
  jest.clearAllMocks();
  (useProfile as jest.Mock).mockReturnValue({ profile: null });
  (useDropdownQuery as jest.Mock).mockImplementation(({ type }: { type?: string }) => ({
    query: { data: [] },
    sort: "name",
    onSortChange: jest.fn(),
    // TimezonesDropdown doesn't pass `type`, matching the real call site.
    ...(type ? {} : {}),
  }));
});

describe("initial values", () => {
  it("starts blank/unset without a loaded profile", async () => {
    await render(<ProfileForm submitHandler={mockSubmitHandler} loading={false} success={false} />);
    expect(inputProps("first_name").value).toBe("");
    expect(inputProps("last_name").value).toBe("");
    expect(inputProps("username").value).toBe("");
    expect(dropdownProps("my_country").value).toBeNull();
    expect(dropdownProps("timezone").value).toBeNull();
    expect(privacyProps(0).value).toBe(false);
    expect(privacyProps(1).value).toBe(false);
  });

  it("seeds every field from the profile once it loads", async () => {
    (useProfile as jest.Mock).mockReturnValue({ profile: PROFILE });
    await render(<ProfileForm submitHandler={mockSubmitHandler} loading={false} success={false} />);

    expect(inputProps("first_name").value).toBe("Jane");
    expect(inputProps("last_name").value).toBe("Doe");
    expect(inputProps("username").value).toBe("jdoe");
    expect(dropdownProps("my_country").value).toBe(5);
    expect(dropdownProps("timezone").value).toBe("Europe/Paris");
    expect(privacyProps(0).value).toBe(true);
    expect(privacyProps(1).value).toBe(false);
  });

  it("does not seed anything while the profile is present but its user_data hasn't loaded yet", async () => {
    (useProfile as jest.Mock).mockReturnValue({ profile: { user_data: undefined } });
    await render(<ProfileForm submitHandler={mockSubmitHandler} loading={false} success={false} />);
    expect(inputProps("first_name").value).toBe("");
  });
});

describe("submit", () => {
  const fillRequiredFields = async () => {
    await act(async () => {
      dropdownProps("my_country").setValue(5);
      dropdownProps("timezone").setValue("Europe/Paris");
      inputProps("username").onUpdateValue("jdoe");
    });
  };

  it("blocks submission and flags missing required fields (username/territory/timezone)", async () => {
    await render(<ProfileForm submitHandler={mockSubmitHandler} loading={false} success={false} />);
    await fireEvent.press(screen.getByTestId("submit-button"));

    expect(mockSubmitHandler).not.toHaveBeenCalled();
    expect(inputProps("username").isInvalid).toBe(true);
    expect(dropdownProps("my_country").error).toBe("territory_required");
    expect(dropdownProps("timezone").error).toBe("timezone_required");
  });

  it("clears the dropdown errors once required fields are filled and resubmitted", async () => {
    await render(<ProfileForm submitHandler={mockSubmitHandler} loading={false} success={false} />);
    await fireEvent.press(screen.getByTestId("submit-button"));
    expect(dropdownProps("my_country").error).toBe("territory_required");

    await fillRequiredFields();
    await act(async () => {
      inputProps("first_name").onUpdateValue("Jane");
      inputProps("last_name").onUpdateValue("Doe");
    });
    await fireEvent.press(screen.getByTestId("submit-button"));

    expect(dropdownProps("my_country").error).toBeUndefined();
    expect(dropdownProps("timezone").error).toBeUndefined();
  });

  it("never flags first/last name as invalid even when empty", async () => {
    await render(<ProfileForm submitHandler={mockSubmitHandler} loading={false} success={false} />);
    await fireEvent.press(screen.getByTestId("submit-button"));
    expect(inputProps("first_name").isInvalid).toBe(false);
    expect(inputProps("last_name").isInvalid).toBe(false);
  });

  it("submits a well-formed payload once all required fields are filled", async () => {
    await render(<ProfileForm submitHandler={mockSubmitHandler} loading={false} success={false} />);

    await fillRequiredFields();
    await act(async () => {
      inputProps("first_name").onUpdateValue("Jane");
      inputProps("last_name").onUpdateValue("Doe");
      privacyProps(0).onChange(true);
    });

    await fireEvent.press(screen.getByTestId("submit-button"));

    expect(mockSubmitHandler).toHaveBeenCalledWith({
      first_name: "Jane",
      last_name: "Doe",
      username: "jdoe",
      territory: 5,
      timezone: "Europe/Paris",
      private: true,
      private_diary: false,
    });
  });

  it("nulls out the territory when the dropdown value is somehow left as a string", async () => {
    await render(<ProfileForm submitHandler={mockSubmitHandler} loading={false} success={false} />);
    await act(async () => {
      dropdownProps("my_country").setValue("placeholder" as never);
      dropdownProps("timezone").setValue("UTC");
      inputProps("username").onUpdateValue("jdoe");
    });

    await fireEvent.press(screen.getByTestId("submit-button"));
    expect(mockSubmitHandler).toHaveBeenCalledWith(expect.objectContaining({ territory: null }));
  });

  it("forwards loading/success straight through to the submit button", async () => {
    await render(<ProfileForm submitHandler={mockSubmitHandler} loading success />);
    expect(mockButtonCapture).toHaveBeenCalledWith(
      expect.objectContaining({ loading: true, success: true }),
    );
  });
});
