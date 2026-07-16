jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
  };
});
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../hooks/Diary/useOfflineDiary", () => ({
  useCreateDiary: jest.fn(),
  useUpdateDiary: jest.fn(),
}));
jest.mock("../../store/profile-context", () => ({
  useProfile: jest.fn(),
}));
jest.mock("../../util/sessionStore", () => ({
  setSession: jest.fn(),
}));
jest.mock("../../util/navigationCallbacks", () => ({
  setNavigationCallback: jest.fn(),
  setTypedNavigationCallback: jest.fn(),
}));
jest.mock("../../hooks/useEditorForm", () => ({
  useEditorForm: jest.fn(),
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
// Same fireEvent.press/Pressable-disabled mismatch as
// ObservationEditorScreen.test.tsx — stub with a plain TouchableOpacity.
jest.mock("../../components/ui/IconsHeader", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ headerRightBeginning }: {
      headerRightBeginning: Array<{ onPress: () => void; disabled?: boolean; testID?: string }>;
    }) => (
      <>
        {headerRightBeginning.map((btn, i) => (
          <TouchableOpacity key={i} testID={btn.testID} onPress={btn.disabled ? undefined : btn.onPress}>
            <Text>{btn.disabled ? "save-disabled" : "save-enabled"}</Text>
          </TouchableOpacity>
        ))}
      </>
    ),
  };
});
jest.mock("../../components/Diary/DiaryForm", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onAddNewPlace }: { onAddNewPlace: () => void }) => (
      <TouchableOpacity testID="add-new-place" onPress={onAddNewPlace}>
        <Text>add place</Text>
      </TouchableOpacity>
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  useCreateDiary,
  useUpdateDiary,
} from "../../hooks/Diary/useOfflineDiary";
import { useProfile } from "../../store/profile-context";
import { setSession } from "../../util/sessionStore";
import { setNavigationCallback, setTypedNavigationCallback } from "../../util/navigationCallbacks";
import { useEditorForm } from "../../hooks/useEditorForm";
import { createNavigationMock, createRouteMock } from "../test-utils";
import DiaryEditorScreen from "../DiaryEditorScreen";

const mockShowErrorToast = jest.fn();
const mockNavigation = createNavigationMock();
let mockRoute: ReturnType<typeof createRouteMock>;

const mockCreateMutate = jest.fn();
const mockUpdateMutate = jest.fn();
const mockSetErrors = jest.fn();
const mockValidateForm = jest.fn();

const mockEditorForm = (overrides: Record<string, unknown> = {}) => {
  (useEditorForm as jest.Mock).mockReturnValue({
    itemWithParsedDate: undefined,
    formData: { date_time: "2026-01-01" },
    setFormData: jest.fn(),
    errors: {},
    setErrors: mockSetErrors,
    territoryValue: 5,
    setTerritoryValue: jest.fn(),
    placeValue: null,
    setPlaceValue: jest.fn(),
    placeData: null,
    setPlaceData: jest.fn(),
    validateForm: mockValidateForm,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  mockRoute = createRouteMock("DiaryEditor", {});
  (useProfile as jest.Mock).mockReturnValue({ profile: { user: 1, territory: 5 } });
  (useCreateDiary as jest.Mock).mockReturnValue({ mutate: mockCreateMutate, isPending: false });
  (useUpdateDiary as jest.Mock).mockReturnValue({ mutate: mockUpdateMutate, isPending: false });
  mockValidateForm.mockReturnValue(true);
  mockEditorForm();
});

afterEach(() => {
  (global.requestAnimationFrame as jest.Mock).mockRestore?.();
});

const pressSave = async () => {
  const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0].headerRight;
  await render(headerRight());
  await fireEvent.press(screen.getByTestId("diary-save-button"));
};

