import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";

import migrations from "../../drizzle/migrations";
import * as schema from "./schema";

export const sqliteDb = openDatabaseSync("dibird.db", {
  enableChangeListener: true,
});

export const db = drizzle(sqliteDb, { schema });

export const runMigrations = () => migrate(db, migrations);
