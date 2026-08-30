import { createRef } from "react";
import { BottomSheetRef } from "../components/ui/UniversalBottomSheet";
import { IconType } from "../types";

export interface ConfirmSheetPayload {
  title: string;
  description?: string | ((data: unknown) => string);
  confirmText: string;
  cancelText: string;
  danger?: boolean;
  requiredInput?: string | ((data: unknown) => string);
  inputPlaceholder?: string | ((data: unknown) => string);
  inputLabel?: string;
  data?: unknown;
  onConfirm?: (data: unknown) => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export interface ContentSheetPayload {
  title?: string;
  renderContent: (dismiss: () => void) => React.ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}

export interface MenuItem {
  label: string;
  icon?: IconType;
  onPress: () => void;
  danger?: boolean;
  // Menu rows are the only affordance some actions have left (deleting a
  // record, reporting content), and Maestro has nothing else to grab onto:
  // the label is translated, the row has no other identity.
  testID?: string;
}

export interface MenuSheetPayload {
  title?: string;
  items: MenuItem[];
}

export type SheetPayload =
  | ({ mode: "confirm" } & ConfirmSheetPayload)
  | ({ mode: "content" } & ContentSheetPayload)
  | ({ mode: "menu" } & MenuSheetPayload);

export const bottomSheetRef = createRef<BottomSheetRef>();

export const BottomSheet = {
  show: (payload: ConfirmSheetPayload) =>
    bottomSheetRef.current?.present({ mode: "confirm", ...payload }),
  showContent: (payload: ContentSheetPayload) =>
    bottomSheetRef.current?.present({ mode: "content", ...payload }),
  showMenu: (payload: MenuSheetPayload) =>
    bottomSheetRef.current?.present({ mode: "menu", ...payload }),
  hide: () => bottomSheetRef.current?.dismiss(),
};
