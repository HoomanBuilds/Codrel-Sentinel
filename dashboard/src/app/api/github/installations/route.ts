import { NextResponse } from "next/server";
import { github } from "@/lib/github";

export async function GET() {
  try {
    const installations = await github.listInstallations();
    return NextResponse.json({ installations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}