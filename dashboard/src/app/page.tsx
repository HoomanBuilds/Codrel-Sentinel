'use client';

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Github,
  ShieldAlert,
  GitPullRequest,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/primitives";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  if (status === "loading") return null;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-neutral-200 font-mono flex items-center justify-center">
      <div className="w-full max-w-5xl px-6 py-24 space-y-16">

        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="text-5xl font-bold text-white tracking-tight">
            Codrel Sentinel
          </div>

          <div className="text-sm text-neutral-400 max-w-xl mx-auto leading-snug">
            A repository-aware context engine that gives AI coding agents
            a living memory of what broke before — and why.
          </div>

          <div className="flex justify-center pt-3">
            <button
              onClick={() => signIn("github")}
              className="px-6 py-3 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded flex items-center gap-2 transition-colors"
            >
              <Github size={14} />
              Connect GitHub
            </button>
          </div>
        </section>

        {/* Hackathon Strip (Compressed) */}
     

        {/* Features */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Feature
            icon={<GitPullRequest size={14} />}
            title="Repository Memory"
            text="Durable context from PRs, reverts, CI failures, and issues — built once, kept in sync."
          />

          <Feature
            icon={<ShieldAlert size={14} />}
            title="File-Level Risk Context"
            text="Agents know which files are fragile, what broke before, and why changes are risky."
          />

          <Feature
            icon={<CheckCircle2 size={14} />}
            title="Agent-First Interface"
            text="Context is served directly to IDE agents and PR bots."
          />
        </section>
        

        {/* Bottom CTA */}
        <section className="text-center pt-2">
          <button
            onClick={() => signIn("github")}
            className="px-5 py-2 text-[10px] border border-neutral-700 rounded text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            Give Your Agents Memory →
          </button>
        </section>

           <section className="flex items-center justify-center gap-6 text-[10px] text-neutral-500">
          <span>Hackathon</span>
          <Logo text="Google" primary />
          <Logo text="Confluent" />
          <Logo text="Datadog" />
          <Logo text="ElevenLabs" />
        </section>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Card className="p-4 bg-[#161616] border-neutral-800 space-y-2">
      <div className="flex items-center gap-2 text-xs text-white">
        {icon}
        {title}
      </div>
      <div className="text-[10px] text-neutral-500 leading-snug">
        {text}
      </div>
    </Card>
  );
}

function Logo({
  text,
  primary,
}: {
  text: string;
  primary?: boolean;
}) {
  return (
    <div
      className={[
        "px-2 py-1 border rounded text-[10px]",
        primary
          ? "border-neutral-600 text-neutral-300"
          : "border-neutral-800 text-neutral-500",
      ].join(" ")}
    >
      {text}
    </div>
  );
}
