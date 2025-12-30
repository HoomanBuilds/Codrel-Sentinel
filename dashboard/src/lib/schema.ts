import { pgTable, text, timestamp, pgEnum, varchar , integer} from "drizzle-orm/pg-core";

export const repoStatusEnum = pgEnum("repo_status", [
  "PAUSED",
  "QUEUED",
  "FETCHING",
  "ANALYZING",
  "INDEXING",
  "READY",
  "FAILED",
]);

export const repositories = pgTable("repositories", {
  id: text("id").primaryKey(), 
  name: text("name").notNull(),
  owner: text("owner").notNull(),
  fullName: text("full_name").notNull(),
  installationId: text("installation_id").notNull(),

  status: repoStatusEnum("status")
    .notNull()
    .default("QUEUED"),

  error: text("error"),
  connectedBy: text("connected_by").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


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