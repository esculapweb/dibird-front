import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";
import { useInvalidateProfile } from "../useUpdateProfile";

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.spyOn(queryClient, "invalidateQueries");
});

afterEach(() => {
  queryClient.clear();
});

it("invalidates every profile-related query key from INVALIDATION_MAP", async () => {
  const { result } = await renderHook(() => useInvalidateProfile(), { wrapper });

  result.current();

  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["Rating"], exact: false });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["userProfile"], exact: false });
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["RatingCompareHeader"],
    exact: false,
  });
  expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
});
