import { useTranslatedQuery } from "../useQueryWithTranslation";
import api from "../../services/api";

export const usePlace = (id) => useTranslatedQuery({
    queryFn: async (placeId) => {
      const res = await api.get(`/myapi/place2/${placeId}/`);
      return res.data;
    },
    params: [id],
    type: "place",
    enabled: !!id,
  });

