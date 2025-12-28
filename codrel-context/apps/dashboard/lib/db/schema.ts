import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: varchar({ length: 36 }).primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  image: varchar({ length: 255 }),
  totalProjects: integer().notNull().default(0),
  totalChunks: integer().notNull().default(0),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const tokensTable = pgTable(
  "tokens",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("tokens_email_idx").on(table.email),
    tokenIdx: index("tokens_token_idx").on(table.token),
  })
);

export const clientType = pgEnum("client_type", ["cli", "web"]);
export const projectsTable = pgTable("projects", {
  id: varchar({ length: 255 }).primaryKey(),
  email: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 255 }).default(""),
  client: clientType("client").notNull().default("cli"),
  totalChunks: integer().notNull().default(0),
  totalTokens: integer().notNull().default(0),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().$onUpdate(() => new Date()).defaultNow(),
  type: varchar({ length: 50 }).notNull(),
});

export const analyticsTable = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  event: varchar("event").notNull(),
  userEmail: varchar("user_email").notNull(),
  projectId: varchar("project_id"),
  success: boolean("success").default(true),
  error: varchar("error"),
  metadata: jsonb("metadata").notNull(),
  ts: timestamp("ts").defaultNow(),
});
