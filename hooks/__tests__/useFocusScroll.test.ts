import { renderHook } from "@testing-library/react-native";
import { LayoutChangeEvent } from "react-native";
import { useFocusScroll } from "../useFocusScroll";

const layout = (y: number) =>
  ({ nativeEvent: { layout: { x: 0, y, width: 100, height: 40 } } }) as LayoutChangeEvent;

const withScrollRef = async (focusKey?: string | null) => {
  const scrollTo = jest.fn();
  const { result } = await renderHook(() => useFocusScroll(focusKey));
  (result.current.scrollRef as { current: unknown }).current = { scrollTo };
  return { ...result.current, scrollTo };
};

it("scrolls to the focused section, a little above it", async () => {
  const { onSectionLayout, scrollTo } = await withScrollRef("species");

  onSectionLayout("species")(layout(240));

  expect(scrollTo).toHaveBeenCalledWith({ y: 228, animated: true });
});

it("never scrolls past the top", async () => {
  const { onSectionLayout, scrollTo } = await withScrollRef("territory");

  onSectionLayout("territory")(layout(4));

  expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
});

it("ignores the sections the tap was not about", async () => {
  const { onSectionLayout, scrollTo } = await withScrollRef("species");

  onSectionLayout("territory")(layout(0));
  onSectionLayout("place")(layout(120));

  expect(scrollTo).not.toHaveBeenCalled();
});

it("does nothing when the sheet was opened without a focus", async () => {
  const { onSectionLayout, scrollTo } = await withScrollRef();

  onSectionLayout("species")(layout(240));

  expect(scrollTo).not.toHaveBeenCalled();
});

it("scrolls once, leaving later layout passes to the user's own scrolling", async () => {
  const { onSectionLayout, scrollTo } = await withScrollRef("species");

  onSectionLayout("species")(layout(240));
  onSectionLayout("species")(layout(600));

  expect(scrollTo).toHaveBeenCalledTimes(1);
});
