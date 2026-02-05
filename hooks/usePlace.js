import { useQuery } from "@tanstack/react-query";
import api from "../services/api";

export const usePlace = (id) =>
  useQuery({
    queryKey: ["place", id],
    queryFn: async () => {
      const res = await api.get(`/myapi/place2/${id}/`);
      return res.data;
    },
  });
