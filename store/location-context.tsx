import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import * as Location from "expo-location";
import { track } from "../services/analytics";
import { Coords } from "../types";

interface LocationOptions {
  /**
   * Показывать ли системный диалог, если разрешения ещё не спрашивали.
   * `false` — «возьми координаты, если они и так доступны, и промолчи»: нужен
   * фоновым потребителям (App.tsx), которым координаты полезны, но которые не
   * являются поводом спросить. Диалог должен всплывать там, где пользователь
   * сам попросил что-то, чему нужна геопозиция.
   */
  prompt?: boolean;
}

interface LocationContextType {
  locationCoords: Coords | null;
  locationAvailable: boolean;
  permissionStatus: string | null;
  /**
   * Тот же статус, но читаемый после `await requestLocation()`.
   * `permissionStatus` — состояние, снятое на текущем рендере: обработчик,
   * проверяющий его следом за запросом, видит значение до запроса, и на
   * первом же отказе подсказка «откройте настройки» не показывалась. Для
   * рендера по-прежнему берите `permissionStatus`, здесь — только для
   * проверок после await.
   */
  getPermissionStatus: () => string | null;
  requestLocation: (
    accuracy?: Location.Accuracy,
    options?: LocationOptions,
  ) => Promise<{
    coords: Coords;
    accuracy: number | null;
  } | null>;
  isRequesting: boolean;
}

const LocationContext = createContext<LocationContextType | null>(null);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [locationCoords, setLocationCoords] = useState<Coords | null>(null);
  const [permissionStatus, setPermissionStatusState] = useState<string | null>(
    null,
  );
  const [isRequesting, setIsRequesting] = useState(false);
  // Ref и состояние держим в паре: состояние — для рендера, ref — для
  // вызывающих, которым статус нужен сразу после await (см. комментарий у
  // getPermissionStatus в типе контекста).
  const permissionStatusRef = useRef<string | null>(null);
  const setPermissionStatus = useCallback((status: string) => {
    permissionStatusRef.current = status;
    setPermissionStatusState(status);
  }, []);
  const getPermissionStatus = useCallback(
    () => permissionStatusRef.current,
    [],
  );
  // Callers throughout the app share one native GPS request at a time (a
  // low-priority background fetch and an explicit high-accuracy "locate me"
  // can easily overlap). Rather than dropping the late caller's request on
  // the floor — which silently left PlaceEditor's accuracy at 0 whenever it
  // raced App.tsx's startup fetch — everyone in flight awaits the same
  // promise and gets that one fix.
  const inFlightRef = useRef<Promise<{ coords: Coords; accuracy: number | null } | null> | null>(null);
  // ...but a silent request must not stand in for a prompting one. Since
  // App.tsx's startup fetch became `prompt: false`, plain sharing would let it
  // answer `null` on behalf of a user who just tapped "locate me" — and the
  // dialog they asked for would never appear.
  const inFlightPromptRef = useRef(false);

  const requestLocationOnce = useCallback(async (
    desiredAccuracy: Location.Accuracy,
    prompt: boolean,
  ) => {
    setIsRequesting(true);

    try {
      const { status: existingStatus } =
        await Location.getForegroundPermissionsAsync();
      setPermissionStatus(existingStatus);

      // Every caller of requestLocation() across the app checks
      // permissionStatus === "denied" first to avoid re-nagging — but that
      // guard is only as good as this function's own respect for it. An
      // already-denied status must not fall through to
      // requestForegroundPermissionsAsync(): on Android that reopens the
      // real OS dialog even though the user (or, in e2e tests, `launchApp:
      // permissions: location: deny`) already answered — "undetermined" is
      // the only status that should ever trigger a fresh prompt.
      if (existingStatus === "denied") {
        return null;
      }

      if (existingStatus !== "granted") {
        if (!prompt) return null;

        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);
        // Только здесь: это единственная ветка, где диалог действительно
        // показали. Событие на уже известном статусе считало бы каждый запуск
        // приложения за новый ответ пользователя.
        track("location_permission", {
          granted: status === "granted" ? "yes" : "no",
        });
        if (status !== "granted") return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: desiredAccuracy,
      });

      const { latitude, longitude, accuracy } = loc.coords;
      // Round raw GPS output (15-17 significant digits) down to ~1m
      // precision — plenty for distance-sort queries, and keeps it out of
      // request URLs/logs at full sensor precision.
      const round5 = (v: number) => Math.round(v * 1e5) / 1e5;
      const coords: Coords = [round5(longitude), round5(latitude)];
      setLocationCoords(coords);

      return { coords, accuracy: accuracy ?? null };
    } catch (e) {
      if (__DEV__) console.warn("Failed to get location:", e);
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [setPermissionStatus]);

  const requestLocation = useCallback(async (
    desiredAccuracy: Location.Accuracy = Location.Accuracy.Balanced,
    { prompt = true }: LocationOptions = {},
  ) => {
    if (inFlightRef.current && (inFlightPromptRef.current || !prompt)) {
      return inFlightRef.current;
    }

    // A prompting caller that arrived behind a silent one waits it out first:
    // two overlapping native requests are exactly what inFlightRef exists to
    // prevent. If the silent one already produced a fix, that fix is the
    // answer and no dialog is needed.
    if (inFlightRef.current) {
      const silent = await inFlightRef.current.catch(() => null);
      if (silent) return silent;
    }

    const promise = requestLocationOnce(desiredAccuracy, prompt);
    inFlightRef.current = promise;
    inFlightPromptRef.current = prompt;
    try {
      return await promise;
    } finally {
      inFlightRef.current = null;
      inFlightPromptRef.current = false;
    }
  }, [requestLocationOnce]);

  return (
    <LocationContext.Provider
      value={{
        locationCoords,
        locationAvailable: !!locationCoords,
        permissionStatus,
        getPermissionStatus,
        requestLocation,
        isRequesting
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within LocationProvider");
  }
  return context;
};
