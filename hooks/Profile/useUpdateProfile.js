import { useQueryClient } from "@tanstack/react-query";
import { useMutationWithTranslation } from "../useMutationWithTranslation";
import { INVALIDATION_MAP } from "../../util/invalidationMap";

export const useInvalidateProfile = () => {
  const queryClient = useQueryClient();

  return () => {
    const extraKeys = INVALIDATION_MAP["Profile"]?.update ?? [];
    extraKeys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key, exact: false });
    });
  };
};