import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "../../services/db/client";
import { alertSettingsTable, mutationQueueTable } from "../../services/db/schema";
import { AlertSettings, AlertSettingsPatch } from "../../services/alertSettings";

type MutationRow = typeof mutationQueueTable.$inferSelect;
type AlertSettingsRow = typeof alertSettingsTable.$inferSelect;

export interface AlertSettingsMutationPayload {
  patch: AlertSettingsPatch;
  sync: boolean;
}

// Singleton row id — there's only ever one alert-settings object per device
// (the authenticated user's "me" settings), mirroring notificationReadOverlayTable's
// sentinel-id trick but simpler since there's no "which id" ambiguity here.
const ROW_ID = 1;

export const rowToSettings = (row: AlertSettingsRow): AlertSettings =>
  row.data as AlertSettings;

export const upsertFromServer = (data: AlertSettings) => {
  const row = { id: ROW_ID, data, status: "synced" as const, updatedAt: Date.now() };
  db.insert(alertSettingsTable)
    .values(row)
    .onConflictDoUpdate({ target: alertSettingsTable.id, set: row })
    .run();
};

export const applyLocalPatch = (patch: AlertSettingsPatch, sync: boolean) => {
  db.transaction((tx) => {
    const [existing] = tx.select().from(alertSettingsTable).all();
    const nextData = { ...(existing?.data as AlertSettings), ...patch };

    tx.update(alertSettingsTable)
      .set({ data: nextData, status: "pending", updatedAt: Date.now() })
      .run();

    tx.insert(mutationQueueTable)
      .values({
        entity: "alertSettings",
        payload: { patch, sync } satisfies AlertSettingsMutationPayload,
        createdAt: Date.now(),
      })
      .run();
  });
};

export const getPendingMutations = (): MutationRow[] =>
  db
    .select()
    .from(mutationQueueTable)
    .where(
      and(
        eq(mutationQueueTable.entity, "alertSettings"),
        eq(mutationQueueTable.status, "pending"),
      ),
    )
    .orderBy(asc(mutationQueueTable.createdAt))
    .all();

export const getFailedMutations = (): MutationRow[] =>
  db
    .select()
    .from(mutationQueueTable)
    .where(
      and(
        eq(mutationQueueTable.entity, "alertSettings"),
        eq(mutationQueueTable.status, "error"),
      ),
    )
    .orderBy(asc(mutationQueueTable.createdAt))
    .all();

export const resolveMutation = (id: number) => {
  db.transaction((tx) => {
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, id)).run();
    tx.update(alertSettingsTable).set({ status: "synced" }).run();
  });
};

export const failMutation = (id: number, message: string) => {
  db.transaction((tx) => {
    tx.update(mutationQueueTable)
      .set({
        status: "error",
        lastError: message,
        attempts: sql`${mutationQueueTable.attempts} + 1`,
      })
      .where(eq(mutationQueueTable.id, id))
      .run();

    tx.update(alertSettingsTable).set({ status: "error" }).run();
  });
};

export const retryMutation = (id: number) => {
  db.transaction((tx) => {
    tx.update(mutationQueueTable)
      .set({ status: "pending", lastError: null })
      .where(eq(mutationQueueTable.id, id))
      .run();

    tx.update(alertSettingsTable).set({ status: "pending" }).run();
  });
};

export const discardMutation = (id: number) => {
  db.transaction((tx) => {
    tx.delete(mutationQueueTable).where(eq(mutationQueueTable.id, id)).run();

    const remaining = tx
      .select()
      .from(mutationQueueTable)
      .where(eq(mutationQueueTable.entity, "alertSettings"))
      .all();

    tx.update(alertSettingsTable)
      .set({ status: remaining.length > 0 ? "pending" : "synced" })
      .run();
  });
};

export const clearAlertSettings = () => {
  db.transaction((tx) => {
    tx.delete(alertSettingsTable).run();
    tx.delete(mutationQueueTable)
      .where(eq(mutationQueueTable.entity, "alertSettings"))
      .run();
  });
};
