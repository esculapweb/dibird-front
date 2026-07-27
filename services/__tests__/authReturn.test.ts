jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";

import { setAuthReturn, takeAuthReturn } from "../authReturn";

const STORAGE_KEY = "auth_return";
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
  // Модульная переменная переживает импорт между тестами — гасим её, чтобы
  // тесты диска проверяли именно диск.
  await takeAuthReturn();
});

describe("setAuthReturn", () => {
  it("keeps a catalogue screen and hands it back once", async () => {
    await setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    expect(await takeAuthReturn()).toEqual({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
    });
    // Забрали — значит забыли: второй вход не должен никуда телепортировать.
    expect(await takeAuthReturn()).toBeNull();
  });

  // В AppStack таких экранов нет, восстанавливать нечего.
  it("drops a screen that is not part of the catalogue", async () => {
    await setAuthReturn({ name: "ObservationEditor" });

    expect(await takeAuthReturn()).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clears a previously stored intent when called with null", async () => {
    await setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });
    await setAuthReturn(null);

    expect(await takeAuthReturn()).toBeNull();
  });
});

// Регистрация по почте уводит из приложения (CheckEmail → почтовый клиент →
// деп-линк confirm-email), и процесс к моменту возврата уже убит: без диска
// возврат не работал именно на самом длинном пути.
describe("surviving a process restart", () => {
  // Перезапуск = в памяти пусто, на диске что-то есть. `beforeEach` уже
  // осушил модульную переменную, поэтому достаточно засеять хранилище напрямую
  // — так тест и проверяет именно дисковый путь, а не тот же кэш в памяти.
  const seed = (stored: Record<string, unknown>) =>
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

  it("writes the intent to disk, timestamped", async () => {
    const before = Date.now();
    await setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw as string)).toEqual({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
      savedAt: expect.any(Number),
    });
    expect(JSON.parse(raw as string).savedAt).toBeGreaterThanOrEqual(before);
  });

  it("restores an intent that only exists on disk", async () => {
    await seed({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
      savedAt: Date.now(),
    });

    expect(await takeAuthReturn()).toEqual({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
    });
  });

  it("forgets an intent older than a day", async () => {
    await seed({
      name: "SpeciesDetail",
      params: { segment: "osprey" },
      savedAt: Date.now() - DAY - 1000,
    });

    expect(await takeAuthReturn()).toBeNull();
  });

  it("honours an intent that is just inside the window", async () => {
    await seed({ name: "SpeciesDetail", savedAt: Date.now() - DAY + 60_000 });

    expect(await takeAuthReturn()).toEqual({
      name: "SpeciesDetail",
      params: undefined,
    });
  });

  it("erases the stored intent even when it was too old to use", async () => {
    await seed({ name: "SpeciesDetail", savedAt: 0 });

    await takeAuthReturn();

    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores a stored screen that is no longer part of the catalogue", async () => {
    await seed({ name: "SomeRemovedScreen", savedAt: Date.now() });

    expect(await takeAuthReturn()).toBeNull();
  });

  it("survives a corrupted payload instead of throwing into the login flow", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "{not json");

    expect(await takeAuthReturn()).toBeNull();
  });
});

// Тёплый путь (Apple/Google прямо в шторке) обслуживается модульной
// переменной: приложение не покидается, и ждать диска там незачем.
describe("when the disk is unavailable", () => {
  it("still returns the intent from memory", async () => {
    jest
      .spyOn(AsyncStorage, "setItem")
      .mockRejectedValueOnce(new Error("disk full"));

    await setAuthReturn({ name: "TerritoryDetail", params: { segment: "fr" } });

    expect(await takeAuthReturn()).toEqual({
      name: "TerritoryDetail",
      params: { segment: "fr" },
    });
  });
});
