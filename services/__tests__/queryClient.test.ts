import { queryClient } from "../queryClient";
import { AppError } from "../../types";

const retry = queryClient.getDefaultOptions().queries?.retry as (
  failureCount: number,
  error: Error,
) => boolean;

const appError = (overrides: Partial<AppError> = {}): AppError =>
  ({ name: "Error", message: "boom", code: "UNKNOWN", ...overrides }) as AppError;

it("never retries an UNAUTHORIZED error", () => {
  expect(retry(0, appError({ code: "UNAUTHORIZED" }))).toBe(false);
});

it("never retries a server error", () => {
  expect(retry(0, appError({ isServerError: true }))).toBe(false);
});

it("retries once for any other error", () => {
  expect(retry(0, appError())).toBe(true);
});

it("stops retrying after the first attempt", () => {
  expect(retry(1, appError())).toBe(false);
});
