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
  useCreateObservations: jest.fn(),
  useUpdateObservation: jest.fn(),
  useObservationItem: jest.fn(),
}));
jest.mock("../../components/Error/ErrorOverlay", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <Pressable testID="error-overlay" onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    ),
  };
});
jest.mock("../../components/ui/LoadingOverlay", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>loading-overlay</Text> };
});
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
jest.mock("../../hooks/useDefaultTerritory", () => ({
  useDefaultTerritory: jest.fn(),
}));
jest.mock("../../util/fetches", () => ({
  fetchDiarySpeciesIds: jest.fn(),
}));
jest.mock("../../hooks/repositories/observationPhotoRepository", () => ({
  queueUploads: jest.fn(),
  queueDelete: jest.fn(() => null),
}));
jest.mock("../../services/sync/observationPhotoSync", () => ({
  runObservationPhotoSync: jest.fn(),
}));
jest.mock("../../util/photoFiles", () => ({
  persistPickedPhoto: jest.fn(async (uri: string) => `persisted:${uri}`),
  deleteLocalPhotos: jest.fn(async () => {}),
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
    default: ({
      onAddNewPlace,
      onEditDiary,
      existingSpecies,
      openSpeciesSignal,
      setMultiSpecies,
    }: {
      onAddNewPlace: (coords?: [number, number]) => void;
      onEditDiary: () => void;
      existingSpecies: Set<string | number>;
      openSpeciesSignal?: number;
      setMultiSpecies?: (items: { value: number; label: string }[]) => void;
    }) => (
      <>
        <Text testID="multi-species-enabled">{String(!!setMultiSpecies)}</Text>
        {setMultiSpecies && (
          <TouchableOpacity
            testID="pick-multi-species"
            onPress={() =>
              setMultiSpecies([
                { value: 42, label: "Tit" },
                { value: 43, label: "Wren" },
              ])
            }
          >
            <Text>pick several</Text>
          </TouchableOpacity>
        )}
        <Text testID="open-species-signal">{String(openSpeciesSignal)}</Text>
        <TouchableOpacity testID="add-new-place" onPress={() => onAddNewPlace()}>
          <Text>add place</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="add-place-at-point"
          onPress={() => onAddNewPlace([2.35, 48.86])}
        >
          <Text>add place here</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="edit-diary" onPress={onEditDiary}>
          <Text>edit diary</Text>
        </TouchableOpacity>
        <Text testID="existing-species">
          {[...existingSpecies].sort().join(",")}
        </Text>
      </>
    ),
  };
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCreateObservation,
  useCreateObservations,
  useObservationItem,
  useUpdateObservation,
} from "../../hooks/Observation/useOfflineObservation";
import { useProfile } from "../../store/profile-context";
import { setSession } from "../../util/sessionStore";
import { setTypedNavigationCallback } from "../../util/navigationCallbacks";
import { useEditorForm } from "../../hooks/useEditorForm";
import { useDefaultTerritory } from "../../hooks/useDefaultTerritory";
import * as observationRepository from "../../hooks/repositories/observationRepository";
import { createNavigationMock, createRouteMock } from "../test-utils";
import ObservationEditorScreen from "../ObservationEditorScreen";

const mockShowErrorToast = jest.fn();
const mockNavigation = createNavigationMock();
let mockRoute: ReturnType<typeof createRouteMock>;

const mockCreateMutate = jest.fn();
const mockCreateManyMutate = jest.fn();
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
  (useDefaultTerritory as jest.Mock).mockReturnValue(12);
  (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries: mockInvalidateQueries });
  (useCreateObservation as jest.Mock).mockReturnValue({ mutate: mockCreateMutate, isPending: false });
  (useCreateObservations as jest.Mock).mockReturnValue({ mutate: mockCreateManyMutate, isPending: false });
  (useUpdateObservation as jest.Mock).mockReturnValue({ mutate: mockUpdateMutate, isPending: false });
  (useObservationItem as jest.Mock).mockReturnValue({ data: undefined, isError: false });
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

