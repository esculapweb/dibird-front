import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { AppState } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useTranslation } from "react-i18next";

import { db } from "../services/db/client";
import { alertSettingsTable } from "../services/db/schema";
import * as alertSettingsRepository from "../hooks/repositories/alertSettingsRepository";
import * as alertSettingsSync from "../services/sync/alertSettingsSync";
import { subscribeToReconnect } from "../services/sync/networkStatus";
import { showError, logError } from "../services/errors";
import { AlertSettings, AlertSettingsPatch } from "../services/alertSettings";

interface AlertSettingsContextType {
  settings: AlertSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  save: (patch: AlertSettingsPatch, sync?: boolean) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const AlertSettingsContext = createContext<AlertSettingsContextType | null>(null);

// Mirrors store/profile-context.tsx: a single server-owned settings object
// backed by a local mirror row, read reactively via useLiveQuery so every
// consumer (AlertSettingsScreen, RareNearby, App.tsx's Root) shares one
// instance instead of each mounting its own independent fetch.
export const AlertSettingsProvider = ({
  children,
  isAuthenticated,
  isInitializing,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  isInitializing: boolean;
}) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialLoadAttempted, setInitialLoadAttempted] = useState(false);

  const { data: rows } = useLiveQuery(db.select().from(alertSettingsTable).limit(1));
  const row = rows[0] ?? null;
  const settings = row ? alertSettingsRepository.rowToSettings(row) : null;
  const loading = isAuthenticated && !settings && !initialLoadAttempted;

  const lastRefreshRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    lastRefreshRef.current = Date.now();
    try {
      setError(null);
      await alertSettingsSync.runAlertSettingsSync();
    } catch (e) {
      logError(e, "AlertSettings refresh");
      setError(t("could_not_load_settings"));
    } finally {
      setInitialLoadAttempted(true);
    }
  }, [t]);

  const save = useCallback(
    async (patch: AlertSettingsPatch, sync = false): Promise<boolean> => {
      setSaving(true);
      alertSettingsRepository.applyLocalPatch(patch, sync);
      try {
        await alertSettingsSync.runAlertSettingsSync();
        setError(null);
        return true;
      } catch (e) {
        logError(e, "AlertSettings save");
        showError(e);
        setError(t("could_not_save_settings"));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [t],
  );

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (isInitializing) return;

    if (!isAuthenticated) {
      alertSettingsRepository.clearAlertSettings();
      setError(null);
      setInitialLoadAttempted(false);
      return;
    }
    setInitialLoadAttempted(false);
    refresh();
  }, [isAuthenticated, isInitializing]);

  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribeReconnect = subscribeToReconnect(() => {
      alertSettingsSync.runAlertSettingsSync();
    });

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let prevState = AppState.currentState;

    const sub = AppState.addEventListener("change", (state) => {
      const wasBackground =
        prevState === "background" || prevState === "inactive";
      prevState = state;

      if (state === "active" && wasBackground && isAuthenticatedRef.current) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          const secsSinceRefresh = (Date.now() - lastRefreshRef.current) / 1000;
          if (secsSinceRefresh > 10) {
            alertSettingsSync.runAlertSettingsSync();
          }
        }, 500);
      }
    });

    return () => {
      unsubscribeReconnect();
      sub.remove();
      if (timeout) clearTimeout(timeout);
    };
  }, [isAuthenticated]);

  return (
    <AlertSettingsContext.Provider
      value={{ settings, loading, saving, error, save, refresh, clearError }}
    >
      {children}
    </AlertSettingsContext.Provider>
  );
};

export const useAlertSettings = (): AlertSettingsContextType => {
  const context = useContext(AlertSettingsContext);
  if (!context)
    throw new Error("useAlertSettings must be used within AlertSettingsProvider");
  return context;
};
