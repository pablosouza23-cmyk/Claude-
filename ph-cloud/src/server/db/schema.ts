import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    avatar: text("avatar").notNull().default("pulse"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`)],
);

/** Sessões no servidor. Guardamos só o SHA-256 do token; o token em si fica no cookie. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferredInput: text("preferred_input", { enum: ["auto", "touch", "keyboard", "gamepad"] })
    .notNull()
    .default("auto"),
  input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: updatedAt(),
});

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

export const playHistory = pgTable(
  "play_history",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }).notNull().defaultNow(),
    playCount: integer("play_count").notNull().default(1),
    totalSeconds: integer("total_seconds").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] }), index("play_history_recent_idx").on(t.userId, t.lastPlayedAt)],
);

/** Métricas de uso (sem IP e sem dados pessoais além do usuário logado, quando houver). */
export const playSessions = pgTable(
  "play_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    gameId: text("game_id").notNull(),
    // game = jogo no player do PH Cloud; cloud = estação própria; external = levado a um serviço oficial.
    kind: text("kind", { enum: ["game", "cloud", "external"] }).notNull().default("game"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastBeatAt: timestamp("last_beat_at", { withTimezone: true }).notNull().defaultNow(),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    inputMethod: text("input_method"),
    deviceClass: text("device_class"),
  },
  (t) => [index("play_sessions_game_idx").on(t.gameId, t.startedAt), index("play_sessions_user_idx").on(t.userId, t.kind, t.startedAt)],
);

/** Salvamento na nuvem (benefício do plano). Uma chave por jogo. */
export const gameSaves = pgTable(
  "game_saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

/** Jogos de provedores externos cadastrados pelo administrador (com permissão registrada). */
export const catalogEntries = pgTable("catalog_entries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  provider: text("provider").notNull(),
  launchType: text("launch_type").notNull(),
  launchUrl: text("launch_url").notNull(),
  /** Links oficiais por serviço de cloud gaming (jogos do tipo official_streaming). */
  streams: jsonb("streams").$type<{ service: string; url: string; access: string; note?: string }[]>().notNull().default([]),
  coverUrl: text("cover_url"),
  developer: text("developer"),
  genres: jsonb("genres").$type<string[]>().notNull().default([]),
  inputs: jsonb("inputs").$type<string[]>().notNull().default([]),
  devices: jsonb("devices").$type<string[]>().notNull().default([]),
  orientation: text("orientation").notNull().default("any"),
  ageRating: text("age_rating"),
  limitations: text("limitations"),
  permissionNote: text("permission_note").notNull(),
  permissionConfirmedBy: uuid("permission_confirmed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Ajustes do administrador sobre qualquer jogo (originais ou externos). */
export const gameOverrides = pgTable("game_overrides", {
  gameId: text("game_id").primaryKey(),
  enabled: boolean("enabled"),
  featured: boolean("featured"),
  access: text("access", { enum: ["free", "premium"] }),
  updatedAt: updatedAt(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("stripe"),
    providerCustomerId: text("provider_customer_id").notNull(),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    planId: text("plan_id").notNull(),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("subscriptions_provider_sub_unique").on(t.providerSubscriptionId), index("subscriptions_user_idx").on(t.userId)],
);

/** Cliente de cobrança por usuário (ex.: cus_... do Stripe). */
export const billingCustomers = pgTable("billing_customers", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("stripe"),
  providerCustomerId: text("provider_customer_id").notNull().unique(),
  createdAt: createdAt(),
});

/** Idempotência dos webhooks: cada evento é processado uma única vez. */
export const billingEvents = pgTable("billing_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** null = aviso para todos. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const notificationReads = pgTable(
  "notification_reads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.notificationId] })],
);

export type User = typeof users.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type CatalogEntryRow = typeof catalogEntries.$inferSelect;
export type GameOverrideRow = typeof gameOverrides.$inferSelect;
