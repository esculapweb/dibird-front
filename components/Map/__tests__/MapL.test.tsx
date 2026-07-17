jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@react-native-clipboard/clipboard", () => ({ setString: jest.fn() }));
jest.mock("../../../services/sync/networkStatus", () => ({
  isConnected: jest.fn(),
  subscribeToConnectionChange: jest.fn(),
}));

const mockMapCapture = jest.fn();
jest.mock("@maplibre/maplibre-react-native", () => {
  const { View } = require("react-native");
  return {
    Map: (props: {
      children?: import("react").ReactNode;
      onPress: (e: unknown) => void;
      onDidFinishLoadingMap: () => void;
      onDidFailLoadingMap: () => void;
    }) => {
      mockMapCapture(props);
      return <View testID="map-view">{props.children}</View>;
    },
    Camera: () => null,
    Images: () => null,
    RasterSource: () => null,
    GeoJSONSource: () => null,
    Layer: () => null,
  };
});

import { Linking } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import Clipboard from "@react-native-clipboard/clipboard";
import { isConnected, subscribeToConnectionChange } from "../../../services/sync/networkStatus";
import MapL from "../MapL";

const mockOnPress = jest.fn();
const mockOnUseMyLocation = jest.fn();
const mockUnsubscribe = jest.fn();

const mapProps = () => mockMapCapture.mock.calls.at(-1)![0] as {
  onPress: (e: { nativeEvent: unknown }) => void;
  onDidFinishLoadingMap: () => void;
  onDidFailLoadingMap: () => void;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (isConnected as jest.Mock).mockReturnValue(true);
  (subscribeToConnectionChange as jest.Mock).mockReturnValue(mockUnsubscribe);
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("offline", () => {
  it("shows the offline fallback instead of the map, with no retry button", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    await render(<MapL currentCoords={[2, 48]} />);

    expect(screen.getByText("map_unavailable_offline")).toBeOnTheScreen();
    expect(screen.getByText("cloud-offline-outline")).toBeOnTheScreen();
    expect(screen.queryByTestId("map-view")).not.toBeOnTheScreen();
    expect(screen.queryByText("try_again")).not.toBeOnTheScreen();
  });

  it("shows an offline hint only when onUseMyLocation is provided", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    const { rerender } = await render(<MapL currentCoords={[2, 48]} />);
    expect(screen.queryByText("map_offline_hint")).not.toBeOnTheScreen();

    await rerender(<MapL currentCoords={[2, 48]} onUseMyLocation={mockOnUseMyLocation} />);
    expect(screen.getByText("map_offline_hint")).toBeOnTheScreen();
  });

  it("reacts to a live connectivity change via subscribeToConnectionChange", async () => {
    (isConnected as jest.Mock).mockReturnValue(true);
    await render(<MapL currentCoords={[2, 48]} />);
    expect(screen.queryByText("map_unavailable_offline")).not.toBeOnTheScreen();

    const callback = (subscribeToConnectionChange as jest.Mock).mock.calls[0][0] as (c: boolean) => void;
    await act(async () => callback(false));
    expect(screen.getByText("map_unavailable_offline")).toBeOnTheScreen();
  });
});

describe("map load timeout", () => {
  it("shows a loading spinner, then falls back to a timeout message after 8s without a load callback", async () => {
    await render(<MapL currentCoords={[2, 48]} />);
    expect(screen.getByTestId("map-view")).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(screen.getByText("connection_timeout")).toBeOnTheScreen();
    expect(screen.getByText("try_again")).toBeOnTheScreen();
  });

  it("does not fall back once the map reports it finished loading", async () => {
    await render(<MapL currentCoords={[2, 48]} />);
    await act(async () => {
      mapProps().onDidFinishLoadingMap();
    });

    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(screen.queryByText("connection_timeout")).not.toBeOnTheScreen();
    expect(screen.getByTestId("map-view")).toBeOnTheScreen();
  });

  it("falls back immediately when the map reports a load error", async () => {
    await render(<MapL currentCoords={[2, 48]} />);
    await act(async () => {
      mapProps().onDidFailLoadingMap();
    });
    expect(screen.getByText("connection_timeout")).toBeOnTheScreen();
  });

  it("retry resets the failed state and remounts the map", async () => {
    await render(<MapL currentCoords={[2, 48]} />);
    await act(async () => {
      mapProps().onDidFailLoadingMap();
    });
    expect(screen.getByText("connection_timeout")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("try_again"));
    expect(screen.queryByText("connection_timeout")).not.toBeOnTheScreen();
    expect(screen.getByTestId("map-view")).toBeOnTheScreen();
  });
});

