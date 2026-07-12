import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const profileTable = sqliteTable("profile", {
  user: integer("user").primaryKey(),
  username: text("username").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull(),
  avatar: text("avatar"),
  avatarThumbnail: text("avatar_thumbnail"),
  private: integer("private", { mode: "boolean" }).notNull(),
  privateDiary: integer("private_diary", { mode: "boolean" }).notNull(),
  registrationIp: text("registration_ip"),
  timezone: text("timezone"),
  territory: integer("territory"),
  status: text("status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("synced"),
  updatedAt: integer("updated_at").notNull(),
});

export const mutationQueueTable = sqliteTable("mutation_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entity: text("entity").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: integer("created_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  status: text("status", { enum: ["pending", "error"] })
    .notNull()
    .default("pending"),
});

export const countryTable = sqliteTable("country", {
  value: integer("value").primaryKey(),
  label: text("label").notNull(),
  code: text("code").notNull(),
  favourite: integer("favourite", { mode: "boolean" }).notNull(),
});

export const timezoneTable = sqliteTable("timezone", {
  value: text("value").primaryKey(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const listCacheTable = sqliteTable("list_cache", {
  key: text("key").primaryKey(),
  response: text("response", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const observationTable = sqliteTable("observation", {
  // negative id = local temp id for an unsynced create, positive = real server id
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
  op: text("op", { enum: ["create", "update", "delete"] }),
  status: text("status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("synced"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});

export const diaryTable = sqliteTable("diary", {
  // negative id = local temp id for an unsynced create, positive = real server id
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
  op: text("op", { enum: ["create", "update", "delete"] }),
  status: text("status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("synced"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});

export const placeTable = sqliteTable("place", {
  // negative id = local temp id for an unsynced create, positive = real server id
  id: integer("id").primaryKey(),
  data: text("data", { mode: "json" }).notNull(),
  op: text("op", { enum: ["create", "update", "delete"] }),
  status: text("status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("synced"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});
