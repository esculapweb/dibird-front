import { act, render, renderHook, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { SheetFooterProvider, useSheetFooter, useSheetFooterHost } from "../SheetFooter";

describe("useSheetFooterHost", () => {
  it("measures the registered footer and forgets the height when it is removed", async () => {
    const { result } = await renderHook(() => useSheetFooterHost());

    await act(async () => result.current.setFooter(<Text>Apply</Text>));
    await render(<>{result.current.renderMeasured()}</>);
    const wrapper = screen.getByTestId("sheet-footer");
    await act(async () => {
      wrapper.props.onLayout({ nativeEvent: { layout: { height: 79.4 } } });
    });
    expect(result.current.footerHeight).toBe(80);

    // The next sheet must not reserve this footer's room.
    await act(async () => result.current.setFooter(null));
    expect(result.current.footer).toBeNull();
    expect(result.current.footerHeight).toBe(0);
  });
});

describe("useSheetFooter", () => {
  it("registers once on mount and unregisters on unmount", async () => {
    const setFooter = jest.fn();
    const node = <Text>Apply</Text>;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SheetFooterProvider value={{ setFooter, footerHeight: 50 }}>{children}</SheetFooterProvider>
    );

    const { result, rerender, unmount } = await renderHook(() => useSheetFooter(node), { wrapper });
    await rerender({});

    expect(setFooter).toHaveBeenCalledTimes(1);
    expect(setFooter).toHaveBeenCalledWith(node);
    expect(result.current).toEqual({ inline: false, footerHeight: 50 });

    await unmount();
    expect(setFooter).toHaveBeenLastCalledWith(null);
  });

  it("asks to be rendered inline outside a sheet", async () => {
    const { result } = await renderHook(() => useSheetFooter(<Text>Apply</Text>));
    expect(result.current).toEqual({ inline: true, footerHeight: 0 });
  });
});
