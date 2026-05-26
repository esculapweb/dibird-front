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
}

export interface MenuItem {
  label: string;
  icon?: IconType;
  onPress: () => void;
  danger?: boolean;
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