// A diary's observation list has only a trimmed row, so its edit action hands
// over the id and lets the editor load the full observation.
describe("edit by id", () => {
  const LOADED = { id: 77, date_time: "2026-02-03", diary: 11, territory: 5 };

  beforeEach(() => {
    mockRoute = createRouteMock("ObservationEditor", {
      observationId: 77,
      diaryId: 11,
      territoryValue: 5,
    });
  });

  it("loads the observation and waits for it before mounting the form", async () => {
    await render(<ObservationEditorScreen />);

    expect(useObservationItem).toHaveBeenCalledWith(77);
    expect(screen.getByText("loading-overlay")).toBeOnTheScreen();
    expect(useEditorForm).not.toHaveBeenCalled();
    expect(mockNavigation.setOptions).toHaveBeenCalledWith({ title: "edit_observation" });
  });

  it("fills the form from the loaded observation, in edit mode", async () => {
    (useObservationItem as jest.Mock).mockReturnValue({ data: LOADED, isError: false });
    await render(<ObservationEditorScreen />);

    expect(useEditorForm).toHaveBeenCalledWith(
      expect.objectContaining({ item: LOADED, diaryId: 11 }),
    );
    expect(mockNavigation.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "edit_observation" }),
    );
  });

  it("offers a retry when the observation can't be loaded", async () => {
    const refetch = jest.fn();
    (useObservationItem as jest.Mock).mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error("offline"),
      refetch,
    });
    await render(<ObservationEditorScreen />);

    expect(useEditorForm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("error-overlay"));
    expect(refetch).toHaveBeenCalled();
  });

  it("doesn't load anything when the caller passed the full observation", async () => {
    mockRoute = createRouteMock("ObservationEditor", {
      observation: LOADED as never,
      observationId: 77,
    });
    await render(<ObservationEditorScreen />);

    expect(useObservationItem).toHaveBeenCalledWith(null);
    expect(useEditorForm).toHaveBeenCalledWith(expect.objectContaining({ item: LOADED }));
  });
});

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

  it("create mode: falls back to the last saved/profile country when the caller sent none", async () => {
    mockRoute = createRouteMock("ObservationEditor", { defaultSpecies: 9 });
    await render(<ObservationEditorScreen />);

    expect(useEditorForm).toHaveBeenCalledWith(
      expect.objectContaining({ defaultTerritory: 12 }),
    );
  });

  it("create mode: leaves the country empty when the caller ruled one out with an explicit null", async () => {
    // Species detail sends null when its guess falls outside the species'
    // range — the fallback must not quietly put it back.
    mockRoute = createRouteMock("ObservationEditor", {
      defaultSpecies: 9,
      defaultTerritory: null,
    });
    await render(<ObservationEditorScreen />);

    expect(useEditorForm).toHaveBeenCalledWith(
      expect.objectContaining({ defaultTerritory: null }),
    );
  });

  it("create mode: prefers the diary's country over the fallback", async () => {
    mockRoute = createRouteMock("ObservationEditor", {
      diaryId: 11,
      territoryValue: 7,
    });
    await render(<ObservationEditorScreen />);

    expect(useEditorForm).toHaveBeenCalledWith(
      expect.objectContaining({ defaultTerritory: 7 }),
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
    await onSuccess({ id: 123, date_time: "2026-01-01" });

    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it("create without returnMode replaces with the new observation's detail screen", async () => {
    await render(<ObservationEditorScreen />);
    await pressSave();

    const { onSuccess } = mockCreateMutate.mock.calls[0][1];
    await onSuccess({ id: 123, date_time: "2026-01-01" });

    expect(setSession).toHaveBeenCalledWith("lastDate", "2026-01-01");
    // Seeds the fallback the next observation opens on.
    expect(setSession).toHaveBeenCalledWith("lastTerritory", 5);
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
    await onSuccess();

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

describe("openSpecies param", () => {
  it("starts with the species list requested when the caller asks for it", async () => {
    mockRoute = createRouteMock("ObservationEditor", { diaryId: 11, openSpecies: true });
    await render(<ObservationEditorScreen />);
    expect(screen.getByTestId("open-species-signal")).toHaveTextContent("1");
  });

  it("leaves the list closed otherwise", async () => {
    mockRoute = createRouteMock("ObservationEditor", { diaryId: 11 });
    await render(<ObservationEditorScreen />);
    expect(screen.getByTestId("open-species-signal")).toHaveTextContent("0");
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

it("adding a place at a point picked on the map hands that point to PlaceEditor", async () => {
  await render(<ObservationEditorScreen />);
  await fireEvent.press(screen.getByTestId("add-place-at-point"));

  expect(setTypedNavigationCallback).toHaveBeenCalledWith("onPlaceCreated", expect.any(Function));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceEditor", {
    returnToScreen: "ObservationEditor",
    initialCoords: [2.35, 48.86],
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

describe("the place returned from PlaceEditor", () => {
  const placeCreated = async (
    territoryOfNewPlace: number | null,
    placeData: Record<string, unknown> = {},
  ) => {
    await render(<ObservationEditorScreen />);
    await fireEvent.press(screen.getByTestId("add-new-place"));
    const onPlaceCreated = (setTypedNavigationCallback as jest.Mock).mock.calls[0][1];

    await act(async () => {
      onPlaceCreated(77, territoryOfNewPlace, {
        id: 77,
        name: "New Place",
        preview: null,
        location: null,
        ...placeData,
      });
    });
  };

  it("selects the new place in the form", async () => {
    await placeCreated(5);

    expect(mockSetPlaceValue).toHaveBeenCalledWith(77);
    expect(mockSetPlaceData).toHaveBeenCalledWith(
      expect.objectContaining({ value: 77, label: "New Place" }),
    );
  });

  // A null preview/location on the wire means "none"; the dropdown option type
  // wants them absent instead, so they are normalised on the way in.
  it("normalises a missing preview and location to undefined", async () => {
    await placeCreated(5);

    const option = mockSetPlaceData.mock.calls[0][0];
    expect(option.preview).toBeUndefined();
    expect(option.location).toBeUndefined();
  });

  it("keeps the country as it was when the new place sits in the same one", async () => {
    await placeCreated(5);

    expect(mockSetTerritoryValue).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    expect(mockSetFormData.mock.calls.at(-1)![0]({ place: null })).toEqual({
      place: 77,
    });
  });

  // Saving a place in another country silently moves the observation there
  // too, so the change is called out rather than left to be discovered.
  it("follows the new place's country and says so", async () => {
    await placeCreated(9);

    expect(mockSetTerritoryValue).toHaveBeenCalledWith(9);
    expect(mockSetFormData.mock.calls.at(-1)![0]({ place: null, territory: 5 })).toEqual({
      place: 77,
      territory: 9,
    });
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "info", text1: "country_changed" }),
    );
  });

  it("does not chase a country the new place does not have", async () => {
    await placeCreated(null);

    expect(mockSetTerritoryValue).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });
});

describe("editing the parent diary", () => {
  it("opens the diary the observation belongs to", async () => {
    mockRoute = createRouteMock("ObservationEditor", { diaryId: 11 });
    await render(<ObservationEditorScreen />);

    await fireEvent.press(screen.getByTestId("edit-diary"));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryDetail", {
      diaryId: 11,
    });
  });

  it("does nothing outside diary mode", async () => {
    await render(<ObservationEditorScreen />);

    await fireEvent.press(screen.getByTestId("edit-diary"));

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});

// The species already in this diary are greyed out in the picker. The server
// list alone is not enough: a species added offline must be excluded too,
// otherwise it stays pickable again until it syncs.
describe("species already used in the diary", () => {
  it("combines the server list with locally pending ones", async () => {
    mockRoute = createRouteMock("ObservationEditor", { diaryId: 11 });
    (useQuery as jest.Mock).mockReturnValue({ data: [100, 200] });
    (observationRepository.getPendingSpeciesForDiary as jest.Mock).mockReturnValue(
      new Set([300]),
    );

    await render(<ObservationEditorScreen />);

    expect(screen.getByTestId("existing-species").props.children).toBe(
      "100,200,300",
    );
  });

  // Editing an existing observation must not grey out its own species —
  // otherwise the row being edited looks unavailable to itself.
  it("leaves the edited observation's own species pickable", async () => {
    mockRoute = createRouteMock("ObservationEditor", {
      diaryId: 11,
      observation: { id: 5 },
    });
    mockEditorForm({ itemWithParsedDate: { id: 5, species: 100 } });
    (useQuery as jest.Mock).mockReturnValue({ data: [100, 200] });
    (observationRepository.getPendingSpeciesForDiary as jest.Mock).mockReturnValue(
      new Set(),
    );

    await render(<ObservationEditorScreen />);

    expect(screen.getByTestId("existing-species").props.children).toBe("200");
  });

  it("stays empty outside diary mode", async () => {
    (useQuery as jest.Mock).mockReturnValue({ data: undefined });

    await render(<ObservationEditorScreen />);

    expect(screen.getByTestId("existing-species").props.children).toBe("");
    expect(observationRepository.getPendingSpeciesForDiary).not.toHaveBeenCalled();
  });
});

// A diary observation inherits date/place/country from its diary, so only the
// per-observation fields travel in the payload.
describe("the payload built in diary mode", () => {
  it("sends only the diary-scoped fields", async () => {
    mockRoute = createRouteMock("ObservationEditor", { diaryId: 11 });
    mockEditorForm({
      formData: {
        species: 42,
        diary: 11,
        time: "08:00",
        quantity: 3,
        notes: "Singing",
        location_private: false,
        date_time: "2026-01-01",
        territory: 5,
        place: 77,
      },
    });
    await render(<ObservationEditorScreen />);

    await pressSave();

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          species: 42,
          diary: 11,
          time: "08:00",
          quantity: 3,
          notes: "Singing",
          location_private: false,
        },
      }),
      expect.anything(),
    );
  });
});

describe("several species picked at once (diary mode)", () => {
  beforeEach(() => {
    mockRoute = createRouteMock("ObservationEditor", { diaryId: 11 });
    mockEditorForm({
      formData: { species: 42, diary: 11, time: "08:00", quantity: 2, notes: "Flock", date_time: "2026-01-01", territory: 5 },
    });
  });

  it("is offered only when creating inside a diary", async () => {
    await render(<ObservationEditorScreen />);
    expect(screen.getByTestId("multi-species-enabled")).toHaveTextContent("true");

    mockRoute = createRouteMock("ObservationEditor", { diaryId: 11, observation: { id: 5 } });
    await render(<ObservationEditorScreen />);
    expect(screen.getByTestId("multi-species-enabled")).toHaveTextContent("false");

    mockRoute = createRouteMock("ObservationEditor", {});
    await render(<ObservationEditorScreen />);
    expect(screen.getByTestId("multi-species-enabled")).toHaveTextContent("false");
  });

  it("saves one observation per species with the shared fields and returns to the diary", async () => {
    await render(<ObservationEditorScreen />);
    await fireEvent.press(screen.getByTestId("pick-multi-species"));

    await pressSave();

    expect(mockCreateMutate).not.toHaveBeenCalled();
    const [vars, { onSuccess }] = mockCreateManyMutate.mock.calls[0];
    // quantity and notes are per species, so the form's values are dropped for the set.
    const shared = { diary: 11, time: "08:00", quantity: null, notes: "", location_private: true };
    expect(vars.items).toEqual([
      { payload: { ...shared, species: 42 }, speciesData: { value: 42, label: "Tit" } },
      { payload: { ...shared, species: 43 }, speciesData: { value: 43, label: "Wren" } },
    ]);

    await act(async () => {
      onSuccess([{ id: -1 }, { id: -2 }]);
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["DiarySpecies", 11] });
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});
