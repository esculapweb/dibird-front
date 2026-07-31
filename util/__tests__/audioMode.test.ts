const mockSetAudioModeAsync = jest.fn();
jest.mock("expo-audio", () => ({
  setAudioModeAsync: (mode: unknown) => mockSetAudioModeAsync(mode),
}));

// Модуль держит флаг «уже настроено» на верхнем уровне — сбрасываем реестр,
// чтобы каждый кейс начинался с ненастроенной сессии.
const freshEnsureAudioMode = () => {
  jest.resetModules();
  return require("../audioMode").ensureAudioMode as () => void;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSetAudioModeAsync.mockResolvedValue(undefined);
});

it("разрешает звук в беззвучном режиме и не претендует на фон", () => {
  freshEnsureAudioMode()();

  expect(mockSetAudioModeAsync).toHaveBeenCalledWith({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: "doNotMix",
  });
});

it("настраивает сессию один раз, а не на каждое воспроизведение", () => {
  const ensureAudioMode = freshEnsureAudioMode();

  ensureAudioMode();
  ensureAudioMode();
  ensureAudioMode();

  expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(1);
});

it("пробует снова, если настроить сессию не удалось", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  mockSetAudioModeAsync.mockRejectedValueOnce(new Error("session busy"));
  const ensureAudioMode = freshEnsureAudioMode();

  ensureAudioMode();
  // Отказ приходит промисом — до его обработки флаг ещё стоит.
  await Promise.resolve();
  ensureAudioMode();

  expect(mockSetAudioModeAsync).toHaveBeenCalledTimes(2);
  warn.mockRestore();
});
