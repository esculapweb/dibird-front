jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

type PinchEvent = { scale: number };
type PanEvent = { translationX: number; translationY: number };

type MockGesture = {
  kind: "pinch" | "pan" | "tap";
  handlers: {
    onUpdate?: (e: PinchEvent | PanEvent) => void;
    onEnd?: () => void;
  };
  enabledFlag: boolean;
};

// The real Gesture builders hand their callbacks to the native side, which
// never runs under jest — so record the builders instead and drive the
// worklets straight from the test. Everything they touch (shared values,
// runOnJS(setZoomed)) is the component's own real code.
const mockGestures: MockGesture[] = [];

jest.mock("react-native-gesture-handler", () => {
  const make = (kind: string) => {
    const g = { kind, handlers: {}, enabledFlag: true } as MockGesture &
      Record<string, unknown>;
    g.onUpdate = (fn: MockGesture["handlers"]["onUpdate"]) => {
      g.handlers.onUpdate = fn;
      return g;
    };
    g.onEnd = (fn: MockGesture["handlers"]["onEnd"]) => {
      g.handlers.onEnd = fn;
      return g;
    };
    g.enabled = (v: boolean) => {
      g.enabledFlag = v;
      return g;
    };
    g.numberOfTaps = () => g;
    mockGestures.push(g);
    return g;
  };
  return {
    Gesture: {
      Pinch: () => make("pinch"),
      Pan: () => make("pan"),
      Tap: () => make("tap"),
      Simultaneous: (...gs: unknown[]) => ({ gs }),
      Race: (...gs: unknown[]) => ({ gs }),
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { getAnimatedStyle } from "react-native-reanimated";
import PhotoViewerModal, { PhotoViewerItem } from "../PhotoViewerModal";

const mockOnClose = jest.fn();

const PHOTOS: PhotoViewerItem[] = [
  { uri: "first.jpg", credit: "© First" },
  { uri: "second.jpg", credit: null },
  { uri: "third.jpg", credit: "© Third" },
];

const renderViewer = (
  props: Partial<React.ComponentProps<typeof PhotoViewerModal>> = {},
) =>
  render(
    <PhotoViewerModal
      visible
      photos={PHOTOS}
      initialIndex={0}
      onClose={mockOnClose}
      {...props}
    />,
  );

const listProps = () => screen.getByTestId("photo-viewer-list").props;

// Page width comes from useWindowDimensions, so read it back out of the
// list's own layout instead of hardcoding jest's screen size.
const pageWidth = () => listProps().getItemLayout(null, 1).offset;

const scrollToPage = (index: number) =>
  act(async () => {
    listProps().onMomentumScrollEnd({
      nativeEvent: { contentOffset: { x: pageWidth() * index } },
    });
  });

// The last builder of a kind belongs to the most recent render; shared values
// survive re-renders, so driving the freshest closure is always correct.
const latest = (kind: MockGesture["kind"]) => {
  const g = [...mockGestures].reverse().find((item) => item.kind === kind);
  if (!g) throw new Error(`no ${kind} gesture was registered`);
  return g;
};

// With several photos on screen every render registers one builder of each
// kind per photo, in photo order — so the last `photoCount` of a kind are the
// current render's, one per photo.
const latestFor = (
  kind: MockGesture["kind"],
  photoIndex: number,
  photoCount: number,
) => {
  const g = mockGestures.filter((item) => item.kind === kind).slice(-photoCount)[
    photoIndex
  ];
  if (!g) throw new Error(`no ${kind} gesture for photo ${photoIndex}`);
  return g;
};

type Transform = { translateX: number; translateY: number; scale: number };

const transformOf = (index = 0) => {
  const style = getAnimatedStyle(screen.getAllByTestId("photo-viewer-image")[index]);
  return Object.assign(
    {},
    ...(style.transform as unknown as Record<string, number>[]),
  ) as Transform;
};

// Two things land a frame or more after a gesture callback returns: withTiming
// (used by `reset()` and the double-tap zoom) needs the frame loop to reach its
// target, and runOnJS(setZoomed) only gets back to the JS thread on the next
// tick. That is why the assertions below poll with waitFor rather than reading
// straight after the act().
const pinch = (scale: number) =>
  act(async () => {
    latest("pinch").handlers.onUpdate?.({ scale });
  });

const endPinch = () =>
  act(async () => {
    latest("pinch").handlers.onEnd?.();
  });

const doubleTap = () =>
  act(async () => {
    latest("tap").handlers.onEnd?.();
  });

const pan = (translationX: number, translationY: number) =>
  act(async () => {
    latest("pan").handlers.onUpdate?.({ translationX, translationY });
  });

const endPan = () =>
  act(async () => {
    latest("pan").handlers.onEnd?.();
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockGestures.length = 0;
});

it("renders nothing when there is no photo to show", async () => {
  await renderViewer({ photos: [] });

  expect(screen.toJSON()).toBeNull();
});

it("closes on the close button", async () => {
  await renderViewer();

  await fireEvent.press(screen.getByTestId("photo-viewer-close"));

  expect(mockOnClose).toHaveBeenCalledTimes(1);
});

describe("paging", () => {
  it("shows no page indicator for a single photo", async () => {
    await renderViewer({ photos: [PHOTOS[0]] });

    expect(screen.queryByText("1 / 1")).not.toBeOnTheScreen();
  });

  it("counts the pages from the initial index", async () => {
    await renderViewer({ initialIndex: 1 });

    expect(screen.getByText("2 / 3")).toBeOnTheScreen();
  });

  it("follows the page the user scrolled to", async () => {
    await renderViewer();

    await scrollToPage(2);

    expect(screen.getByText("3 / 3")).toBeOnTheScreen();
  });

  it("lays every page out one screen apart", async () => {
    await renderViewer();
    const width = pageWidth();

    expect(listProps().getItemLayout(null, 2)).toEqual({
      length: width,
      offset: width * 2,
      index: 2,
    });
  });

  it("rewinds to the requested photo when reopened", async () => {
    const { rerender } = await renderViewer();
    await scrollToPage(2);

    await act(async () => {
      rerender(
        <PhotoViewerModal
          visible={false}
          photos={PHOTOS}
          initialIndex={0}
          onClose={mockOnClose}
        />,
      );
    });
    await act(async () => {
      rerender(
        <PhotoViewerModal
          visible
          photos={PHOTOS}
          initialIndex={0}
          onClose={mockOnClose}
        />,
      );
    });

    expect(screen.getByText("1 / 3")).toBeOnTheScreen();
  });
});

describe("credit line", () => {
  it("shows the credit of the photo on screen", async () => {
    await renderViewer();

    expect(screen.getByText("© First")).toBeOnTheScreen();
  });

  it("hides it for a photo that has none", async () => {
    await renderViewer();

    await scrollToPage(1);

    expect(screen.queryByText("© First")).not.toBeOnTheScreen();
    expect(screen.queryByText("© Third")).not.toBeOnTheScreen();
  });

  it("swaps it as the pages change", async () => {
    await renderViewer();

    await scrollToPage(2);

    expect(screen.getByText("© Third")).toBeOnTheScreen();
  });
});

describe("zooming", () => {
  const single = () => renderViewer({ photos: [PHOTOS[0]] });

  it("pinches up to the maximum scale and no further", async () => {
    await single();

    await pinch(10);

    await waitFor(() => expect(transformOf().scale).toBe(4));
  });

  it("never pinches below the fitted size", async () => {
    await single();
    await pinch(3);
    await waitFor(() => expect(transformOf().scale).toBe(3));

    await pinch(0.2);

    await waitFor(() => expect(transformOf().scale).toBe(1));
  });

  it("locks the pager while a photo is zoomed", async () => {
    await single();

    await pinch(2);
    await endPinch();

    await waitFor(() => expect(listProps().scrollEnabled).toBe(false));
    expect(latest("pan").enabledFlag).toBe(true);
  });

  it("releases the pager once the photo is pinched back to fit", async () => {
    await single();
    await pinch(2);
    await endPinch();
    await waitFor(() => expect(listProps().scrollEnabled).toBe(false));

    await pinch(0.1);
    await endPinch();

    await waitFor(() => expect(listProps().scrollEnabled).toBe(true));
    expect(latest("pan").enabledFlag).toBe(false);
  });

  it("keeps panning disabled until the photo is zoomed", async () => {
    await single();

    expect(latest("pan").enabledFlag).toBe(false);
    expect(listProps().scrollEnabled).toBe(true);
  });

  it("zooms in on a double tap", async () => {
    await single();

    await doubleTap();

    await waitFor(() => expect(transformOf().scale).toBe(2.5));
    expect(listProps().scrollEnabled).toBe(false);
  });

  it("zooms back out on the next double tap", async () => {
    await single();
    await doubleTap();
    await waitFor(() => expect(transformOf().scale).toBe(2.5));

    await doubleTap();

    await waitFor(() => expect(transformOf().scale).toBe(1));
    expect(listProps().scrollEnabled).toBe(true);
  });

  it("resumes the next pan from where the last one stopped", async () => {
    await single();
    await doubleTap();

    await pan(30, -20);
    await endPan();
    await pan(5, 5);

    await waitFor(() =>
      expect(transformOf()).toMatchObject({ translateX: 35, translateY: -15 }),
    );
  });

  it("drops the pan offset when the zoom is released", async () => {
    await single();
    await doubleTap();
    await pan(30, -20);
    await endPan();

    await doubleTap();

    await waitFor(() =>
      expect(transformOf()).toMatchObject({ translateX: 0, translateY: 0 }),
    );
  });

  it("leaves zoom mode when the viewer is closed", async () => {
    await single();
    await doubleTap();
    await waitFor(() => expect(listProps().scrollEnabled).toBe(false));

    await fireEvent.press(screen.getByTestId("photo-viewer-close"));

    await waitFor(() => expect(listProps().scrollEnabled).toBe(true));
  });
});

// Closing the viewer drops the zoom *flag* but not the magnification of the
// photo itself, so the pager unlocks with photo 1 still scaled up. Paging away
// has to reset it, or coming back shows a photo the user never zoomed.
describe("paging away from a photo that is still magnified", () => {
  const doubleTapPhoto = (index: number) =>
    act(async () => {
      latestFor("tap", index, PHOTOS.length).handlers.onEnd?.();
    });

  it("resets it once it is no longer the photo on screen", async () => {
    await renderViewer();
    await doubleTapPhoto(0);
    await waitFor(() => expect(transformOf(0).scale).toBe(2.5));
    await fireEvent.press(screen.getByTestId("photo-viewer-close"));

    await scrollToPage(1);

    await waitFor(() => expect(transformOf(0).scale).toBe(1));
  });

  it("leaves the photo now on screen alone", async () => {
    await renderViewer();
    await doubleTapPhoto(1);
    await waitFor(() => expect(transformOf(1).scale).toBe(2.5));
    await fireEvent.press(screen.getByTestId("photo-viewer-close"));

    await scrollToPage(1);

    expect(transformOf(1).scale).toBe(2.5);
  });
});

describe("the actions menu", () => {
  it("offers no menu button unless the screen provides one", async () => {
    await renderViewer();

    expect(screen.queryByTestId("photo-viewer-more")).not.toBeOnTheScreen();
  });

  it("acts on the photo currently on screen, not the one it opened on", async () => {
    const onMorePress = jest.fn();
    await renderViewer({ onMorePress });

    await scrollToPage(2);
    await fireEvent.press(screen.getByTestId("photo-viewer-more"));

    expect(onMorePress).toHaveBeenCalledWith(2);
  });
});
