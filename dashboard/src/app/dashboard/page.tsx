"use client";

import React, { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  GitPullRequest,
  ShieldAlert,
  Plus,
  CheckCircle2,
  Loader2,
  Github,
  Building2,
  User,
} from "lucide-react";
import { Card, Badge, cn } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

type Action = {
  label: string;
  disabled: boolean;
  variant: "idle" | "active" | "error";
};

function repoAction(status: string): Action {
  switch (status) {
    case "PAUSED":
      return { label: "RESUME", disabled: false, variant: "idle" };

    case "QUEUED":
    case "FETCHING":
    case "ANALYZING":
    case "INDEXING":
      return {
        label: status === "INDEXING" ? "PROCESSING" : status,
        disabled: true,
        variant: "active",
      };

    case "READY":
      return { label: "MONITORING", disabled: true, variant: "active" };

    case "FAILED":
      return { label: "RETRY", disabled: false, variant: "error" };

    default:
      return { label: "CONNECT", disabled: false, variant: "idle" };
  }
}

export default function Dashboard() {
  const { data: session, status } = useSession();

  const [installations, setInstallations] = useState<any[]>([]);
  const [selectedInstall, setSelectedInstall] = useState<string | null>(null);
  const [repos, setRepos] = useState<any[]>([]);

  // We only need one loading state now because we fetch everything at once
  const [isLoading, setIsLoading] = useState(true);
  const [connectingIds, setConnectingIds] = useState<Set<number>>(new Set());

  const toast = useToast();

  // --- 1. Load Everything (Installations + Repos) Once ---
  useEffect(() => {
    if (status === "authenticated") {
      setIsLoading(true);
      fetch("/api/github/installations")
        .then((r) => r.json())
        .then((d) => {
          const installs = d.installations || [];
          setInstallations(installs);

          // Automatically select the first installation
          if (installs.length > 0) {
            const firstId = installs[0].id;
            setSelectedInstall(String(firstId));
            // ✅ FIX: Set repos directly from the installation object
            setRepos(installs[0].repositories || []);
          }
        })
        .finally(() => setIsLoading(false));
    } else if (status === "unauthenticated") {
      setIsLoading(false);
    }
  }, [status]);

  const ACTIVE_STATUSES = ["QUEUED", "FETCHING", "ANALYZING", "INDEXING"];

  const shouldPoll = repos.some((repo) =>
    ACTIVE_STATUSES.includes(repo.status)
  );

  useEffect(() => {
    if (!shouldPoll) return;

    console.log("⚡ Polling started (Active jobs detected)...");

    const i = setInterval(async () => {
      try {
        const r = await fetch("/api/repos/status");
        if (!r.ok) return;
        const d = await r.json();

        setRepos((prev) =>
          prev.map((repo) => {
            const row = d.repos?.find(
              (x: any) => x.id === `${repo.owner.login}/${repo.name}`
            );

            if (row && row.status !== repo.status) {
              return { ...repo, status: row.status };
            }
            return repo;
          })
        );
      } catch (e) {
      }
    }, 3000);

    return () => {
      console.log("💤 Polling stopped (No active jobs)");
      clearInterval(i);
    };
  }, [shouldPoll]);

  const loadRepos = (id: number) => {
    setSelectedInstall(String(id));

    const targetInst = installations.find((i) => i.id === id);

    if (targetInst && targetInst.repositories) {
      setRepos(targetInst.repositories);
    } else {
      setRepos([]);
    }
  };

  // --- 4. Connect Action ---
  const connectRepo = async (repo: any) => {
    setConnectingIds((p) => new Set(p).add(repo.id));
    try {
      const r = await fetch("/api/repos/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoId: repo.id,
          repoUrl: repo.html_url,
          installationId: selectedInstall,
          owner: repo.owner.login,
          name: repo.name,
        }),
      });

      const data = await r.json();

      if (!r.ok) {
        toast({
          type: "error",
          message: data?.error || "Failed to connect repository",
        });
        return;
      }

      setRepos((p) =>
        p.map((x) => (x.id === repo.id ? { ...x, status: "QUEUED" } : x))
      );

      toast({
        type: "success",
        message: "Repository queued",
      });
    } catch {
      toast({
        type: "error",
        message: "Network error while connecting repo",
      });
    } finally {
      setConnectingIds((p) => {
        const n = new Set(p);
        n.delete(repo.id);
        return n;
      });
    }
  };

  if (status === "loading" || (status === "authenticated" && isLoading))
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f0f0f]">
        <Loader2 className="animate-spin text-neutral-500" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-neutral-200 font-mono flex">
      <aside className="w-72 border-r border-neutral-800 p-5 space-y-6 flex-shrink-0 hidden md:block">
        <div>
          <div className="text-xl font-bold text-white">Codrel</div>
          <div className="text-[10px] text-neutral-500">SENTINEL_DASHBOARD</div>
        </div>

        {session?.user && (
          <Card className="p-3 bg-[#1c1c1c] border-neutral-800 flex gap-3">
            <img src={session.user.image!} className="w-8 h-8 rounded-md" />
            <div className="truncate">
              <div className="text-xs text-white truncate">
                {session.user.name}
              </div>
              <div className="text-[10px] text-neutral-500 truncate">
                {session.user.email}
              </div>
            </div>
          </Card>
        )}

        <div>
          <div className="text-[10px] uppercase text-neutral-500 mb-2">
            Installation Scope
          </div>

          <div className="space-y-1">
            {installations.map((inst) => (
              <div
                key={inst.id}
                onClick={() => loadRepos(inst.id)}
                className={cn(
                  "flex items-center gap-3 p-2 rounded cursor-pointer border transition-colors",
                  selectedInstall === String(inst.id)
                    ? "bg-neutral-800 border-neutral-700 text-white"
                    : "border-transparent text-neutral-500 hover:bg-neutral-900"
                )}
              >
                <img
                  src={inst.account.avatar_url}
                  className="w-7 h-7 rounded"
                />
                <div className="flex-1 truncate">
                  <div className="text-xs truncate">{inst.account.login}</div>
                  <div className="text-[10px] flex gap-1 items-center">
                    {inst.account.type === "User" ? (
                      <User size={10} />
                    ) : (
                      <Building2 size={10} />
                    )}
                    {inst.account.type}
                  </div>
                </div>
              </div>
            ))}

            <a
              href={`https://github.com/apps/${
                process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "codrel-sentinel"
              }/installations/new`}
              target="_blank"
              className="flex items-center gap-3 p-2 border border-dashed border-neutral-700 rounded text-neutral-500 hover:text-white hover:border-neutral-500 transition-colors"
            >
              <Plus size={14} /> Add Installation
            </a>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 p-8 overflow-y-auto">
        {!session ? (
          <Card className="max-w-md mx-auto mt-40 p-6 bg-[#1c1c1c] border-neutral-800 text-center">
            <ShieldAlert className="mx-auto mb-4 text-neutral-400" />
            <div className="text-sm text-white mb-1">
              Authentication Required
            </div>
            <div className="text-xs text-neutral-500 mb-4">
              Sign in with GitHub to continue
            </div>
            <button
              onClick={() => signIn("github")}
              className="w-full py-2 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded flex items-center justify-center gap-2 transition-colors"
            >
              <Github size={14} /> Sign in
            </button>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <div className="text-lg text-white">Repositories</div>
              <div className="text-xs text-neutral-500">
                Scope:{" "}
                {installations.find((i) => String(i.id) === selectedInstall)
                  ?.account.login || "Select an installation"}
              </div>
            </div>

            {repos.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {repos.map((repo) => (
                  <RepoCard
                    key={repo.id}
                    repo={repo}
                    loading={connectingIds.has(repo.id)}
                    onConnect={() => connectRepo(repo)}
                    onActivity={() => {}}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center bg-[#1c1c1c] border-neutral-800">
                <GitPullRequest className="mx-auto mb-3 text-neutral-500" />
                <div className="text-xs text-neutral-400">
                  No repositories found for this installation.
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// --- Sub Components ---

type RepoCardProps = {
  repo: any;
  onConnect: () => void;
  onActivity: () => void;
  loading: boolean;
};

const RepoCard: React.FC<RepoCardProps> = ({
  repo,
  onConnect,
  onActivity,
  loading,
}) => {
  const action = repoAction(repo.status);

  const handleAction = () => {
    if (
      repo.status === "FAILED" ||
      repo.status === "PAUSED" ||
      !action.disabled
    ) {
      onConnect();
    }
  };
  return (
    <Card className="p-3 bg-[#161616] border-neutral-800 hover:border-neutral-700 transition-colors flex flex-col justify-between h-36">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-mono font-bold text-white truncate">
            {repo.name}
          </div>
          <div className="text-[10px] text-neutral-500 truncate">
            {repo.owner?.login}
          </div>
        </div>

        {repo.private && (
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
        )}
      </div>

      <div className="text-[10px] text-neutral-500 line-clamp-2 leading-snug mt-1">
        {repo.description || "No description"}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3">
        {repo.status === "READY" ? (
          <div className="flex items-center justify-between w-full gap-2">
            <div className="gap-2 flex">
              <Badge className="text-[9px] bg-green-900/20 p-2 text-green-400">
                <CheckCircle2 size={10} className="mr-1" /> MONITORING
              </Badge>
            </div>

            <button
              onClick={onActivity}
              className="px-2 py-1 text-[10px] font-mono border border-neutral-800 rounded text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
            >
              Details →
            </button>
          </div>
        ) : (
          <button
            onClick={handleAction}
            disabled={action.disabled || loading}
            className={cn(
              "px-2 py-1 text-[10px] font-mono border rounded transition-colors",
              loading && "opacity-60",
              action.variant === "idle" &&
                "border-neutral-700 text-neutral-300 hover:bg-neutral-800",
              action.variant === "active" &&
                "border-blue-700 text-blue-400 bg-blue-900/20 cursor-not-allowed",
              action.variant === "error" &&
                "border-red-700 text-red-400 hover:bg-red-900/20"
            )}
          >
            {loading ? "CONNECTING" : action.label}
          </button>
        )}
      </div>
    </Card>
  );
};
