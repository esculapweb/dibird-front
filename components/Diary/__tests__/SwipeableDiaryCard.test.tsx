jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockT }),
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
jest.mock("../../../hooks/useConfirmDelete", () => ({
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock("../../../hooks/Diary/useOfflineDiary", () => ({
  useDeleteDiary: () => ({ mutate: mockDelete }),
}));
jest.mock("../../../util/share", () => ({
  shareDiary: (...args: unknown[]) => mockShareDiary(...args),
}));
jest.mock("../DiaryCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: { item: { id: number } }) => {
      mockCardProps(props);
      return <Text>{`diary-card-${props.item.id}`}</Text>;
    },
  };
});
type MockAction = { testID: string; onPress: () => void };
// SwipeableRow is tested on its own; here only which actions it is given.
jest.mock("../../ui/SwipeableRow", () => {
  const { Pressable, View } = require("react-native");
  const renderActions = (actions: MockAction[] = []) =>
    actions.map((a) => <Pressable key={a.testID} testID={a.testID} onPress={a.onPress} />);
  return {
    __esModule: true,
    swipeA11yProps: jest.requireActual("../../ui/SwipeableRow").swipeA11yProps,
    default: ({
      leftActions,
      rightActions,
      children,
    }: {
      leftActions?: MockAction[];
      rightActions?: MockAction[];
      children: React.ReactNode;
    }) => (
      <View>
        {renderActions(leftActions)}
        {children}
        {renderActions(rightActions)}
      </View>
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import SwipeableDiaryCard from "../SwipeableDiaryCard";
import { DiaryListItem } from "../../../types";

const mockT = (key: string) => key;
const mockNavigation = createNavigationMock();
const mockConfirmDelete = jest.fn();
const mockDelete = jest.fn();
const mockShareDiary = jest.fn();
const mockCardProps = jest.fn();

const DIARY = { id: 7 } as DiaryListItem;

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the card between the swipe actions", async () => {
  await render(<SwipeableDiaryCard item={DIARY} index={0} />);
  expect(screen.getByText("diary-card-7")).toBeOnTheScreen();
});

// A swipe is out of reach for VoiceOver/TalkBack users — the same actions
// reach them as the card's custom accessibility actions.
it("offers every swipe action to screen readers on the card", async () => {
  await render(<SwipeableDiaryCard item={DIARY} index={0} />);

  const { accessibility } = mockCardProps.mock.calls.at(-1)[0];
  expect(accessibility.accessibilityActions.map((a: { label: string }) => a.label)).toEqual([
    "share",
    "edit",
    "delete",
  ]);
});

it("shares the row's diary", async () => {
  await render(<SwipeableDiaryCard item={DIARY} index={0} />);

  await fireEvent.press(screen.getByTestId("diary-swipe-share-7"));
  expect(mockShareDiary).toHaveBeenCalledWith(DIARY, mockT);
});

it("opens the editor with the row's diary", async () => {
  await render(<SwipeableDiaryCard item={DIARY} index={0} />);

  await fireEvent.press(screen.getByTestId("diary-swipe-edit-7"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryEditor", { diary: DIARY });
});

it("asks before deleting, and deletes this diary on confirm", async () => {
  await render(<SwipeableDiaryCard item={DIARY} index={0} />);

  await fireEvent.press(screen.getByTestId("diary-swipe-delete-7"));
  expect(mockDelete).not.toHaveBeenCalled();

  const { message, runDelete, tag } = mockConfirmDelete.mock.calls[0][0];
  expect(message).toBe("delete_diary_message");
  expect(tag).toBe("SwipeableDiaryCard:deleteDiary:7");

  const callbacks = { onSuccess: jest.fn(), onError: jest.fn() };
  runDelete(callbacks);
  expect(mockDelete).toHaveBeenCalledWith(7, callbacks);
});
