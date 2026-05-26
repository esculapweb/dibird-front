import UniversalBottomSheet from "../ui/UniversalBottomSheet";
import { bottomSheetRef } from "../../services/bottomSheet";

const GlobalBottomSheet = () => {
  return <UniversalBottomSheet ref={bottomSheetRef} />;
};

export default GlobalBottomSheet;