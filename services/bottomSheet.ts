import { createRef } from "react";
import { ConfirmBottomSheetRef } from "../components/ui/ConfirmBottomSheet";

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

export const bottomSheetRef =
  createRef<ConfirmBottomSheetRef>();

export const BottomSheet = {
  show: (payload: ConfirmSheetPayload) => {
    bottomSheetRef.current?.present(payload);
  },

  hide: () => {
    bottomSheetRef.current?.dismiss();
  },
};