describe("map onPress", () => {
  it("forwards the native event to the onPress prop", async () => {
    await render(<MapL currentCoords={[2, 48]} onPress={mockOnPress} />);
    const fakeEvent = { nativeEvent: { coordinates: [2, 48] } };

    await act(async () => mapProps().onPress(fakeEvent));
    expect(mockOnPress).toHaveBeenCalledWith(fakeEvent.nativeEvent);
  });
});

describe("copy coordinates", () => {
  it("copies lat,lng and shows a toast when the overlay is pressed", async () => {
    await render(<MapL currentCoords={[2.12345, 48.6789]} showCoords />);
    await fireEvent.press(screen.getByText("48.6789, 2.1235", { exact: false }));

    expect(Clipboard.setString).toHaveBeenCalledWith("48.6789, 2.1235");
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", text1: "coordinates_copied" }),
    );
  });

  it("shows the coords overlay only when showCoords is true and coords are set", async () => {
    const { rerender } = await render(<MapL currentCoords={[2, 48]} />);
    expect(screen.queryByText("48.0000, 2.0000", { exact: false })).not.toBeOnTheScreen();

    await rerender(<MapL currentCoords={[2, 48]} showCoords />);
    expect(screen.getByText("48.0000, 2.0000", { exact: false })).toBeOnTheScreen();
  });

  it("also offers a copy button on the fallback screen when coords are known", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    await render(<MapL currentCoords={[2, 48]} />);
    await fireEvent.press(screen.getByText("48.0000, 2.0000", { exact: false }));
    expect(Clipboard.setString).toHaveBeenCalledWith("48.0000, 2.0000");
  });
});

describe("use my location button", () => {
  it("is hidden without onUseMyLocation", async () => {
    await render(<MapL currentCoords={[2, 48]} />);
    expect(screen.queryByText("gps_locate_me_button")).not.toBeOnTheScreen();
  });

  it("shows a spinner while locating, a nav icon otherwise, and calls the handler on tap", async () => {
    const { rerender } = await render(
      <MapL currentCoords={[2, 48]} onUseMyLocation={mockOnUseMyLocation} isLocating />,
    );
    expect(screen.queryByText("navigate")).not.toBeOnTheScreen();

    await rerender(<MapL currentCoords={[2, 48]} onUseMyLocation={mockOnUseMyLocation} isLocating={false} />);
    expect(screen.getByText("navigate")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("gps_locate_me_button"));
    expect(mockOnUseMyLocation).toHaveBeenCalledTimes(1);
  });

  it("stays usable even while the map fallback is shown (GPS doesn't need connectivity)", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    await render(<MapL currentCoords={[2, 48]} onUseMyLocation={mockOnUseMyLocation} />);
    expect(screen.getByText("gps_locate_me_button")).toBeOnTheScreen();
  });
});

describe("accuracy overlay", () => {
  it("is hidden without onUseMyLocation, even with accuracy set", async () => {
    await render(<MapL currentCoords={[2, 48]} accuracy={20} />);
    expect(screen.queryByText("gps_accuracy_label", { exact: false })).not.toBeOnTheScreen();
  });

  it("is hidden when accuracy is 0/undefined", async () => {
    await render(<MapL currentCoords={[2, 48]} onUseMyLocation={mockOnUseMyLocation} accuracy={0} />);
    expect(screen.queryByText("gps_accuracy_label", { exact: false })).not.toBeOnTheScreen();
  });

  it("shows a plain locate icon for good accuracy (<=100)", async () => {
    await render(<MapL currentCoords={[2, 48]} onUseMyLocation={mockOnUseMyLocation} accuracy={50} />);
    expect(screen.getByText("locate-outline")).toBeOnTheScreen();
    expect(screen.getByText('gps_accuracy_label:{"value":50}', { exact: false })).toBeOnTheScreen();
  });

  it("shows a warning icon for poor accuracy (>100)", async () => {
    await render(<MapL currentCoords={[2, 48]} onUseMyLocation={mockOnUseMyLocation} accuracy={150} />);
    expect(screen.getByText("warning-outline")).toBeOnTheScreen();
  });
});

describe("attribution", () => {
  it("opens the OSM copyright page when pressed", async () => {
    await render(<MapL currentCoords={[2, 48]} />);
    await fireEvent.press(screen.getByText("© OpenStreetMap contributors"));
    expect(Linking.openURL).toHaveBeenCalledWith("https://www.openstreetmap.org/copyright");
  });

  it("is hidden while the fallback is shown", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    await render(<MapL currentCoords={[2, 48]} />);
    expect(screen.queryByText("© OpenStreetMap contributors")).not.toBeOnTheScreen();
  });
});
