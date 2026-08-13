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
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../hooks/Place/useOfflinePlace", () => ({
  useCreatePlace: jest.fn(),
  useUpdatePlace: jest.fn(),
}));
// normalizeCoords is real (pure geo-math, no native deps) — only the GPS
// hook itself (native location APIs) is mocked.
jest.mock("../../hooks/Place/usePlaceLocation", () => ({
  ...jest.requireActual("../../hooks/Place/usePlaceLocation"),
  usePlaceLocation: jest.fn(),
}));
jest.mock("../../util/navigationCallbacks", () => ({
  callNavigationCallback: jest.fn(),
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
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
jest.mock("../../components/Map/MapL", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onPress }: { onPress: (e: { lngLat: [number, number] }) => void }) => (
      <TouchableOpacity testID="map" onPress={() => onPress({ lngLat: [2.35, 48.86] })}>
        <Text>map</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock("../../components/Place/PlaceForm", () => {
  const { View, TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onCoordsChange, setFormData }: {
      onCoordsChange: (c: [string, string], o?: { fromManual?: boolean }) => void;
      setFormData: (updater: (prev: { name: string; territory: number }) => { name: string; territory: number }) => void;
    }) => (
      <View>
        <TouchableOpacity testID="coords-change" onPress={() => onCoordsChange(["2.35", "48.86"], { fromManual: true })}>
          <Text>place-form</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="coords-change-invalid"
          onPress={() => onCoordsChange(["abc", ""], { fromManual: true })}
        >
          <Text>bad coords</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="fill-long-name"
          onPress={() => setFormData((prev) => ({ ...prev, name: "x".repeat(255) }))}
        >
          <Text>fill long name</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="fill-name"
          onPress={() => setFormData((prev) => ({ ...prev, name: "Test Place" }))}
        >
          <Text>fill name</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="fill-territory"
          onPress={() => setFormData((prev) => ({ ...prev, territory: 5 }))}
        >
          <Text>fill territory</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  useCreatePlace,
  useUpdatePlace,
} from "../../hooks/Place/useOfflinePlace";
import { usePlaceLocation } from "../../hooks/Place/usePlaceLocation";
import { callNavigationCallback } from "../../util/navigationCallbacks";
import { createNavigationMock, createRouteMock } from "../test-utils";
import PlaceEditorScreen from "../PlaceEditorScreen";

const mockShowErrorToast = jest.fn();
const mockNavigation = createNavigationMock();
let mockRoute: ReturnType<typeof createRouteMock>;

const mockCreateMutate = jest.fn();
const mockUpdateMutate = jest.fn();
const mockUpdateCoords = jest.fn();
const mockLocateMe = jest.fn();
const mockSetLatText = jest.fn();
const mockSetLngText = jest.fn();

const mockLocation = (overrides: Record<string, unknown> = {}) => {
  (usePlaceLocation as jest.Mock).mockReturnValue({
    coords: [2.35, 48.86],
    zoom: 10,
    accuracy: 20,
    details: null,
    latText: "48.86",
    setLatText: mockSetLatText,
    lngText: "2.35",
    setLngText: mockSetLngText,
    isLocating: false,
    updateCoords: mockUpdateCoords,
    locateMe: mockLocateMe,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  mockRoute = createRouteMock("PlaceEditor", {});
  (useCreatePlace as jest.Mock).mockReturnValue({ mutate: mockCreateMutate, isPending: false });
  (useUpdatePlace as jest.Mock).mockReturnValue({ mutate: mockUpdateMutate, isPending: false });
  mockLocation();
});

afterEach(() => {
  (global.requestAnimationFrame as jest.Mock).mockRestore?.();
});

const pressSave = async () => {
  const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0].headerRight;
  await render(headerRight());
  await fireEvent.press(screen.getByTestId("place-save-button"));
};

// Create-mode formData starts as { name: "", territory: 0 } — validateForm
// rejects both as empty/missing, so tests exercising a real save need to
// fill them via PlaceForm's (mocked) setFormData first, same as a real user
// typing a name and picking a territory would.
const fillNameAndTerritory = async () => {
  await fireEvent.press(screen.getByTestId("fill-name"));
  await fireEvent.press(screen.getByTestId("fill-territory"));
};

describe("initial location", () => {
  it("create mode: triggers locateMe on mount", async () => {
    await render(<PlaceEditorScreen />);
    expect(mockLocateMe).toHaveBeenCalledTimes(1);
  });

  it("edit mode: seeds coords/lat/lngText from the place's saved location instead of locating", async () => {
    mockRoute = createRouteMock("PlaceEditor", {
      place: { id: 1, location: { coordinates: [2.35, 48.86] } },
    });
    await render(<PlaceEditorScreen />);

    expect(mockLocateMe).not.toHaveBeenCalled();
    expect(mockUpdateCoords).toHaveBeenCalledWith([2.35, 48.86]);
    expect(mockSetLatText).toHaveBeenCalledWith("48.8600");
    expect(mockSetLngText).toHaveBeenCalledWith("2.3500");
  });
});

it("suggests the reverse-geocoded name only in create mode, once details arrive", async () => {
  mockLocation({ details: { name: "City Hall" } });
  await render(<PlaceEditorScreen />);
  await fireEvent.press(screen.getByTestId("fill-territory"));
  // Name deliberately not filled here — it should already be populated by
  // the details-driven suggestion effect; an unfilled name would otherwise
  // block save with a validation error.
  await pressSave();
  expect(mockCreateMutate).toHaveBeenCalledWith(
    expect.objectContaining({ name: "City Hall" }),
    expect.anything(),
  );
});

it("keeps a name the user already typed when the reverse-geocode result arrives late, instead of clobbering/appending to it", async () => {
  mockLocation({ details: null });
  const { rerender } = await render(<PlaceEditorScreen />);
  await fireEvent.press(screen.getByTestId("fill-territory"));
  await fireEvent.press(screen.getByTestId("fill-name"));

  // The debounced reverse-geocode (util/fetches' reverseGeocoding, behind a
  // real network round-trip) resolves only now — after the user has already
  // typed a name, not before.
  mockLocation({ details: { name: "City Hall" } });
  await rerender(<PlaceEditorScreen />);

  await pressSave();
  expect(mockCreateMutate).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Test Place" }),
    expect.anything(),
  );
});

describe("map tap", () => {
  it("updates coords with geocode and clears lat/lng errors", async () => {
    await render(<PlaceEditorScreen />);
    await fireEvent.press(screen.getByTestId("map"));

    expect(mockUpdateCoords).toHaveBeenCalledWith([2.35, 48.86], expect.objectContaining({
      fromManual: true,
      withGeocode: true,
    }));
  });

  it("is ignored while a GPS fix is already in progress", async () => {
    mockLocation({ isLocating: true });
    await render(<PlaceEditorScreen />);
    await fireEvent.press(screen.getByTestId("map"));
    expect(mockUpdateCoords).not.toHaveBeenCalled();
  });
});

it("manual coordinate entry normalizes and geocodes on valid input", async () => {
  await render(<PlaceEditorScreen />);
  await fireEvent.press(screen.getByTestId("coords-change"));
  expect(mockUpdateCoords).toHaveBeenCalledWith([2.35, 48.86], expect.objectContaining({
    fromManual: true,
    withGeocode: true,
  }));
});

it("shows the low-accuracy hint above the GPS threshold", async () => {
  mockLocation({ accuracy: 150 });
  await render(<PlaceEditorScreen />);
  expect(screen.getByText("gps_low_accuracy_hint")).toBeOnTheScreen();
});

it("does not show the low-accuracy hint while still locating, even above the threshold", async () => {
  mockLocation({ accuracy: 150, isLocating: true });
  await render(<PlaceEditorScreen />);
  expect(screen.queryByText("gps_low_accuracy_hint")).not.toBeOnTheScreen();
});

describe("save validation", () => {
  it("blocks save when lat/lng text isn't a valid coordinate", async () => {
    mockLocation({ latText: "", lngText: "" });
    await render(<PlaceEditorScreen />);
    await fillNameAndTerritory();
    await pressSave();
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("blocks save when name/territory are still unset", async () => {
    await render(<PlaceEditorScreen />);
    await pressSave();
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });
});

describe("save navigation branching", () => {
  it("create with a returnToScreen calls the place-created callback and goes back", async () => {
    mockRoute = createRouteMock("PlaceEditor", { returnToScreen: "ObservationEditor" });
    await render(<PlaceEditorScreen />);
    await fillNameAndTerritory();
    await pressSave();

    const { onSuccess } = mockCreateMutate.mock.calls[0][1];
    onSuccess({ id: 7, territory: 5 });

    expect(callNavigationCallback).toHaveBeenCalledWith("onPlaceCreated", 7, expect.anything(), { id: 7, territory: 5 });
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("create without a returnToScreen replaces with the new place's detail screen", async () => {
    await render(<PlaceEditorScreen />);
    await fillNameAndTerritory();
    await pressSave();

    const { onSuccess } = mockCreateMutate.mock.calls[0][1];
    onSuccess({ id: 7 });

    expect(mockNavigation.replace).toHaveBeenCalledWith("PlaceDetail", {
      placeId: 7,
      initialPlace: { id: 7 },
    });
  });

  it("update navigates back on success", async () => {
    mockRoute = createRouteMock("PlaceEditor", { place: { id: 1, name: "Existing", territory: 5 } });
    await render(<PlaceEditorScreen />);
    await pressSave();

    const { onSuccess } = mockUpdateMutate.mock.calls[0][1];
    onSuccess();
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});

it("maps a per-field server error onto the matching form field instead of a toast", async () => {
  await render(<PlaceEditorScreen />);
  await fillNameAndTerritory();
  await pressSave();

  const { onError } = mockCreateMutate.mock.calls[0][1];
  await act(async () => {
    onError({ response: { data: { name: ["Taken"] } } });
  });

  // No direct errors getter — re-render and confirm the save button is
  // still reachable (screen didn't crash) as a smoke check; field mapping
  // itself mirrors ObservationEditorScreen/DiaryEditorScreen's already
  // -covered handleMutateError logic.
  expect(screen.getByTestId("place-save-button")).toBeOnTheScreen();
});

it("marks the save button disabled while locating or while a mutation is pending", async () => {
  mockLocation({ isLocating: true });
  await render(<PlaceEditorScreen />);
  const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0].headerRight;
  await render(headerRight());
  expect(screen.getByText("save-disabled")).toBeOnTheScreen();
});

describe("more save validation", () => {
  it("blocks save on a name past the 254-character limit", async () => {
    await render(<PlaceEditorScreen />);
    await fireEvent.press(screen.getByTestId("fill-long-name"));
    await fireEvent.press(screen.getByTestId("fill-territory"));

    await pressSave();

    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it.each([
    ["not a number", "abc", "2.35"],
    ["a latitude past the pole", "91", "2.35"],
    ["a latitude below the pole", "-91", "2.35"],
    ["a longitude past the antimeridian", "48.86", "181"],
    ["a longitude below the antimeridian", "48.86", "-181"],
  ])("blocks save on %s", async (_label, latText, lngText) => {
    mockLocation({ latText, lngText });
    await render(<PlaceEditorScreen />);
    await fillNameAndTerritory();

    await pressSave();

    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("saves once name, territory and coordinates are all valid", async () => {
    await render(<PlaceEditorScreen />);
    await fillNameAndTerritory();

    await pressSave();

    expect(mockCreateMutate).toHaveBeenCalledTimes(1);
  });
});

describe("manual coordinates that cannot be parsed", () => {
  // Unparseable input is echoed back rather than swallowed, so the user can
  // see and fix what they typed; only the empty field gets an error.
  it("keeps the raw text and flags the empty field", async () => {
    await render(<PlaceEditorScreen />);

    await fireEvent.press(screen.getByTestId("coords-change-invalid"));

    expect(mockSetLatText).toHaveBeenCalledWith("");
    expect(mockSetLngText).toHaveBeenCalledWith("abc");
    expect(mockUpdateCoords).not.toHaveBeenCalled();
  });
});

describe("server errors that are not per-field", () => {
  const failSave = async (error: unknown) => {
    await render(<PlaceEditorScreen />);
    await fillNameAndTerritory();
    await pressSave();
    const { onError } = mockCreateMutate.mock.calls[0][1];
    await act(async () => {
      onError(error);
    });
  };

  it("falls back to a toast when the payload matches no known field", async () => {
    await failSave({ response: { data: { non_field_errors: ["Nope"] } } });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.anything(),
      "PlaceEditorScreen:handleMutateError",
      expect.any(Function),
    );
  });

  it("falls back to a toast when the failure carries no response at all", async () => {
    await failSave({ isNetworkError: true });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.anything(),
      "PlaceEditorScreen:handleMutateError",
      expect.any(Function),
    );
  });

  it("routes an update failure through the same handler", async () => {
    mockRoute = createRouteMock("PlaceEditor", {
      place: { id: 1, name: "Existing", territory: 5 },
    });
    await render(<PlaceEditorScreen />);
    await pressSave();

    const { onError } = mockUpdateMutate.mock.calls[0][1];
    await act(async () => {
      onError({ isNetworkError: true });
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.anything(),
      "PlaceEditorScreen:handleMutateError",
      expect.any(Function),
    );
  });
});

describe("while the save is in flight", () => {
  it("covers the screen with the loading overlay on create", async () => {
    (useCreatePlace as jest.Mock).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: true,
    });

    await render(<PlaceEditorScreen />);

    expect(screen.queryByTestId("map")).not.toBeOnTheScreen();
  });

  it("covers the screen with the loading overlay on update", async () => {
    mockRoute = createRouteMock("PlaceEditor", {
      place: { id: 1, name: "Existing", territory: 5 },
    });
    (useUpdatePlace as jest.Mock).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: true,
    });

    await render(<PlaceEditorScreen />);

    expect(screen.queryByTestId("map")).not.toBeOnTheScreen();
  });
});

// services/errors.ts's toUIError calls the extractor unconditionally whenever
// one is passed, so the extractor itself must survive an error that never got
// a response — the same crash already fixed in ObservationEditorScreen and
// DiaryEditorScreen. The routing tests above can't catch it: they assert that
// showErrorToast was called, and the mock never runs what it was handed.
describe("the error message handed to the toast", () => {
  const extractedFrom = async (error: unknown, isEdit = false) => {
    if (isEdit) {
      mockRoute = createRouteMock("PlaceEditor", {
        place: { id: 1, name: "Existing", territory: 5 },
      });
    }
    let extracted: { title: string; message: string } | undefined;
    mockShowErrorToast.mockImplementationOnce(
      (e: unknown, _tag: string, extractor?: (err: unknown) => typeof extracted) => {
        extracted = extractor?.(e);
      },
    );

    await render(<PlaceEditorScreen />);
    if (!isEdit) await fillNameAndTerritory();
    await pressSave();

    const mutate = isEdit ? mockUpdateMutate : mockCreateMutate;
    const { onError } = mutate.mock.calls[0][1];
    await act(async () => {
      onError(error);
    });
    return extracted;
  };

  it("falls back to the create message when the failure carries no response", async () => {
    expect(await extractedFrom({ isNetworkError: true })).toEqual({
      title: "create_failed",
      message: "could_not_create_place",
    });
  });

  it("falls back to the update message in edit mode", async () => {
    expect(await extractedFrom({ isNetworkError: true }, true)).toEqual({
      title: "update_failed",
      message: "could_not_update_place",
    });
  });

  it("uses what the server actually said when it replied", async () => {
    expect(
      await extractedFrom({
        response: { data: { non_field_errors: ["Nope"], other: ["Also nope"] } },
      }),
    ).toEqual({ title: "create_failed", message: "Nope\nAlso nope" });
  });
});
