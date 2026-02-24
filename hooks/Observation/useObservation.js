import { useTranslatedQuery } from "../useQueryWithTranslation";
import api from "../../services/api";

export const useObservation = (id) => useTranslatedQuery({
    queryFn: async (observationId) => {
      const res = await api.get(`/myapi/observation2/${observationId}/`);
      return res.data;
    },
    params: [id],
    type: "observation",
    enabled: !!id,
  });

