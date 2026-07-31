const mockSetAudioModeAsync = jest.fn();
jest.mock("expo-audio", () => ({
  setAudioModeAsync: (mode: unknown) => mockSetAudioModeAsync(mode),
}));

// The module keeps an "already configured" flag at the top level — the registry
// is reset so that every case starts from an unconfigured session.
const freshEnsureAudioMode = () => {
  jest.resetModules();
  return require("../audioMode").ensureAudioMode as () => void;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSetAudioModeAsync.mockResolvedValue(undefined);
});

it("allows sound in silent mode and lays no claim to the background", () => {
  freshEnsureAudioMode()();

  expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: "doNotMix",
  });
});

it("configures the session once, not on every playback", () => {
  const ensureAudioMode = freshEnsureAudioMode();

  ensureAudioMode();
  ensureAudioMode();
  ensureAudioMode();

  expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(1);
});

it("tries again when the session could not be configured", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  mockSetAudioModeAsync.mockRejectedValueOnce(new Error("session busy"));
  const ensureAudioMode = freshEnsureAudioMode();

  ensureAudioMode();
  // The refusal arrives as a promise — until it is handled the flag is still set.
  await Promise.resolve();
  ensureAudioMode();

  expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(2);
  warn.mockRestore();
});
