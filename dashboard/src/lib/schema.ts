import { pgTable, text, timestamp, pgEnum, varchar , integer , jsonb, index, real, serial} from "drizzle-orm/pg-core";

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

export const repoFileEvents = pgTable(
  "repo_file_events",
  {
    id: serial("id").primaryKey(),
    repo: varchar("repo", { length: 255 }).notNull(),
    filePath: text("file_path").notNull(),
    affectedFiles: text("affected_files").array(),
    eventType: varchar("event_type", { length: 64 })
      .$type<
        | "workflow_crash"
        | "reverted_pr"
        | "rejected_pr"
        | "architecture"
      >()
      .notNull(),

    eventSourceId: text("event_source_id"),
    severityScore: real("severity_score").notNull(),
    severityLabel: varchar("severity_label", { length: 16 }).$type<
      "low" | "medium" | "high" | "critical"
    >(),

    riskCategory: text("risk_category"),
    keywords: text("keywords").array(),
    summary: text("summary"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),

    rawPayload: jsonb("raw_payload").notNull(),
  },
  table => ({
    repoFileIdx: index("repo_file_events_repo_file_idx").on(
      table.repo,
      table.filePath
    ),
    repoFileTimeIdx: index("repo_file_events_repo_file_time_idx").on(
      table.repo,
      table.filePath,
      table.createdAt
    ),
  })
);
