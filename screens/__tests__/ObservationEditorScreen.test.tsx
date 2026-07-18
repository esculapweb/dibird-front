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
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children, bottom }: {
      children: import("react").ReactNode;
      bottom?: import("react").ReactNode;
    }) => (
      <View>
        {children}
        {bottom}
      </View>
    ),
  };
});
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: undefined })),
  useQueryClient: jest.fn(),
}));
jest.mock("../../hooks/Observation/useOfflineObservation", () => ({
  useCreateObservation: jest.fn(),
  useUpdateObservation: jest.fn(),
}));
jest.mock("../../store/profile-context", () => ({
  useProfile: jest.fn(),
}));
jest.mock("../../util/sessionStore", () => ({
  setSession: jest.fn(),
}));
jest.mock("../../util/navigationCallbacks", () => ({
  setTypedNavigationCallback: jest.fn(),
}));
jest.mock("../../hooks/useEditorForm", () => ({
  useEditorForm: jest.fn(),
}));
jest.mock("../../util/fetches", () => ({
  fetchDiarySpeciesIds: jest.fn(),
}));
jest.mock("../../hooks/repositories/observationRepository", () => ({
  getPendingSpeciesForDiary: jest.fn(() => new Set()),
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
// IconsHeader/IconButton render the save button as a Pressable whose onPress
// is swapped to undefined when disabled (no accessibilityState.disabled) —
// RTL's fireEvent.press against the real Pressable chain didn't reliably
// respect that in this RN/RTL combination. Stub with a plain TouchableOpacity
// that mirrors the same disabled contract explicitly, so both "tapping the
// save button" and "the button reports itself disabled while pending" are
// simple, direct assertions instead of fighting Pressable internals.
jest.mock("../../components/ui/IconsHeader", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ headerRightBeginning }: {
      headerRightBeginning: Array<{ onPress: () => void; disabled?: boolean; testID?: string }>;
    }) => (
      <>
        {headerRightBeginning.map((btn, i) => (
          <TouchableOpacity
            key={i}
            testID={btn.testID}
            onPress={btn.disabled ? undefined : btn.onPress}
          >
            <Text>{btn.disabled ? "save-disabled" : "save-enabled"}</Text>
          </TouchableOpacity>
        ))}
      </>
    ),
  };
});
// ObservationForm's own tree (species/place/territory dropdowns, date/time
// pickers, map) is a large, separately-testable surface unrelated to this
// screen's own orchestration (mutation wiring, navigation, error mapping) —
// stub it down to nothing, same reasoning as ProfileForm in
// ProfileScreen.test.tsx. Exposes just an "add new place" trigger, since
// that's the one callback this screen's own logic (handleAddNewPlace) is
// responsible for wiring, unlike form-field edits which are ObservationForm's
// own concern.
jest.mock("../../components/Observation/ObservationForm", () => {
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

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateObservation,
  useUpdateObservation,
} from "../../hooks/Observation/useOfflineObservation";
import { useProfile } from "../../store/profile-context";
import { setSession } from "../../util/sessionStore";
import { setTypedNavigationCallback } from "../../util/navigationCallbacks";
import { useEditorForm } from "../../hooks/useEditorForm";
import { createNavigationMock, createRouteMock } from "../test-utils";
import ObservationEditorScreen from "../ObservationEditorScreen";

const mockShowErrorToast = jest.fn();
const mockNavigation = createNavigationMock();
let mockRoute: ReturnType<typeof createRouteMock>;

const mockCreateMutate = jest.fn();
const mockUpdateMutate = jest.fn();
const mockSetErrors = jest.fn();
const mockSetSpeciesValue = jest.fn();
const mockSetSpeciesData = jest.fn();
const mockSetFormData = jest.fn();
const mockSetTerritoryValue = jest.fn();
const mockSetPlaceValue = jest.fn();
const mockSetPlaceData = jest.fn();
const mockValidateForm = jest.fn();
const mockInvalidateQueries = jest.fn();

const mockEditorForm = (overrides: Record<string, unknown> = {}) => {
  (useEditorForm as jest.Mock).mockReturnValue({
    itemWithParsedDate: undefined,
    formData: { date_time: "2026-01-01" },
    setFormData: mockSetFormData,
    errors: {},
    setErrors: mockSetErrors,
    territoryValue: 5,
    setTerritoryValue: mockSetTerritoryValue,
    speciesValue: 42,
    setSpeciesValue: mockSetSpeciesValue,
    placeValue: null,
    setPlaceValue: mockSetPlaceValue,
    speciesData: null,
    setSpeciesData: mockSetSpeciesData,
    placeData: null,
    setPlaceData: mockSetPlaceData,
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
  mockRoute = createRouteMock("ObservationEditor", {});
  (useProfile as jest.Mock).mockReturnValue({ profile: { user: 1, territory: 5 } });
  (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries: mockInvalidateQueries });
  (useCreateObservation as jest.Mock).mockReturnValue({ mutate: mockCreateMutate, isPending: false });
  (useUpdateObservation as jest.Mock).mockReturnValue({ mutate: mockUpdateMutate, isPending: false });
  mockValidateForm.mockReturnValue(true);
  mockEditorForm();
});

afterEach(() => {
  (global.requestAnimationFrame as jest.Mock).mockRestore?.();
});

const pressSave = async () => {
  const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0].headerRight;
  await render(headerRight());
  await fireEvent.press(screen.getByTestId("observation-save-button"));
};

