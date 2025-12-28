/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Badge,
  Button,
  Input,
  cn,
} from "../../../components/ui/primitives";
import { Database, Search, Trash2, FileText } from "lucide-react";
import { useAnalytics } from "../../../store/analytics.store";
import VectorIndicesSkeleton from "../../../components/ui/SkeletonProjects";

export default function VectorIndices() {
  const [search, setSearch] = useState("");

  const data = useAnalytics((s) => s.data);
  const loading = useAnalytics((s) => s.loading);
  const fetchOnce = useAnalytics((s) => s.fetchOnce);

  useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  const { stats, allProjects } = data;

  const deleteCollection = async (projectId: string) => {
    const confirmed = window.confirm("Are you sure?");
    if (!confirmed) return;

    const res = await fetch(`/api/project/${projectId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    const { allProjects } = useAnalytics.getState().data;
    useAnalytics.getState().setData({
      allProjects: allProjects.filter((p: any) => p.id !== projectId),
    });
  };

  if (loading) {
    return <VectorIndicesSkeleton />;
  }

  return (
    <div
      style={{
        overflow: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="space-y-6 h-screen overflow-y-auto animate-in fade-in duration-500 py-10"
    >
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight font-mono">
          Projects
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 bg-[#1c1c1c] border-neutral-800 flex flex-col justify-center">
          <h3 className="text-xs font-mono text-neutral-500 uppercase mb-4">
            Chunks Created
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-mono flex items-baseline gap-1 font-bold text-white">
              {stats?.totalVectors ?? "NaN"}
              <p className="text-sm font-light text-white/50">/2000 vectors</p>
            </span>
          </div>
        </Card>
        <Card className="p-5 bg-[#1c1c1c] border-neutral-800 flex flex-col justify-center">
          <h3 className="text-xs font-mono text-neutral-500 uppercase mb-4">
            Projects Created
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-mono flex items-baseline gap-1 font-bold text-white">
              {stats?.totalProjects ?? "NaN"}
              <p className="text-sm font-light text-white/50">/5 projects</p>
            </span>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3  top-2.5 h-4 w-4 text-muted" />
          <Input
            placeholder="Search indices..."
            className="pl-9 bg-[#151515] border-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {allProjects?.length > 0 ? (
            allProjects?.map((idx: any) => (
              <Card
                key={idx.id}
                className="p-0 overflow-hidden border-neutral-800 bg-[#1c1c1c] hover:border-neutral-700 transition-colors group"
              >
                <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-neutral-800 rounded border border-neutral-700">
                      <Database className="h-5 w-5 text-neutral-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{idx.name}</h3>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          {idx.totalTokens < 1000
                            ? `${idx.totalTokens} tokens`
                            : `${(idx.totalTokens / 1000).toFixed(1)}k tokens`}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {idx.totalChunks}{" "}
                          vectors
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-neutral-500">
                        projectId : {idx.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-neutral-600 mr-2">
                        Updated:{" "}
                        {idx.updatedAt
                          ? new Date(idx.updatedAt).toLocaleString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "N/A"}
                      </span>
                      <span className="text-[10px] text-neutral-600 mr-2">
                        Created:{" "}
                        {new Date(idx.createdAt).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteCollection(idx.id)}
                      className="h-8 w-8 text-neutral-500 hover:text-red-400 hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center text-neutral-500 py-10">
              No Project found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
