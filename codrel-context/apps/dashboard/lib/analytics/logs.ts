import db from "../db/db";
import { analyticsTable } from "../db/schema";

export async function logEvent(params: {
  event: string;
  userEmail: string;
  projectId?: string | null;
  success?: boolean;
  error?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}) {
  try {
    await db.insert(analyticsTable).values({
      event: params.event,
      userEmail: params.userEmail,
      projectId: params.projectId ?? null,
      success: params.success ?? true,
      error: params.error ?? null,
      metadata: params.metadata ?? {},
    });
  } catch { return null }
}
