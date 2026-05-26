import ConfirmBottomSheet from "../ui/ConfirmBottomSheet";

import { bottomSheetRef } from "../../services/bottomSheet";

const GlobalBottomSheet = () => {
  return <ConfirmBottomSheet ref={bottomSheetRef} />;
};

export default GlobalBottomSheet;
