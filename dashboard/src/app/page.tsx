'use client';
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Github, ShieldCheck } from "lucide-react";

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (session) router.push('/dashboard');
  }, [session, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
      <div className="absolute w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -top-20 -left-20"></div>
      
      <div className="z-10 text-center space-y-8 max-w-lg p-6">
        <div className="flex justify-center">
          <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 backdrop-blur-sm">
             <ShieldCheck size={64} className="text-indigo-400" />
          </div>
        </div>
        
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
          Codrel Sentinel
        </h1>
        <p className="text-slate-400 text-lg">
          The AI-powered immune system for your repositories. Detect crashes, block bad patterns, and enforce architecture.
        </p>

        <button 
          onClick={() => signIn('github')}
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-600 font-lg rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/25 w-full"
        >
          <Github size={24} />
          <span>Continue with GitHub</span>
        </button>
      </div>
    </div>
  );
}