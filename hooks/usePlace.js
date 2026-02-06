import { useQueryWithTranslation } from "./useQueryWithTranslation";
import api from "../services/api";

export const usePlace = (id) =>
  useQueryWithTranslation({
    queryKey: ["place", id],
    queryFn: async () => {
      const res = await api.get(`/myapi/place2/${id}/`);
      return res.data;
    },
    enabled: !!id,
  });
