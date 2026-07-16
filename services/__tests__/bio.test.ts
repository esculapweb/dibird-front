jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "bare" },
  ExecutionEnvironment: { Bare: "bare", Standalone: "standalone", StoreClient: "storeClient" },
}));
jest.mock("expo-secure-store", () => ({
  canUseBiometricAuthentication: jest.fn(),
  getItemAsync: jest.fn(),
}));

import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { canUseBiometrics, shouldUseBiometrics } from "../bio";

const canUseBiometricAuthentication = SecureStore.canUseBiometricAuthentication as jest.Mock;
const getItemAsync = SecureStore.getItemAsync as jest.Mock;
const mutableConstants = Constants as { executionEnvironment: string };

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mutableConstants.executionEnvironment = ExecutionEnvironment.Bare;
});

afterEach(() => {
  Platform.OS = originalOS;
});

describe("canUseBiometrics", () => {
  it("returns false on iOS inside the App Store review sandbox, without touching SecureStore", async () => {
    Platform.OS = "ios";
    mutableConstants.executionEnvironment = ExecutionEnvironment.StoreClient;

    const result = await canUseBiometrics();

    expect(result).toBe(false);
    expect(canUseBiometricAuthentication).not.toHaveBeenCalled();
  });

  it("delegates to SecureStore on iOS outside the App Store review sandbox (dev-client)", async () => {
    Platform.OS = "ios";
    mutableConstants.executionEnvironment = ExecutionEnvironment.Bare;
    canUseBiometricAuthentication.mockResolvedValueOnce(true);

    const result = await canUseBiometrics();

    expect(result).toBe(true);
    expect(canUseBiometricAuthentication).toHaveBeenCalled();
  });

  it("delegates to SecureStore on Android regardless of executionEnvironment", async () => {
    Platform.OS = "android";
    mutableConstants.executionEnvironment = ExecutionEnvironment.StoreClient;
    canUseBiometricAuthentication.mockResolvedValueOnce(false);

    const result = await canUseBiometrics();

    expect(result).toBe(false);
    expect(canUseBiometricAuthentication).toHaveBeenCalled();
  });
});

describe("shouldUseBiometrics", () => {
  it("returns false without reading the stored flag when hardware is unavailable", async () => {
    Platform.OS = "android";
    canUseBiometricAuthentication.mockResolvedValueOnce(false);

    const result = await shouldUseBiometrics();

    expect(result).toBe(false);
    expect(getItemAsync).not.toHaveBeenCalled();
  });

  it("returns false when hardware is ok but the stored flag isn't \"true\"", async () => {
    Platform.OS = "android";
    canUseBiometricAuthentication.mockResolvedValueOnce(true);
    getItemAsync.mockResolvedValueOnce(null);

    const result = await shouldUseBiometrics();

    expect(result).toBe(false);
    expect(getItemAsync).toHaveBeenCalledWith("biometric_enabled");
  });

  it("returns true when hardware is ok and the stored flag is \"true\"", async () => {
    Platform.OS = "android";
    canUseBiometricAuthentication.mockResolvedValueOnce(true);
    getItemAsync.mockResolvedValueOnce("true");

    const result = await shouldUseBiometrics();

    expect(result).toBe(true);
  });
});