describe("mode setup", () => {
  it("create mode: passes no item and requiredFields territory/date_time, titles the header accordingly", async () => {
    mockRoute = createRouteMock("DiaryEditor", { defaultTerritory: 7, defaultPlace: 3 });
    await render(<DiaryEditorScreen />);

    expect(useEditorForm).toHaveBeenCalledWith(
      expect.objectContaining({
        item: null,
        defaultTerritory: 7,
        defaultPlace: 3,
        hasSpecies: false,
        requiredFields: ["territory", "date_time"],
      }),
    );
    expect(mockNavigation.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "new_diary" }),
    );
  });

  it("edit mode: passes the route's diary as the item and titles the header accordingly", async () => {
    const diary = { id: 99, territory: 5 };
    mockRoute = createRouteMock("DiaryEditor", { diary });
    await render(<DiaryEditorScreen />);

    expect(useEditorForm).toHaveBeenCalledWith(expect.objectContaining({ item: diary }));
    expect(mockNavigation.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "edit_diary" }),
    );
  });
});

it("does not call mutate when validateForm reports invalid", async () => {
  mockValidateForm.mockReturnValue(false);
  await render(<DiaryEditorScreen />);
  await pressSave();
  expect(mockCreateMutate).not.toHaveBeenCalled();
});

describe("save navigation branching", () => {
  it("create navigates (via replace) to the new diary's detail screen on success", async () => {
    await render(<DiaryEditorScreen />);
    await pressSave();

    const { onSuccess } = mockCreateMutate.mock.calls[0][1];
    onSuccess({ id: 123 });

    expect(setSession).toHaveBeenCalledWith("lastDate", "2026-01-01");
    expect(mockNavigation.replace).toHaveBeenCalledWith("DiaryDetail", { diaryId: 123 });
  });

  it("update navigates back on success", async () => {
    mockRoute = createRouteMock("DiaryEditor", { diary: { id: 99 } });
    await render(<DiaryEditorScreen />);
    await pressSave();

    const { onSuccess } = mockUpdateMutate.mock.calls[0][1];
    onSuccess();

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe("save error handling", () => {
  it("maps a per-field server error onto the matching form field instead of a toast", async () => {
    await render(<DiaryEditorScreen />);
    await pressSave();

    const { onError } = mockCreateMutate.mock.calls[0][1];
    onError({ response: { data: { name: ["Too long"] } } });

    const updater = mockSetErrors.mock.calls[0][0];
    expect(updater({})).toEqual({ name: ["Too long"] });
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it("falls back to a toast when the server error matches no known field", async () => {
    await render(<DiaryEditorScreen />);
    await pressSave();

    const { onError } = mockCreateMutate.mock.calls[0][1];
    const error = { response: { data: { non_field_errors: ["Something broke"] } } };
    onError(error);

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      error,
      "DiaryEditorScreen:handleMutateError",
      expect.any(Function),
    );
  });
});

it("adding a new place clears any stale callback first, then registers a fresh one and navigates to PlaceEditor", async () => {
  await render(<DiaryEditorScreen />);
  await fireEvent.press(screen.getByTestId("add-new-place"));

  expect(setNavigationCallback).toHaveBeenCalledWith("onPlaceCreated", null);
  expect(setTypedNavigationCallback).toHaveBeenCalledWith("onPlaceCreated", expect.any(Function));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceEditor", {
    returnToScreen: "DiaryEditor",
  });
});

it("marks the save button disabled and ignores taps while a mutation is already pending", async () => {
  (useCreateDiary as jest.Mock).mockReturnValue({ mutate: mockCreateMutate, isPending: true });
  await render(<DiaryEditorScreen />);
  const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0].headerRight;
  await render(headerRight());

  expect(screen.getByText("save-disabled")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("diary-save-button"));
  expect(mockCreateMutate).not.toHaveBeenCalled();
});

it("shows a loading overlay instead of the form while a mutation is pending", async () => {
  (useCreateDiary as jest.Mock).mockReturnValue({ mutate: mockCreateMutate, isPending: true });
  await render(<DiaryEditorScreen />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
  expect(screen.queryByTestId("add-new-place")).not.toBeOnTheScreen();
});
