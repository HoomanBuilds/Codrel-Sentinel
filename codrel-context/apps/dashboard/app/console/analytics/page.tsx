"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo, useEffect } from "react";
import { Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import {
  Card,
  SelectNative,
  Badge,
  cn,
  Progress,
} from "../../../components/ui/primitives";
import {
  FileText,
  Terminal,
  Key,
  Box,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { formatDate, formatNumber } from "./utils";
import AnalyticsDashboardSkeleton from "../../../components/SkeletonAnalytics";
import { useAnalytics } from "../../../store/analytics.store";
import AskLatencyGraph from "../../../components/AnalyticsGraph";
import { createPortal } from "react-dom";

const DataCard = ({ label, value, subValue, icon: Icon }: any) => (
  <Card className="p-5 flex flex-col justify-between h-[120px] bg-[#1c1c1c] border-neutral-800 hover:border-neutral-700 transition-colors group">
    <div className="flex justify-between items-start">
      <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
        {label}
      </span>
      <Icon className="h-4 w-4 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
    </div>
    <div className="space-y-1">
      <div className="text-2xl font-bold font-mono tracking-tighter text-white">
        {value || 0}
      </div>
      {subValue && (
        <div className="text-[10px] text-neutral-500 font-mono">{subValue}</div>
      )}
    </div>
  </Card>
);

export default function AnalyticsDashboard() {
  const { data, loading, fetchOnce } = useAnalytics();
  const [showEvent, setshowEvent] = useState(15);
  useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  const safeData = data || {
    stats: {
      askCount: 0,
      ingestCount: 0,
      projectCreated: 0,
      tokenCreated: 0,
      tokenDeleted: 0,
      totalProjects: 0,
      lastEventAt: null,
    },
    grouped: { ask: [], ingest: [] },
    events: [],
  };

  const { stats, grouped, events } = safeData;

  const totalTokensIngested = useMemo(() => {
    return (
      grouped?.ingest?.reduce(
        (sum: number, evt: any) => sum + (evt.metadata.totalTokens || 0),
        0
      ) || 0
    );
  }, [grouped]);

  const projectLimit = 5;
  const projectsUsed = stats?.totalProjects;
  const totalVectorsEverCreated = stats?.totalVectorsEverCreated || 0;

  const avgQueryLatency = useMemo(() => {
    const asks = grouped?.ask || [];
    if (!asks.length) return 0;
    const total = asks.reduce(
      (sum: number, evt: any) => sum + (evt.metadata.latency_ms || 0),
      0
    );
    return Math.round(total / asks.length);
  }, [grouped]);

  const eventFreq = [
    { name: "ask", value: stats?.askCount },
    { name: "ingest", value: stats?.ingestCount },
    { name: "project_create", value: stats?.projectCreated },
    { name: "token_create", value: stats?.tokenCreated },
    { name: "token_delete", value: stats?.tokenDeleted },
  ].filter((e) => e.value > 0);

  const COLORS = ["#ffd369", "#4caf50", "#ff6b6b", "#29b6f6", "#ba68c8"];

  const [tokenCount, setTokenCount] = useState(0);

  useEffect(() => {
    const count = JSON.parse(localStorage.getItem("codrel_tokens") || "[]").length;
    setTokenCount(count);
  }, []);
  if (loading) {
    return (
      <div>
        <AnalyticsDashboardSkeleton />
      </div>
    );
  }

  return (
    <div
      style={{
        overflow: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="max-h-screen  py-10 space-y-4 overflow-y-auto animate-in fade-in duration-500 pb-10"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight font-mono">
            Analytics_Dashboard
          </h2>
          <p className="text-xs text-neutral-500 font-mono mt-1">
            System: <span className="text-green-500">ONLINE</span> • Last Event:{" "}
            {stats?.lastEventAt ? formatDate(stats?.lastEventAt) : "N/A"}
          </p>
        </div>

        <button
          onClick={() => fetchOnce(true)}
          className="px-2 py-1 text-xs font-mono text-neutral-400 bg-neutral-800 rounded hover:bg-neutral-700 hover:text-white transition-colors border border-neutral-700"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-between h-[120px] bg-[#1c1c1c] border-neutral-800 relative overflow-hidden">
          <div className="flex justify-between items-start z-10">
            <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
              Active Projects
            </span>
            <Box className="h-4 w-4 text-neutral-600" />
          </div>
          <div className="z-10 space-y-2">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono text-white">
                {projectsUsed}
              </span>
              <span className="text-sm font-mono text-neutral-600">
                /{projectLimit}
              </span>
            </div>
            <Progress
              value={(projectsUsed / projectLimit) * 100}
              className="h-1.5 bg-neutral-800"
            />
          </div>
        </Card>

        <DataCard
          label="Total Queries"
          value={formatNumber(stats?.askCount)}
          subValue={`${avgQueryLatency}ms avg latency`}
          icon={Terminal}
        />

        <DataCard
          label="Documents Ingested"
          value={formatNumber(stats?.ingestCount)}
          subValue={`${formatNumber(totalTokensIngested)} tokens processed`}
          icon={FileText}
        />

        <DataCard
          label="API Tokens"
          value={
            tokenCount
          }
          subValue={`${stats?.tokenCreated} created`}
          icon={Key}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* <AnalyticsGraph
          events={events}
          timeRange={timeRange}
          getTimeLabel={getTimeLabel}
        /> */}
        <AskLatencyGraph events={events} />

        <div className="grid grid-rows-2 gap-4">
          <Card className="p-5 bg-[#1c1c1c] border-neutral-800 flex flex-col justify-center">
            <h3 className="text-xs font-mono text-neutral-500 uppercase mb-4">
              Vectors ever Created
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-mono flex items-baseline gap-1 font-bold text-white">
                {totalVectorsEverCreated}
                <p className="text-sm font-light text-white/50">vectors</p>
              </span>
            </div>
          </Card>

          <Card className="p-5 bg-[#1c1c1c] border-neutral-800 relative">
            <h3 className="text-xs font-mono text-neutral-500 uppercase mb-1">
              Events (Half Pie)
            </h3>

            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eventFreq}
                    startAngle={180}
                    endAngle={0}
                    cx="50%"
                    cy="100%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {eventFreq.map((e, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <Card className="bg-[#1c1c1c] border-neutral-800 overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-mono text-neutral-300 uppercase">
              System Events
            </h3>
          </div>
          <Badge className="font-mono text-[10px]">Live</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                <th className="p-3 pl-4 font-normal">Timestamp</th>
                <th className="p-3 font-normal">Event</th>
                <th className="p-3 font-normal">Project</th>
                <th className="p-3 font-normal">OneTag</th>
                <th className="p-3 font-normal">Latency</th>
                <th className="p-3 font-normal">Raw Meta</th>
                <th className="p-3 font-normal">Status</th>
              </tr>
            </thead>

            <tbody className="text-xs font-mono text-neutral-300 divide-y divide-neutral-800/50">
              {events?.slice(0, showEvent).map((evt: any, i: number) => (

                <tr key={i} className="hover:bg-white/2 transition-colors">
                  <td className="p-3 pl-4 text-neutral-500 whitespace-nowrap">
                    {formatDate(evt.ts)}
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                        evt.event === "ask" && evt.success
                          ? "bg-blue-900/20 text-blue-400"
                          : "bg-red-900/20 text-red-400",
                        evt.event === "ingest" &&
                        "bg-purple-900/20 text-purple-400",
                        evt.event === "project_create" &&
                        "bg-green-900/20 text-green-400",
                        evt.event === "project_delete" &&
                        "bg-red-900/20 text-red-400",
                        evt.event === "token_create" &&
                        "bg-orange-900/20 text-orange-400",
                        evt.event === "token_delete" &&
                        "bg-red-900/20 text-red-400"
                      )}
                    >
                      {evt.event}
                    </span>
                  </td>
                  <td className="p-3 text-neutral-400">
                    {evt.projectId || "-"}
                  </td>
                  <td
                    className="p-3 max-w-[200px] truncate text-neutral-500"
                    title={JSON.stringify(evt.metadata)}
                  >
                    {evt.event === "ask" &&
                      `${evt.metadata?.latency_ms ?? 0}ms`}
                    {evt.event === "ingest" &&
                      `${formatNumber(evt.metadata?.newChunkCount || 0)} chunks`}
                    {evt.event === "project_create" &&
                      `${evt.metadata?.name ? `Name: ${evt.metadata.name}` : ""}`}
                    {evt.event === "token_create" &&
                      `TokenName: ${evt.metadata?.keyName || ""}`}
                    {evt.event === "token_delete" &&
                      `${evt.metadata?.token_deleted ? "Deleted" : "-"}`}
                  </td>
                  <td className="p-3 text-neutral-400">
                    {evt.metadata?.latency_ms ?? "-"} ms
                  </td>
                  <td className="p-3">
                    <MetaHover meta={evt.metadata} />
                  </td>

                  <td className="p-3">
                    {evt.success ? (
                      <div className="flex items-center gap-1.5 text-green-500">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-[10px]">OK</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-[10px]">ERR</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-neutral-800 text-center">
          <button
            onClick={() => setshowEvent((prev) => prev + 15)}
            className="text-[10px] font-mono text-neutral-500 hover:text-white transition-colors"
          >
            {events?.length > showEvent && "Load more events..."}
          </button>
        </div>
      </Card>
    </div>
  );
}

type MetaHoverProps = {
  meta: Record<string, unknown>;
};

type Pos = { x: number; y: number } | null;

const MetaHover: React.FC<MetaHoverProps> = ({ meta }) => {
  const [pos, setPos] = React.useState<Pos>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const entries = Object.entries(meta || {});

  const show = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        x: rect.left,
        y: rect.bottom + 6,
      });
    }
  };

  const hide = () => setPos(null);

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="max-w-[250px] truncate text-neutral-500 cursor-help"
      >
        {JSON.stringify(meta)}
      </div>

      {pos &&
        createPortal(
          <div
            className="
              fixed z-50 
              bg-[#111] border border-neutral-800 rounded-lg 
              p-3 shadow-xl 
              max-w-[320px] w-max
              animate-in fade-in duration-100
            "
            style={{ left: pos.x, top: pos.y }}
          >
            <div className="text-[10px] font-mono text-neutral-400 mb-2 uppercase">
              metadata
            </div>

            <div className="space-y-1">
              {entries.map(([k, v], i) => (
                <div
                  key={i}
                  className="flex justify-between gap-3 text-[11px] font-mono"
                >
                  <span className="text-neutral-500">{k}</span>
                  <span className="text-neutral-300 max-w-[180px] truncate text-right">
                    {String(v).length > 50
                      ? String(v).slice(0, 50) + "…"
                      : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
