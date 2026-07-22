jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});

const mockSliderCapture = jest.fn();
jest.mock("@react-native-community/slider", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSliderCapture(props);
    return null;
  },
}));

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
};
let mockStatus: Record<string, unknown>;

jest.mock("expo-audio", () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import TaxonSoundRow from "../TaxonSoundRow";
import { TaxonSound } from "../../../types";

const SOUND: TaxonSound = {
  xeno_id: 363809,
  type: "flight call",
  recorder: "Annette Hamann",
  country: "Germany",
  license: "//creativecommons.org/licenses/by-nc-sa/4.0/",
  sound: "https://dibird.com/media/xeno/363809.mp3",
};

const sliderProps = () =>
  mockSliderCapture.mock.calls.at(-1)![0] as {
    value: number;
    maximumValue: number;
    disabled: boolean;
    onSlidingStart: () => void;
    onValueChange: (v: number) => void;
    onSlidingComplete: (v: number) => void;
  };

const renderRow = (
  props: Partial<React.ComponentProps<typeof TaxonSoundRow>> = {},
) =>
  render(
    <TaxonSoundRow
      sound={SOUND}
      isActive={false}
      onPlay={mockOnPlay}
      {...props}
    />,
  );

const mockOnPlay = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = { playing: false, didJustFinish: false, currentTime: 0, duration: 0 };
});

it("shows only the recording's details until it is played", async () => {
  await renderRow();

  expect(screen.getByText("flight call")).toBeOnTheScreen();
  expect(screen.getByText("Annette Hamann, Germany")).toBeOnTheScreen();
  expect(screen.queryByTestId(`sound-slider-${SOUND.xeno_id}`)).toBeNull();
  expect(mockSliderCapture).not.toHaveBeenCalled();
});

it("starts playback and claims the player when play is tapped", async () => {
  await renderRow();

  await fireEvent.press(screen.getByText("icon-play-circle"));

  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockOnPlay).toHaveBeenCalledTimes(1);
});

it("shows a scrub bar with elapsed and total time once it owns the player", async () => {
  mockStatus = { playing: true, didJustFinish: false, currentTime: 42, duration: 125 };

  await renderRow({ isActive: true });

  expect(screen.getByText("icon-pause-circle")).toBeOnTheScreen();
  expect(screen.getByText("0:42")).toBeOnTheScreen();
  expect(screen.getByText("2:05")).toBeOnTheScreen();
  expect(sliderProps().value).toBe(42);
  expect(sliderProps().maximumValue).toBe(125);
});

it("seeks to where the thumb was dropped, not to every position it passed", async () => {
  mockStatus = { playing: true, didJustFinish: false, currentTime: 10, duration: 100 };

  await renderRow({ isActive: true });

  await act(async () => {
    sliderProps().onSlidingStart();
    sliderProps().onValueChange(55);
  });
  expect(mockPlayer.seekTo).not.toHaveBeenCalled();

  await act(async () => sliderProps().onSlidingComplete(70));
  expect(mockPlayer.seekTo).toHaveBeenCalledWith(70);
});

it("follows the finger while dragging instead of snapping back to the playhead", async () => {
  mockStatus = { playing: true, didJustFinish: false, currentTime: 10, duration: 100 };

  await renderRow({ isActive: true });

  await act(async () => {
    sliderProps().onSlidingStart();
    sliderProps().onValueChange(55);
  });

  expect(screen.getByText("0:55")).toBeOnTheScreen();
});

it("pauses without giving up the player, so the bar stays available", async () => {
  mockStatus = { playing: true, didJustFinish: false, currentTime: 10, duration: 100 };

  await renderRow({ isActive: true });
  await fireEvent.press(screen.getByText("icon-pause-circle"));

  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  expect(mockOnPlay).not.toHaveBeenCalled();
  expect(sliderProps().value).toBe(10);
});

it("rewinds when the recording ends so it can be replayed", async () => {
  mockStatus = { playing: false, didJustFinish: true, currentTime: 100, duration: 100 };

  await renderRow({ isActive: true });

  expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
});

it("stops playing as soon as another recording takes over", async () => {
  mockStatus = { playing: true, didJustFinish: false, currentTime: 10, duration: 100 };

  await renderRow({ isActive: false });

  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
});

it("keeps the bar at the start, not the end, when the stream reports no duration", async () => {
  // Xeno-canto streams report duration 0 throughout playback — scaling the
  // track to a guess used to peg the thumb at the end a second in.
  mockStatus = { playing: true, didJustFinish: false, currentTime: 7, duration: 0 };

  await renderRow({ isActive: true });

  expect(sliderProps().disabled).toBe(true);
  expect(sliderProps().value).toBe(0);
  expect(screen.getByText("0:07")).toBeOnTheScreen();
  expect(screen.getByText("--:--")).toBeOnTheScreen();
});

it("ignores a momentary zero duration once a real one has been seen", async () => {
  mockStatus = { playing: true, didJustFinish: false, currentTime: 5, duration: 60 };
  const row = await renderRow({ isActive: true });

  mockStatus = { playing: true, didJustFinish: false, currentTime: 6, duration: 0 };
  await act(async () => {
    row.rerender(<TaxonSoundRow sound={SOUND} isActive onPlay={mockOnPlay} />);
  });

  expect(sliderProps().value).toBe(6);
  expect(sliderProps().maximumValue).toBe(60);
  expect(sliderProps().disabled).toBe(false);
});

it("cannot be scrubbed while it is a live stream", async () => {
  mockStatus = { playing: true, didJustFinish: false, currentTime: 5, duration: 60, isLive: true };

  await renderRow({ isActive: true });

  expect(sliderProps().disabled).toBe(true);
});
