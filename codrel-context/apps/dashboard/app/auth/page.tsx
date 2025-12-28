"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Terminal, Box, FileText } from "lucide-react";

export default function Page() {
  const { data: session, status } = useSession();
  const router = useRouter();
  if (status === "loading") return null;

  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center relative overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[600px] h-[600px] bg-[#333] rounded-full blur-[200px] opacity-20" />
        <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-[#222] rounded-full blur-[180px] opacity-10" />
      </div>

      {/* Main container */}
      <div className="relative w-full max-w-5xl flex flex-col md:flex-row items-center justify-between px-8 gap-16">

        {/* Left: brand */}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-5xl md:text-6xl font-bold font-mono tracking-tight text-white">
            Codrel AI
          </h1>

          <p className="mt-4 text-neutral-400 font-mono text-base leading-relaxed max-w-md">
            Built for developers who need their tools to know  
            <span className="text-white"> everything about their project.</span>
          </p>

          <div className="flex gap-6 mt-10 opacity-70 justify-center md:justify-start">
            <Terminal className="h-7 w-7 text-neutral-600" />
            <Box className="h-7 w-7 text-neutral-600" />
            <FileText className="h-7 w-7 text-neutral-600" />
          </div>

          <p className="mt-6 font-mono text-xs text-neutral-600 uppercase tracking-wider">
            Access environment • Sync context • Enter Codrel
          </p>
        </div>

        {/* Right: login module */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm p-8 rounded-xl bg-[#1a1a1a]/80 border border-neutral-800 backdrop-blur-xl shadow-xl">

            <h2 className="text-xl font-mono font-semibold text-center mb-6 text-white">
              {session ? "Welcome Back" : "Authenticate"}
            </h2>

            {session ? (
              <button
                onClick={() => router.push("/console/analytics")}
                className="w-full px-4 py-3 bg-white text-black font-mono rounded-lg hover:bg-neutral-200 transition"
              >
                Go to Console
              </button>
            ) : (
              <button
                onClick={() =>
                  signIn("github", { callbackUrl: "/console/analytics" })
                }
                className="w-full px-4 py-3 bg-white text-black font-mono rounded-lg hover:bg-neutral-200 transition"
              >
                Login with GitHub
              </button>
            )}

            <p className="text-center text-neutral-500 text-xs font-mono mt-4">
              Secure GitHub authentication
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-5 text-center font-mono text-xs text-neutral-700">
        © {new Date().getFullYear()} Codrel Labs
      </div>
    </div>
  );
}
