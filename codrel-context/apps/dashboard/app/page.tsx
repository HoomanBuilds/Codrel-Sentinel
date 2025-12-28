"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Terminal, Box, FileText } from "lucide-react";

export default function Landing() {
  const { data: session, status } = useSession();
  const router = useRouter();
  if (status === "loading") return null;

  const TAGS = ["cli", "extension", "dashboard", "mcp", "rag"];

  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#353535] rounded-full blur-[220px] opacity-20" />
      </div>

      <div className="relative text-center max-w-3xl">
        <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-white font-mono">
          Codrel AI
        </h1>

        <p className="mt-4 text-lg md:text-xl text-neutral-400 font-mono tracking-tight">
          Your project’s real knowledge, structured and always available. A
          single RAG pipeline powering every tool you use.
        </p>

        <div className="flex gap-6 justify-center mt-10 opacity-70">
          <Terminal className="h-8 w-8 text-neutral-500" />
          <Box className="h-8 w-8 text-neutral-500" />
          <FileText className="h-8 w-8 text-neutral-500" />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {TAGS.map((t) => (
            <div
              key={t}
              className="cursor-pointer
        group relative px-3 py-[3px] rounded-sm
        bg-[#0e0e0e] border border-neutral-800
        text-[10px] font-mono uppercase tracking-wider
        text-neutral-500
        hover:text-white hover:border-neutral-600
        transition
      "
            >
              <span
                className="
                  absolute left-1/2 -translate-x-1/2 bottom-0
                  w-0 bg-neutral-400
                  group-hover:w-3/4
                  transition-all duration-300 ease-out
                "
              />

              <span
                className="
          absolute inset-0 rounded-sm opacity-0 group-hover:opacity-10
          bg-white blur-sm transition
        "
              />

              <span className="relative z-10">{t}</span>
            </div>
          ))}
        </div>

        <div className="mt-12">
          {session ? (
            <button
              onClick={() => router.push("/console/analytics")}
              className="px-8 py-4 bg-white text-black font-mono text-sm rounded-lg hover:bg-neutral-200 transition border border-neutral-800"
            >
              Go to dashboard
            </button>
          ) : (
            <button
              onClick={() => router.push("/auth")}
              className="px-8 py-4 bg-white text-black font-mono text-sm rounded-lg hover:bg-neutral-200 transition border border-neutral-800"
            >
              Login with GitHub
            </button>
          )}

          <p className="text-neutral-500 text-xs font-mono mt-4">
            Secure GitHub authentication • Zero friction
          </p>
        </div>
      </div>

      <div className="absolute bottom-5 text-center text-neutral-700 font-mono text-xs">
        © {new Date().getFullYear()} Codrel — RAG infrastructure for developers
      </div>
    </div>
  );
}
