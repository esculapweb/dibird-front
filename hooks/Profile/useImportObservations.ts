import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  startObservationImport,
  pollObservationImportStatus,
} from "../../util/fetches";
import { clearAllListCaches } from "../repositories/listCacheRepository";
import { INVALIDATION_MAP } from "../../util/invalidationMap";
import { track } from "../../services/analytics";
import { ObservationImport, ObservationImportStatus, AppError } from "../../types";

const POLL_INTERVAL_MS = 5000;

/**
 * Импорт выгрузки eBird. Структура — та же, что у
 * [useExportProfile](../Profile/useExportProfile.ts): запрос стартует задачу на
 * бэке и отдаёт 202, дальше опрашиваем `status/` до терминального состояния.
 *
 * Отличие одно, но существенное: по завершении надо не просто показать отчёт, а
 * сбросить локальное зеркало. Записи созданы на сервере в обход очереди синка,
 * и SQLite-кэш списков о них не знает — без сброса лайфлист и статистика
 * остались бы доимпортными до ближайшего истечения кэша.
 */
export const useImportObservations = () => {
  const [state, setState] = useState<ObservationImportStatus>("idle");
  const [result, setResult] = useState<ObservationImport | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refreshAfterImport = useCallback(() => {
    // Сначала диск, потом react-query: инвалидация тут же запускает рефетчи, и
    // те должны записать свежие ответы в уже пустой кэш, а не в тот, который
    // мы вот-вот очистим.
    clearAllListCaches();

    for (const key of INVALIDATION_MAP.Observation.add) {
      // refetchType: "all" по той же причине, что в observationSync: экраны,
      // с которых импорт не запускали, размонтированы, а `useList` не
      // рефетчит на маунте — иначе они так и открылись бы доимпортными.
      queryClient.invalidateQueries({ queryKey: key, refetchType: "all" });
    }
  }, [queryClient]);

  const startPolling = useCallback(() => {
    const check = async () => {
      try {
        const data = await pollObservationImportStatus();
        setState(data.status);
        setResult(data);

        if (data.status === "completed") {
          stopPolling();
          refreshAfterImport();
          track("import_finished", {
            imported: data.imported,
            unmatched: data.unmatched.length,
          });
        } else if (data.status === "failed") {
          stopPolling();
        }
      } catch {
        stopPolling();
        setState("failed");
      }
    };

    check();
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS);
  }, [stopPolling, refreshAfterImport]);

  const startImport = useCallback(
    async (file: { uri: string; name: string }, makePublic: boolean) => {
      try {
        setState("pending");
        setResult(null);
        track("import_started");
        await startObservationImport(file, makePublic);
        startPolling();
      } catch (e) {
        const error = e as AppError;
        // 429 — импорт уже идёт (например, экран переоткрыли после
        // сворачивания). Подключаемся к нему, а не сообщаем об ошибке.
        if (error?.response?.status === 429) {
          startPolling();
        } else {
          setState("failed");
        }
      }
    },
    [startPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    setState("idle");
    setResult(null);
  }, [stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  return { state, result, startImport, reset };
};
