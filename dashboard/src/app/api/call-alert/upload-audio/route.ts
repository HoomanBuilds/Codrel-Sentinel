import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { eventId, audioBase64 } = await req.json();

  const dir = path.join(process.cwd(), "public/audio");
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${eventId}.mp3`);
  await fs.writeFile(filePath, Buffer.from(audioBase64, "base64"));

  const audioUrl = `https://3000.vinitngr.xyz/audio/${eventId}.mp3`;

  return NextResponse.json({ audioUrl });
}
