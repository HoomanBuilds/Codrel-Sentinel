import { NextResponse } from "next/server";
import { ingest } from "./orchestrator";
import { AppError } from "./AppError";

export async function POST(req: Request) {
  try {
    const result = await ingest(req);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
