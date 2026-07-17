// react-native's own module lazily defines each export via a getter
// (Object.defineProperty), so spreading `{ ...jest.requireActual("react-native") }`
// eagerly evaluates every one of them (crashing on native-only bits like
// DevMenu) and `jest.spyOn` on the namespace is a no-op here — this hook's
// `import { useWindowDimensions } from "react-native"` already resolved to
// the original function by the time a test body could spy on it. A Proxy
// forwards property access lazily instead, same as the real module does,
// letting us override just this one export.
let mockWidth = 750;
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  return new Proxy(actual, {
    get(target, prop, receiver) {
      if (prop === "useWindowDimensions") {
        return () => ({ width: mockWidth, height: 1334, scale: 2, fontScale: 2 });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
});

import { renderHook } from "@testing-library/react-native";
import { useContentWidth } from "../useContentWidth";

it("returns the raw width on narrow (phone) screens", async () => {
  mockWidth = 375;
  const { result } = await renderHook(() => useContentWidth());
  expect(result.current).toBe(375);
});

it("returns the raw width right up to the 768 breakpoint", async () => {
  mockWidth = 767;
  const { result } = await renderHook(() => useContentWidth());
  expect(result.current).toBe(767);
});

it("clamps to a minimum of 600 on a wide screen where 75% would be smaller", async () => {
  mockWidth = 768;
  const { result } = await renderHook(() => useContentWidth());
  expect(result.current).toBe(600);
});

it("uses 75% of width when that falls within [600, 1100]", async () => {
  mockWidth = 1000;
  const { result } = await renderHook(() => useContentWidth());
  expect(result.current).toBe(750);
});

it("clamps to a maximum of 1100 on very wide screens", async () => {
  mockWidth = 2000;
  const { result } = await renderHook(() => useContentWidth());
  expect(result.current).toBe(1100);
});
