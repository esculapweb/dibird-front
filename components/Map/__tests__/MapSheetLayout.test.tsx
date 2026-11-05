jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
}));
const mockSheetCapture = jest.fn();
jest.mock("@gorhom/bottom-sheet", () => {
  const { View, ScrollView } = require("react-native");
  return {
    __esModule: true,
    default: (props: { children: import("react").ReactNode }) => {
      mockSheetCapture(props);
      return <View>{props.children}</View>;
    },
    BottomSheetScrollView: ScrollView,
  };
});
const mockMapCapture = jest.fn();
jest.mock("../MapL", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockMapCapture(props);
    return null;
  },
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import MapSheetLayout, { SHEET_PEEK_INDEX, SHEET_REST_INDEX } from "../MapSheetLayout";

const renderLayout = async (fitContent = false) => {
  await render(
    <MapSheetLayout
      testID="sheet"
      mapProps={{ currentCoords: [2.35, 48.86] }}
      fitContent={fitContent}
    >
      <Text>content</Text>
    </MapSheetLayout>,
  );
  // The screen under the header.
  await fireEvent(screen.root!, "layout", {
    nativeEvent: { layout: { height: 1000 } },
  });
};

const lastSnapPoints = () => mockSheetCapture.mock.calls.at(-1)![0].snapPoints;
const sizeContent = async (height: number) => {
  await fireEvent(screen.getByTestId("sheet"), "contentSizeChange", 390, height);
};
const lastMapProps = () => mockMapCapture.mock.calls.at(-1)![0];
const animateTo = async (toIndex: number) => {
  const { onAnimate } = mockSheetCapture.mock.calls.at(-1)![0];
  await act(async () => {
    onAnimate(SHEET_REST_INDEX, toIndex);
  });
};

beforeEach(() => jest.clearAllMocks());

it("opens at the resting height, with the peek below it", async () => {
  await renderLayout();
  const { index, snapPoints } = mockSheetCapture.mock.calls.at(-1)![0];

  expect(index).toBe(SHEET_REST_INDEX);
  // The peek sits above the home indicator.
  expect(snapPoints).toEqual([80, 400, 920]);
  expect(screen.getByText("content")).toBeOnTheScreen();
});

it("lifts the map's centre and controls by the part the resting sheet covers", async () => {
  await renderLayout();

  expect(lastMapProps()).toMatchObject({
    currentCoords: [2.35, 48.86],
    bottomInset: 400,
    centerBottomPadding: 400,
  });
});

it("follows the sheet folded down to the peek and back", async () => {
  await renderLayout();

  await animateTo(SHEET_PEEK_INDEX);
  expect(lastMapProps()).toMatchObject({ bottomInset: 80, centerBottomPadding: 80 });

  await animateTo(SHEET_REST_INDEX);
  expect(lastMapProps()).toMatchObject({ bottomInset: 400, centerBottomPadding: 400 });
});

it("does not chase a fully raised sheet", async () => {
  await renderLayout();

  await animateTo(2);
  expect(lastMapProps()).toMatchObject({ bottomInset: 400, centerBottomPadding: 400 });
});

describe("fitContent", () => {
  it("raises the sheet only as high as its content (plus the handle)", async () => {
    await renderLayout(true);
    await sizeContent(500);

    expect(lastSnapPoints()).toEqual([80, 400, 524]);
  });

  it("rests short content at its own height, with nothing above it", async () => {
    await renderLayout(true);
    await sizeContent(200);

    expect(lastSnapPoints()).toEqual([80, 224]);
    expect(lastMapProps()).toMatchObject({ bottomInset: 224, centerBottomPadding: 224 });
  });

  it("still stops at the top point for long content", async () => {
    await renderLayout(true);
    await sizeContent(5000);

    expect(lastSnapPoints()).toEqual([80, 400, 920]);
  });

  it("is off for a form, whatever its content", async () => {
    await renderLayout();
    await sizeContent(200);

    expect(lastSnapPoints()).toEqual([80, 400, 920]);
  });
});
