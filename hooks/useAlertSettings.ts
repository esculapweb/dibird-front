// src/hooks/useAlertSettings.ts
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import {
  getAlertSettings,
  updateAlertSettings,
  replaceAlertSettings,
  AlertSettings,
  AlertSettingsPatch,
} from "../services/alertSettings";

interface UseAlertSettingsReturn {
  settings: AlertSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** PATCH — частичное обновление (рекомендуется для экрана настроек) */
  save: (patch: AlertSettingsPatch) => Promise<boolean>;
  /** PUT — полная замена объекта */
  replace: (data: AlertSettingsPatch) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useAlertSettings(): UseAlertSettingsReturn {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Загрузка ────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await getAlertSettings();
      setSettings(data);
    } catch {
      setError(t("could_not_load_settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ─── Сохранение (PATCH) ───────────────────────────────────────────────────

  const save = useCallback(
    async (patch: AlertSettingsPatch): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const { data } = await updateAlertSettings(patch);
        setSettings(data);
        return true;
      } catch {
        setError(t("could_not_save_settings"));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // ─── Полная замена (PUT) ──────────────────────────────────────────────────

  const replace = useCallback(
    async (payload: AlertSettingsPatch): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const { data } = await replaceAlertSettings(payload);
        setSettings(data);
        return true;
      } catch {
        setError(t("could_not_save_settings"));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // ─── Утилиты ──────────────────────────────────────────────────────────────

  const clearError = useCallback(() => setError(null), []);

  return {
    settings,
    loading,
    saving,
    error,
    save,
    replace,
    refresh,
    clearError,
  };
}
