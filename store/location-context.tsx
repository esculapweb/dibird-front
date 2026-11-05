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
   * Whether to show the system dialog if the permission has not been asked for
   * yet. `false` means "take the coordinates if they are available anyway, and
   * stay quiet": needed by background consumers (App.tsx) for which the
   * coordinates are useful but which are no reason to ask. The dialog should pop
   * up where the user themselves asked for something that needs the location.
   */
  prompt?: boolean;
}

interface LocationContextType {
  locationCoords: Coords | null;
  locationAvailable: boolean;
  permissionStatus: string | null;
  /**
   * The same status, but readable after `await requestLocation()`.
   * `permissionStatus` is the state captured on the current render: a handler
   * checking it right after the request sees the value from before the request,
   * and on the very first refusal the "open the settings" hint was not shown. For
   * rendering keep using `permissionStatus`, this one is only for checks after an
   * await.
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

// expo-location has no timeout of its own: indoors or with a cold GPS a
// High-accuracy getCurrentPositionAsync can stay pending for minutes, and
// PlaceEditor keeps its save button disabled while a fix is pending (#411).
export const LOCATION_FIX_TIMEOUT_MS = 10_000;
// On timeout we settle for the OS's cached fix, but only a recent one: an hour-
// old position from another city is worse than none. Its real accuracy comes
// with it, so PlaceEditor's low-accuracy warning still shows when it is coarse.
export const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

const TIMED_OUT = Symbol("location-timeout");

const withTimeout = <T,>(promise: Promise<T>, ms: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [locationCoords, setLocationCoords] = useState<Coords | null>(null);
  const [permissionStatus, setPermissionStatusState] = useState<string | null>(
    null,
  );
  const [isRequesting, setIsRequesting] = useState(false);
  // The ref and the state are kept as a pair: the state for rendering, the ref for
  // callers that need the status right after an await (see the comment on
  // getPermissionStatus in the context type).
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
        // Only here: this is the only branch where the dialog was actually shown.
        // An event on an already known status would count every launch of the app
        // as a new answer from the user.
        track("location_permission", {
          granted: status === "granted" ? "yes" : "no",
        });
        if (status !== "granted") return null;
      }

      const fix = Location.getCurrentPositionAsync({
        accuracy: desiredAccuracy,
        // Android only, and nothing to do with the runtime permission above:
        // with the default (true) expo-location asks Play Services to resolve
        // the device's location settings, and whenever the network location
        // provider is off that resolution IS a system dialog offering to turn
        // "improved accuracy" on. Declining it changes no setting, so the very
        // next call brings it straight back — and App.tsx's startup fetch calls
        // this on every launch, which is how a fetch documented as silent
        // ("prompt: false") ended up putting a dialog on screen at every start
        // no matter what the user answered last time. Tie it to `prompt`: a
        // caller that is allowed to show a dialog may offer it, a silent one
        // must stay silent and make do with whatever provider is on.
        mayShowUserSettingsDialog: prompt,
      });

      const fresh = await withTimeout(fix, LOCATION_FIX_TIMEOUT_MS);
      let loc: Location.LocationObject | null;
      if (fresh === TIMED_OUT) {
        // The abandoned native request may still reject later; nobody awaits
        // it any more, so keep that from surfacing as an unhandled rejection.
        fix.catch(() => {});
        loc = await Location.getLastKnownPositionAsync({
          maxAge: LAST_KNOWN_MAX_AGE_MS,
        });
      } else {
        loc = fresh;
      }
      if (!loc) return null;

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
