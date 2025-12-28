/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { Card, Button, Input, Badge } from "../../../components/ui/primitives";
import {
  Key,
  ShieldAlert,
  Copy,
  Check,
  Plus,
  Trash2,
  Mail,
} from "lucide-react";
import { useAnalytics } from "../../../store/analytics.store";

type StoredToken = {
  token: string;
  createdAt: string;
  meta?: any;
};

export default function SettingsClient({ session }: any) {
  const [tokens, setTokens] = useState<StoredToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("codrel_tokens");
    if (saved) {
      try {
        setTokens(JSON.parse(saved));
      } catch {
        setTokens([]);
      }
    }
  }, []);

  function saveLocal(updated: StoredToken[]) {
    localStorage.setItem("codrel_tokens", JSON.stringify(updated));
    setTokens(updated);
  }

  async function generate() {
    if (!newKeyName.trim()) return;
    setLoading(true);

    const res = await fetch("/api/auth/generateToken?keyName=" + newKeyName);
    const data = await res.json();

    setLoading(false);
    if (!data.token) return;

    const newToken: StoredToken = {
      token: data.token,
      createdAt: new Date().toISOString(),
      meta: { name: newKeyName },
    };

    const updated = [...tokens, newToken];
    saveLocal(updated);

    setGeneratedKey(data.token);
    setNewKeyName("");
    useAnalytics.setState((state) => ({
      data: {
        ...state.data,
        tokens: state.data.tokens + 1,
        stats: {
          ...state.data.stats,
          tokenCreated: state.data.stats.tokenCreated + 1,
        },
      },
    }));
  }

  async function revoke(token: string) {
    const result = await fetch(`/api/auth/generateToken?token=${token}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (result.status !== 200) return;
    const updated = tokens.filter((t) => t.token !== token);
    useAnalytics.setState((state) => ({
      data: {
        ...state.data,
        tokens: state.data.tokens - 1,
        stats: {
          ...state.data.stats,
          tokenDeleted: state.data.stats.tokenDeleted + 1,
        },
      },
    }));
    saveLocal(updated);
  }

  function copyToken(t: string) {
    navigator.clipboard.writeText(t);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1200);
  }
  return (
    <div
      style={{
        overflow: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="max-w-4xl h-screen  overflow-y-auto py-10 overscroll-auto mx-auto space-y-6 animate-in fade-in duration-500"
    >
      <Card className="p-6 border-neutral-800 bg-[#1c1c1c]">
        <div className="flex items-center gap-5">
          <div className="h-16 overflow-hidden w-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
            <img
              src={session.user.image}
              alt="User Image"
              className="text-xl font-bold text-white"
            />
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-medium text-white">
                {session.user.name || "User"}
              </h3>
              <Badge
                variant="default"
                className="bg-blue-900/30 text-blue-400 border-blue-900/50"
              >
                Member
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs text-neutral-400">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> {session.user.email}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-neutral-800 bg-[#1c1c1c]">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-900/40">
            <Key className="h-5 w-5 text-blue-400" />
          </div>

          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-medium text-white">
              Create New API Token
            </h3>
            <p className="text-xs text-neutral-400">
              These keys authenticate requests to your Codrel API.
            </p>

            {!generatedKey ? (
              <div className="flex gap-3 mt-4 max-w-lg">
                <Input
                  placeholder="Key name (e.g. CI/CD)"
                  value={newKeyName}
                  className="border-white/10"
                  onChange={(e) => setNewKeyName(e.target.value)}
                />

                <Button disabled={!newKeyName || loading} onClick={generate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Generate
                </Button>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-green-900/10 border border-green-900/30 rounded-md space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-green-400 text-sm font-medium">
                    Token Generated
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setGeneratedKey(null)}
                  >
                    Close
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-black border border-green-700/40 p-2 rounded text-xs">
                    {generatedKey}
                  </code>

                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => copyToken(generatedKey)}
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm text-neutral-400 px-1">Active Keys</h3>

        {tokens.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 bg-[#1a1a1a] rounded-lg border border-neutral-800/50">
            No active API keys.
          </div>
        ) : (
          tokens.map((t, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 bg-[#161616] border border-neutral-800 rounded-xl hover:border-neutral-700 transition"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                  <Key className="h-5 w-5 text-neutral-400" />
                </div>

                <div className="space-y-0.5">
                  <span className="text-white text-sm font-medium">
                    {t.meta?.name || "Untitled"}
                  </span>

                  <div className="text-[10px] text-neutral-600">
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => navigator.clipboard.writeText(t.token)}
                  className="text-neutral-300 hover:text-white"
                >
                  <Copy className="h-4 w-4 mr-1" />
                </Button>

                <Button
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => revoke(t.token)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
