jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children, top, bottom }: {
      children: import("react").ReactNode;
      top?: import("react").ReactNode;
      bottom?: import("react").ReactNode;
    }) => (
      <View>
        {top}
        {children}
        {bottom}
      </View>
    ),
  };
});
// ProfileForm's own tree (dropdowns, species/place pickers, SVG icon inputs)
// is a large, separately-testable surface unrelated to ProfileScreen's own
// orchestration logic (gating/banner-wiring/submit handling) — stub it down
// to just enough to trigger submitHandler and observe loading/success.
const mockFormMount = jest.fn();
jest.mock("../../components/Profile/ProfileForm", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  const ReactActual = require("react");
  return {
    __esModule: true,
    default: ({ submitHandler, loading, success }: {
      submitHandler: (data: unknown) => void;
      loading: boolean;
      success: boolean;
    }) => {
      ReactActual.useEffect(() => {
        mockFormMount();
      }, []);
      return (
        <View>
          <Text>{loading ? "form-loading" : success ? "form-success" : "form-idle"}</Text>
          <TouchableOpacity
            testID="submit-profile-form"
            onPress={() => submitHandler({ first_name: "Janet" })}
          >
            <Text>submit</Text>
          </TouchableOpacity>
        </View>
      );
    },
  };
});
jest.mock("../../store/profile-context", () => ({
  useProfile: jest.fn(),
}));
jest.mock("../../hooks/Profile/useUpdateProfile", () => ({
  useInvalidateProfile: jest.fn(),
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: jest.fn(),
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useProfile } from "../../store/profile-context";
import { useInvalidateProfile } from "../../hooks/Profile/useUpdateProfile";
import { useApiError } from "../../hooks/useApiError";
import ProfileScreen from "../ProfileScreen";

const mockInvalidateProfile = jest.fn();
const mockShowErrorToast = jest.fn();
const mockUpdateProfile = jest.fn();
const mockRefreshProfile = jest.fn();
const mockRetryFailedEdit = jest.fn();
const mockDiscardFailedEdit = jest.fn();

const mockProfileContext = (overrides: Record<string, unknown> = {}) => {
  (useProfile as jest.Mock).mockReturnValue({
    profile: { user: 1 },
    profileLoading: false,
    updateProfile: mockUpdateProfile,
    refreshProfile: mockRefreshProfile,
    failedEdit: null,
    retryFailedEdit: mockRetryFailedEdit,
    discardFailedEdit: mockDiscardFailedEdit,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  (useInvalidateProfile as jest.Mock).mockReturnValue(mockInvalidateProfile);
  (useApiError as jest.Mock).mockReturnValue({ showErrorToast: mockShowErrorToast });
  mockUpdateProfile.mockResolvedValue(undefined);
  mockProfileContext();
});

it("shows a loading overlay while the profile is loading", async () => {
  mockProfileContext({ profile: null, profileLoading: true });
  await render(<ProfileScreen />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("shows an error overlay with retry when there is no profile and loading finished", async () => {
  mockProfileContext({ profile: null, profileLoading: false });
  await render(<ProfileScreen />);

  expect(screen.getByText("profile_unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
});

it("renders the form and no failure banner when there is no failed edit", async () => {
  await render(<ProfileScreen />);
  expect(screen.getByText("form-idle")).toBeOnTheScreen();
  expect(screen.queryByText("discard_changes")).not.toBeOnTheScreen();
});

it("renders FailedEditBanner wired to the context's retry/discard when a failed edit exists", async () => {
  mockProfileContext({ failedEdit: { message: "Boom", createdAt: 1 } });
  await render(<ProfileScreen />);

  expect(screen.getByText("Boom")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("discard_changes"));
  expect(mockDiscardFailedEdit).toHaveBeenCalledTimes(1);
});

it("submit success calls updateProfile then invalidateProfile and shows the success state", async () => {
  // ProfileScreen's own submitHandler does setSuccess(true) followed by a
  // real 1500ms setTimeout to flip it back — fake timers so that timer
  // doesn't leak past this test as an open handle.
  jest.useFakeTimers();
  await render(<ProfileScreen />);

  await fireEvent.press(screen.getByTestId("submit-profile-form"));

  expect(mockUpdateProfile).toHaveBeenCalledWith({ first_name: "Janet" });
  expect(mockInvalidateProfile).toHaveBeenCalledTimes(1);
  expect(screen.getByText("form-success")).toBeOnTheScreen();

  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

it("submit failure shows an error toast via useApiError, passing the field-error extractor", async () => {
  const apiError = { response: { data: { first_name: ["Too short"] } } };
  mockUpdateProfile.mockRejectedValueOnce(apiError);

  await render(<ProfileScreen />);
  await fireEvent.press(screen.getByTestId("submit-profile-form"));

  expect(mockShowErrorToast).toHaveBeenCalledWith(apiError, "updateProfile", expect.any(Function));
});

describe("the extractor passed to showErrorToast", () => {
  const extract = async (data: Record<string, unknown> | undefined) => {
    mockUpdateProfile.mockRejectedValueOnce({ response: { data } });
    const result = await render(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId("submit-profile-form"));
    const extractor = mockShowErrorToast.mock.calls.at(-1)![2];
    const extracted = extractor({ response: { data } });
    await result.unmount();
    return extracted;
  };

  it("prefers non_field_errors over any per-field error", async () => {
    const result = await extract({
      non_field_errors: ["General failure"],
      first_name: ["ignored"],
    });
    expect(result).toEqual({ title: "update_failed", message: "General failure" });
  });

  it("falls back to first_name, then last_name, then username in that order", async () => {
    expect(await extract({ first_name: ["First error"], last_name: ["ignored"] })).toEqual({
      title: "update_failed",
      message: "First error",
    });
    expect(await extract({ last_name: ["Last error"], username: ["ignored"] })).toEqual({
      title: "update_failed",
      message: "Last error",
    });
    expect(await extract({ username: ["Username error"] })).toEqual({
      title: "update_failed",
      message: "Username error",
    });
  });

  it("joins all field errors when none of the known keys match", async () => {
    const result = await extract({ territory: ["Bad territory"] });
    expect(result).toEqual({ title: "update_failed", message: "Bad territory" });
  });

  it("falls back to a generic message when there is no response data at all", async () => {
    const result = await extract(undefined);
    expect(result).toEqual({ title: "update_failed", message: "could_not_update_profile" });
  });
});

it("resets the form (remounts ProfileForm) when the bottom reset button is pressed", async () => {
  await render(<ProfileScreen />);
  expect(mockFormMount).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByText("reset_form"));

  expect(mockFormMount).toHaveBeenCalledTimes(2);
});
