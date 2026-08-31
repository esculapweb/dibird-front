import { BottomSheet, MenuItem } from "../../services/bottomSheet";
import { IconButtonConfig } from "../../types";

export interface OverflowItem extends MenuItem {
  // Left out of the menu entirely when false — the row is not shown disabled.
  // Defaults to true, so most call sites can skip it.
  condition?: boolean;
  // The row opens another bottom sheet of its own (a confirmation, the list of
  // report reasons). Then this one must NOT be dismissed on the way out:
  // `present` swaps the payload of the single global sheet in place, while a
  // dismiss() racing it can leave nothing on screen at all — see the long
  // comment on dismiss() in UniversalBottomSheet.
  opensAnotherSheet?: boolean;
}

interface OverflowOptions {
  title?: string;
  testID?: string;
}

/**
 * The "⋯" header button and the menu behind it.
 *
 * One helper rather than a copy per screen, because three things about it have
 * to stay the same everywhere or the header starts to feel arbitrary: the icon,
 * the position (always last — pass it in `headerRightEnd`), and the fact that a
 * row closes the sheet before doing anything. That last one is not decoration:
 * a menu row does not dismiss the sheet by itself, so an action that navigates
 * or shares would otherwise leave the menu hanging over the result.
 *
 * What belongs here: everything that is not an everyday tool of the screen —
 * sharing, reporting, blocking, deleting, comparing. What stays an icon:
 * editing, saving, sorting, filtering. The icons keep no labels, so anything
 * whose pictogram needs explaining belongs in the menu, where it has one.
 */
export const overflowButton = (
  items: (OverflowItem | false | null | undefined)[],
  options: OverflowOptions = {},
): IconButtonConfig => {
  const visible = items.filter(
    (item): item is OverflowItem => !!item && item.condition !== false,
  );

  return {
    condition: visible.length > 0,
    icon: "ellipsis-horizontal",
    testID: options.testID ?? "overflow-button",
    onPress: () =>
      BottomSheet.showMenu({
        title: options.title,
        items: visible.map(
          ({ opensAnotherSheet, condition: _condition, onPress, ...item }) => ({
            ...item,
            onPress: () => {
              if (!opensAnotherSheet) BottomSheet.hide();
              onPress();
            },
          }),
        ),
      }),
  };
};