describe("mode setup", () => {
  it("create mode: calls useEditorForm with no item and defaults sourced from route params, and titles the header accordingly", async () => {
    mockRoute = createRouteMock("ObservationEditor", {
      defaultTerritory: 7,
      defaultPlace: 3,
      defaultSpecies: 9,
      diaryId: 11,
    });
    await render(<ObservationEditorScreen />);

    expect(useEditorForm).toHaveBeenCalledWith(
      expect.objectContaining({
        item: null,
        defaultTerritory: 7,
        defaultPlace: 3,
        defaultSpecies: 9,
        diaryId: 11,
        requiredFields: ["territory", "species", "date_time"],
      }),
    );
    expect(mockNavigation.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "new_observation" }),
    );
  });

  it("edit mode: passes the route's observation as the item and titles the header accordingly", async () => {
    const observation = { id: 99, territory: 5, species: 42 };
    mockRoute = createRouteMock("ObservationEditor", { observation });
    await render(<ObservationEditorScreen />);

    expect(useEditorForm).toHaveBeenCalledWith(
      expect.objectContaining({ item: observation }),
    );
    expect(mockNavigation.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "edit_observation" }),
    );
  });
});

describe("submit guards", () => {
  it("does not call mutate when validateForm reports invalid", async () => {
    mockValidateForm.mockReturnValue(false);
    await render(<ObservationEditorScreen />);
    await pressSave();
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("does not call mutate when a required value is still missing even if validateForm passed", async () => {
    mockEditorForm({ speciesValue: null });
    await render(<ObservationEditorScreen />);
    await pressSave();
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });
});

describe("save navigation branching", () => {
  it("create with returnMode 'back' navigates back on success", async () => {
    mockRoute = createRouteMock("ObservationEditor", { returnMode: "back" });
    await render(<ObservationEditorScreen />);
    await pressSave();

    const { onSuccess } = mockCreateMutate.mock.calls[0][1];
    onSuccess({ id: 123, date_time: "2026-01-01" });

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it("create without returnMode replaces with the new observation's detail screen", async () => {
    await render(<ObservationEditorScreen />);
    await pressSave();

    const { onSuccess } = mockCreateMutate.mock.calls[0][1];
    onSuccess({ id: 123, date_time: "2026-01-01" });

    expect(setSession).toHaveBeenCalledWith("lastDate", "2026-01-01");
    expect(mockNavigation.replace).toHaveBeenCalledWith("ObservationDetail", {
      observationId: 123,
      initialObservation: { id: 123, date_time: "2026-01-01" },
    });
  });

  it("update navigates back on success", async () => {
    mockRoute = createRouteMock("ObservationEditor", { observation: { id: 99 } });
    await render(<ObservationEditorScreen />);
    await pressSave();

    const { onSuccess } = mockUpdateMutate.mock.calls[0][1];
    onSuccess();

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe("save error handling", () => {
  it("maps a per-field server error onto the matching form field instead of a toast", async () => {
    await render(<ObservationEditorScreen />);
    await pressSave();

    const { onError } = mockCreateMutate.mock.calls[0][1];
    onError({ response: { data: { species: ["Invalid species"] } } });

    const updater = mockSetErrors.mock.calls[0][0];
    expect(updater({})).toEqual({ species: ["Invalid species"] });
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it("falls back to a toast when the server error matches no known field", async () => {
    await render(<ObservationEditorScreen />);
    await pressSave();

    const { onError } = mockCreateMutate.mock.calls[0][1];
    const error = { response: { data: { non_field_errors: ["Something broke"] } } };
    onError(error);

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      error,
      "ObservationEditorScreen:handleMutateError",
      expect.any(Function),
    );
    expect(mockSetErrors).not.toHaveBeenCalled();
  });

  it("falls back to a toast when the error has no response data at all (offline/timeout)", async () => {
    await render(<ObservationEditorScreen />);
    await pressSave();

    const { onError } = mockCreateMutate.mock.calls[0][1];
    onError({ isNetworkError: true });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      { isNetworkError: true },
      "ObservationEditorScreen:handleMutateError",
      expect.any(Function),
    );
  });
});

describe("save and add another (diary mode)", () => {
  beforeEach(() => {
    mockRoute = createRouteMock("ObservationEditor", { diaryId: 11 });
  });

  it("shows the bottom button and resets species/time/quantity/notes on success", async () => {
    // handleSaveAndAddAnother's onSuccess does setJustSaved(true) followed
    // by a real 1500ms setTimeout to flip it back — fake timers so that
    // timer doesn't leak past this test as an open handle.
    jest.useFakeTimers();
    await render(<ObservationEditorScreen />);
    await fireEvent.press(screen.getByText("save_and_add_another"));

    const { onSuccess } = mockCreateMutate.mock.calls[0][1];
    await act(async () => {
      onSuccess({ id: 1 });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["DiarySpecies", 11] });
    expect(mockSetSpeciesValue).toHaveBeenCalledWith(null);
    expect(mockSetSpeciesData).toHaveBeenCalledWith(null);
    expect(mockSetErrors).toHaveBeenCalledWith({});
    const formUpdater = mockSetFormData.mock.calls[0][0];
    expect(formUpdater({ date_time: "2026-01-01", territory: 5 })).toEqual({
      date_time: "2026-01-01",
      territory: 5,
      species: null,
      time: null,
      quantity: null,
      notes: null,
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("is not shown in edit mode even with a diaryId", async () => {
    mockRoute = createRouteMock("ObservationEditor", { diaryId: 11, observation: { id: 5 } });
    await render(<ObservationEditorScreen />);
    expect(screen.queryByText("save_and_add_another")).not.toBeOnTheScreen();
  });
});

it("adding a new place registers a typed navigation callback and navigates to PlaceEditor", async () => {
  await render(<ObservationEditorScreen />);
  await fireEvent.press(screen.getByTestId("add-new-place"));

  expect(setTypedNavigationCallback).toHaveBeenCalledWith("onPlaceCreated", expect.any(Function));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceEditor", {
    returnToScreen: "ObservationEditor",
  });
});

it("marks the save button disabled and ignores taps while a mutation is already pending", async () => {
  (useCreateObservation as jest.Mock).mockReturnValue({ mutate: mockCreateMutate, isPending: true });
  await render(<ObservationEditorScreen />);
  const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0].headerRight;
  await render(headerRight());

  expect(screen.getByText("save-disabled")).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("observation-save-button"));
  expect(mockCreateMutate).not.toHaveBeenCalled();
});
