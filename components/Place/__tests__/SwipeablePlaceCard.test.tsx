jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("../../../hooks/useConfirmDelete", () => ({
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock("../../../hooks/Place/useOfflinePlace", () => ({
  useUpdatePlace: () => ({ mutate: mockUpdate }),
  useDeletePlace: () => ({ mutate: mockDelete }),
}));
jest.mock("../PlaceCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: { item: { id: number } }) => {
      mockCardProps(props);
      return <Text>{`place-card-${props.item.id}`}</Text>;
    },
  };
});
type MockAction = { label: string; icon: string; testID: string; onPress: () => void };
// SwipeableRow is tested on its own; here only which actions it is given.
jest.mock("../../ui/SwipeableRow", () => {
  const { Pressable, Text, View } = require("react-native");
  const renderActions = (actions: MockAction[] = []) =>
    actions.map((a) => (
      <Pressable key={a.testID} testID={a.testID} onPress={a.onPress}>
        <Text>{`${a.label}:${a.icon}`}</Text>
      </Pressable>
    ));
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
import SwipeablePlaceCard from "../SwipeablePlaceCard";
import { PlaceItem } from "../../../types";

const mockNavigation = createNavigationMock();
const mockShowErrorToast = jest.fn();
const mockConfirmDelete = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockCardProps = jest.fn();

const PLACE = (overrides: Partial<PlaceItem> = {}) =>
  ({ id: 4, name: "Park", favourite: false, want_to_visit: false, ...overrides }) as PlaceItem;

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the card between the swipe actions", async () => {
  await render(<SwipeablePlaceCard item={PLACE()} index={0} />);
  expect(screen.getByText("place-card-4")).toBeOnTheScreen();
});

// A swipe is out of reach for VoiceOver/TalkBack users — the same actions
// reach them as the card's custom accessibility actions.
it("offers every swipe action to screen readers on the card", async () => {
  await render(<SwipeablePlaceCard item={PLACE()} index={0} />);

  const { accessibility } = mockCardProps.mock.calls.at(-1)[0];
  expect(accessibility.accessibilityActions.map((a: { label: string }) => a.label)).toEqual([
    "add_to_favourites",
    "add_to_want_to_visit",
    "edit",
    "delete",
  ]);

  accessibility.onAccessibilityAction({
    nativeEvent: { actionName: "swipe:place-swipe-delete-4" },
  });
  expect(mockConfirmDelete).toHaveBeenCalledTimes(1);
});

it("toggles favourite with the detail screen's payload, state shown in the icon", async () => {
  await render(<SwipeablePlaceCard item={PLACE({ favourite: true })} index={0} />);
  expect(screen.getByText("remove_from_favourites:star")).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("place-swipe-favourite-4"));
  expect(mockUpdate).toHaveBeenCalledWith({ favourite: false }, expect.any(Object));
});

it("adds to want-to-visit without touching the reminder", async () => {
  await render(<SwipeablePlaceCard item={PLACE()} index={0} />);
  expect(screen.getByText("add_to_want_to_visit:flag-outline")).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("place-swipe-want-to-visit-4"));
  expect(mockUpdate).toHaveBeenCalledWith({ want_to_visit: true }, expect.any(Object));
});

// Same rule as PlaceDetailScreen: a reminder for a place the user no longer
// plans to visit would only be noise.
it("clears the reminder when leaving want-to-visit", async () => {
  await render(<SwipeablePlaceCard item={PLACE({ want_to_visit: true })} index={0} />);

  await fireEvent.press(screen.getByTestId("place-swipe-want-to-visit-4"));
  expect(mockUpdate).toHaveBeenCalledWith(
    { want_to_visit: false, visit_reminder_at: null },
    expect.any(Object),
  );
});

// useUpdatePlace's wrapper toasts everything but a validation error itself.
it("reports only a validation error from a failed toggle", async () => {
  await render(<SwipeablePlaceCard item={PLACE()} index={0} />);
  await fireEvent.press(screen.getByTestId("place-swipe-favourite-4"));
  const { onError } = mockUpdate.mock.calls[0][1];

  onError(new Error("boom"));
  expect(mockShowErrorToast).not.toHaveBeenCalled();

  const error = { status: 400, response: { data: { favourite: ["bad"] } } };
  onError(error);
  expect(mockShowErrorToast).toHaveBeenCalledWith(
    error,
    "SwipeablePlaceCard:toggleFavourite:4",
  );
});

it("opens the editor with the row's place", async () => {
  const place = PLACE();
  await render(<SwipeablePlaceCard item={place} index={0} />);

  await fireEvent.press(screen.getByTestId("place-swipe-edit-4"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceEditor", { place });
});

it("asks before deleting, and deletes this place on confirm", async () => {
  await render(<SwipeablePlaceCard item={PLACE()} index={0} />);

  await fireEvent.press(screen.getByTestId("place-swipe-delete-4"));
  expect(mockDelete).not.toHaveBeenCalled();

  const { message, runDelete, tag } = mockConfirmDelete.mock.calls[0][0];
  expect(message).toBe("delete_place_message");
  expect(tag).toBe("SwipeablePlaceCard:deletePlace:4");

  const callbacks = { onSuccess: jest.fn(), onError: jest.fn() };
  runDelete(callbacks);
  expect(mockDelete).toHaveBeenCalledWith(4, callbacks);
});
