import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chunks = [
    {
      id: "chunk-1",
      text: "MockChunk: This is a sample code chunk for testing.",
      filePath: "/src/index.js",
      relativePath: "src/index.js",
      extension: ".js",
      language: "javascript",
      startLine: 1,
      endLine: 3,
      tokenLength: 12,
      source: "local",
      sourceType: "files"
    }
  ];

  return NextResponse.json({
    projectId: id,
    chunks
  });
}
