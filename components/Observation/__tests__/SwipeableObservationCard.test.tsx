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
jest.mock("../../../hooks/Observation/useOfflineObservation", () => ({
  useDeleteObservation: () => ({ mutate: mockDelete }),
}));
jest.mock("../../../util/share", () => ({
  shareObservation: (...args: unknown[]) => mockShareObservation(...args),
}));
jest.mock("../ObservationCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: { item: { id: number } }) => {
      mockCardProps(props);
      return <Text>{`observation-card-${props.item.id}`}</Text>;
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
import SwipeableObservationCard from "../SwipeableObservationCard";
import { ObservationItem } from "../../../types";

const mockT = (key: string) => key;
const mockNavigation = createNavigationMock();
const mockConfirmDelete = jest.fn();
const mockDelete = jest.fn();
const mockShareObservation = jest.fn();
const mockCardProps = jest.fn();

const OBSERVATION = (overrides: Partial<ObservationItem> = {}) =>
  ({ id: 9, diary: null, territory: null, ...overrides }) as ObservationItem;

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the card between the swipe actions", async () => {
  await render(<SwipeableObservationCard item={OBSERVATION()} index={0} />);
  expect(screen.getByText("observation-card-9")).toBeOnTheScreen();
});

// A swipe is out of reach for VoiceOver/TalkBack users — the same actions
// reach them as the card's custom accessibility actions.
it("offers every swipe action to screen readers on the card", async () => {
  await render(<SwipeableObservationCard item={OBSERVATION()} index={0} />);

  const { accessibility } = mockCardProps.mock.calls.at(-1)[0];
  expect(accessibility.accessibilityActions.map((a: { label: string }) => a.label)).toEqual([
    "share",
    "edit",
    "delete",
  ]);
});

it("shares the row's observation", async () => {
  const observation = OBSERVATION();
  await render(<SwipeableObservationCard item={observation} index={0} />);

  await fireEvent.press(screen.getByTestId("observation-swipe-share-9"));
  expect(mockShareObservation).toHaveBeenCalledWith(observation, mockT);
});

it("opens the editor with the observation alone when it is in no diary", async () => {
  const observation = OBSERVATION();
  await render(<SwipeableObservationCard item={observation} index={0} />);

  await fireEvent.press(screen.getByTestId("observation-swipe-edit-9"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
    observation,
  });
});

// Same params as ObservationDetailScreen's edit button for a diary entry.
it("opens the editor inside the observation's diary", async () => {
  const observation = OBSERVATION({ diary: 3, territory: 12 });
  await render(<SwipeableObservationCard item={observation} index={0} />);

  await fireEvent.press(screen.getByTestId("observation-swipe-edit-9"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
    observation,
    diaryId: 3,
    territoryValue: 12,
  });
});

it("passes no territory for a diary entry without one", async () => {
  const observation = OBSERVATION({ diary: 3, territory: null });
  await render(<SwipeableObservationCard item={observation} index={0} />);

  await fireEvent.press(screen.getByTestId("observation-swipe-edit-9"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
    observation,
    diaryId: 3,
    territoryValue: undefined,
  });
});

it("asks before deleting, and deletes this observation on confirm", async () => {
  await render(<SwipeableObservationCard item={OBSERVATION()} index={0} />);

  await fireEvent.press(screen.getByTestId("observation-swipe-delete-9"));
  expect(mockDelete).not.toHaveBeenCalled();

  const { message, runDelete, tag } = mockConfirmDelete.mock.calls[0][0];
  expect(message).toBe("delete_observation_message");
  expect(tag).toBe("SwipeableObservationCard:deleteObservation:9");

  const callbacks = { onSuccess: jest.fn(), onError: jest.fn() };
  runDelete(callbacks);
  expect(mockDelete).toHaveBeenCalledWith(9, callbacks);
});
