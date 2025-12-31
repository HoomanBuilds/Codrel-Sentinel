"use client";

import { useSession } from "next-auth/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Line,
  LineChart,
} from "recharts";
import {
  User,
  Building2,
  Plus,
  GitPullRequest,
  GitMerge,
  AlertTriangle,
  FileDiff,
  Bot,
  Star,
  Eye,
  GitBranch,
  Terminal,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Card, Badge, cn } from "@/components/ui/primitives";
import { Activity, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const README = `
# Sentinel Core

Sentinel listens to GitHub webhooks and analyzes:

- Pull request lifecycle
- Code churn & blast radius
- Repo analysis latency
- Risk signals via bot reviews

Every analysis run is correlated with repo size and PR activity.
`;

export default function RepoAnalyticsPage() {
  const params = useParams<{ owner: string; repo: string }>();
  const { data: session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [showEvent, setShowEvent] = useState(10);

  const [repoMeta, setRepoMeta] = useState<any>({
    name: params.repo,
    description: "Loading...",
    stars: 0,
    watchers: 0,
    forks: 0,
    visibility: "...",
    language: "...",
    readme: "Loading README...",
  });

  useEffect(() => {
    if (!params.owner || !params.repo) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/repos/${params.owner}/${params.repo}/stats`
        );

        if (!res.ok) throw new Error("Failed to fetch stats");

        const data = await res.json();

        if (data.graphData) setGraphData(data.graphData);
        if (data.events) setEvents(data.events);

        if (data.meta) {
          setRepoMeta(data.meta);
        }
      } catch (err) {
        console.error("Error fetching repo analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.owner, params.repo]);

  const handlePause = async () => {
    try {
      await fetch("/api/repos/pause", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: `${params.owner}/${params.repo}` }),
      });
      router.push("/dashboard");
    } catch {
      // Handle error
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-neutral-200 font-mono flex">
      <aside className="w-72 border-r border-neutral-800 p-5 space-y-6">
        <div>
          <div className="text-xl font-bold text-white">Codrel</div>
          <div className="text-[10px] text-neutral-500">
            Codrel Sentinel analysis
          </div>
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
            Current Repository
          </div>

          <Card className="p-3 rounded-b-none bg-[#161616] border-neutral-800 space">
            <div className="text-sm text-white truncate">{params.repo}</div>
            <div className="text-[10px] text-neutral-500 truncate">
              {params.owner} / {params.repo}
            </div>

            <div className="flex gap-2 mt-2">
              <Badge className="text-[9px]">PRIVATE</Badge>
              <Badge className="text-[9px]">typescript</Badge>
            </div>
          </Card>
          <button
            className=" w-full px-2 py-1 text-xs border rounded-t-none border-neutral-700 rounded bg-red-600 hover:bg-neutral-800"
            onClick={handlePause}
          >
            Disconnect
          </button>
        </div>

        <div>
          <div className="text-[10px] uppercase text-neutral-500 mb-2">
            Repositories
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto">
            {["mockREPO", "n8n-tunnel"].map((repo) => (
              <div
                key={repo}
                className={cn(
                  "px-2 py-1 rounded cursor-pointer text-xs border",
                  repo === "sentinel-core"
                    ? "bg-neutral-800 border-neutral-700 text-white"
                    : "border-transparent text-neutral-500 hover:bg-neutral-900"
                )}
              >
                {repo}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-800 space-y-2">
          <button
            className="w-full text-left px-2 py-1 text-xs border border-neutral-700 rounded hover:bg-neutral-800"
            onClick={() => router.push("/dashboard")}
          >
            ← Back to Repositories
          </button>

          <button className="w-full text-left px-2 py-1 text-xs border border-neutral-700 rounded hover:bg-neutral-800">
            Org Overview →
          </button>
        </div>
      </aside>

      <main className="h-screen flex-1 p-8 overflow-y-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-lg text-white">Repo Analysis</div>
            <div className="text-xs text-neutral-500">
              sentinel intelligence • per-repo
            </div>
          </div>
          <Badge className="text-[10px]">ACTIVE</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI
            icon={GitPullRequest}
            label="Rejected PRs"
            value={
              events.filter((e: any) => e.eventType === "rejected_pr").length
            }
          />

          <KPI
            icon={Zap}
            label="Workflow Crashes"
            value={
              events.filter((e: any) => e.eventType === "workflow_crash").length
            }
          />

          <KPI
            icon={AlertTriangle}
            label="Critical Alerts"
            value={
              events.filter(
                (e: any) =>
                  e.severityLabel === "critical" || e.severityLabel === "high"
              ).length
            }
          />

          <KPI icon={Activity} label="Total Signals" value={events.length} />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="p-4 bg-[#1c1c1c] border-neutral-800">
            <Section title="PR Risks (Reverted & Rejected)">
              <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={graphData}>
                    <CartesianGrid stroke="#222" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#666", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#666", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111",
                        border: "1px solid #333",
                      }}
                      itemStyle={{ fontSize: "11px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="reverted"
                      stackId="1"
                      stroke="#ffb74d"
                      fill="#ffb74d"
                      fillOpacity={0.2}
                      name="Reverted"
                    />
                    <Area
                      type="monotone"
                      dataKey="rejected"
                      stackId="1"
                      stroke="#ef5350"
                      fill="#ef5350"
                      fillOpacity={0.2}
                      name="Rejected"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </Card>

          <Card className="p-4 bg-[#1c1c1c] border-neutral-800">
            <Section title="Workflow Crashes">
              <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graphData}>
                    <CartesianGrid stroke="#222" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#666", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#666", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111",
                        border: "1px solid #333",
                      }}
                      cursor={{ fill: "#ffffff10" }}
                    />
                    <Bar
                      dataKey="crashes"
                      fill="#ff6b6b"
                      radius={[4, 4, 0, 0]}
                      name="Crashes"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </Card>

          <Card className="p-4 bg-[#1c1c1c] border-neutral-800">
            <Section title="Architecture Changes">
              <div className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphData}>
                    <CartesianGrid stroke="#222" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#666", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#666", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#0a0a0a] border border-neutral-800 p-3 rounded shadow-xl min-w-[200px]">
                              <div className="text-[10px] font-bold text-neutral-300 mb-2 border-b border-neutral-800 pb-1">
                                {label}
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-[#29b6f6]" />
                                <span className="text-xs text-neutral-200">
                                  {data.architecture} Changes
                                </span>
                              </div>

                              {data.archFiles && data.archFiles.length > 0 && (
                                <div className="space-y-1 mt-2">
                                  <div className="text-[9px] text-neutral-500 uppercase">
                                    Files Modified:
                                  </div>
                                  {data.archFiles.map(
                                    (file: string, idx: number) => (
                                      <div
                                        key={idx}
                                        className="text-[10px] text-neutral-400 font-mono break-all leading-tight"
                                      >
                                        • {file}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="architecture"
                      stroke="#29b6f6"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "#29b6f6", strokeWidth: 0 }}
                      activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                      name="Arch Changes"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </Card>

          <Card className="p-4 bg-[#1c1c1c] border-neutral-800">
            <Section title="Sentinel Bot Activity">
              <div className="h-full w-full">
                {graphData.reduce(
                  (acc, curr) => acc + (curr.botActivity || 0),
                  0
                ) === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-3">
                    <div className="p-3 bg-neutral-900 rounded-full border border-neutral-800">
                      <Bot size={20} className="text-neutral-500 opacity-50" />
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold">
                        No Activity Detected
                      </div>
                      <div className="text-[9px] text-neutral-600 mt-1 max-w-[150px] mx-auto leading-tight">
                        Sentinel Bot has not triggered on any PRs in the last 7
                        days.
                      </div>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graphData}>
                      <CartesianGrid stroke="#222" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#666", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#666", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111",
                          border: "1px solid #333",
                        }}
                        cursor={{ fill: "#ffffff10" }}
                      />
                      <Bar
                        dataKey="botActivity"
                        fill="#4caf50"
                        radius={[4, 4, 0, 0]}
                        name="Bot Responses"
                        barSize={30}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Section>
          </Card>
        </div>
        <Card className="p-5 bg-[#1c1c1c] border-neutral-800 space-y-4">
          <div className="flex justify-between items-start">
            <div className="max-w-[80%]">
              <div className="text-sm text-white font-bold">
                {repoMeta.name}
              </div>
              <div className="text-xs text-neutral-500 line-clamp-2 mt-1">
                {repoMeta.description}
              </div>
            </div>
            <Badge className="text-[10px] uppercase border-neutral-700 text-neutral-400">
              {repoMeta.visibility}
            </Badge>
          </div>

          <div className="flex gap-6 text-[10px] text-neutral-400 border-b border-neutral-800 pb-4">
            <Meta icon={Star} label="Stars" value={repoMeta.stars} />
            <Meta icon={Eye} label="Watchers" value={repoMeta.watchers} />
            <Meta icon={GitBranch} label="Forks" value={repoMeta.forks} />
            <Meta icon={Bot} label="Lang" value={repoMeta.language} />
          </div>

          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[10px] uppercase text-neutral-500 font-bold tracking-wider">
                README.md
              </div>
            </div>
            <div className="bg-[#111] rounded p-3 border border-neutral-800 max-h-64 overflow-y-auto custom-scrollbar">
              <pre className="text-[10px] text-neutral-400 whitespace-pre-wrap font-mono leading-relaxed">
                {repoMeta.readme}
              </pre>
            </div>
          </div>
        </Card>

        <Card className="bg-[#1c1c1c] border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-800 flex justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-neutral-500" />
              <h3 className="text-sm text-neutral-300 uppercase">
                System Events
              </h3>
            </div>
            <Badge className="text-[10px]">Live</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase text-neutral-500 border-b border-neutral-800 text-left">
                  <th className="p-3 pl-4">Timestamp</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">File</th>
                  <th className="p-3">Severity</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-neutral-800/50">
                {events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-8 text-center text-neutral-600"
                    >
                      No events found
                    </td>
                  </tr>
                ) : (
                  events.slice(0, showEvent).map((e: any, i: number) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 pl-4 text-neutral-500 font-mono">
                        {new Date(e.createdAt).toLocaleTimeString([], {
                          hour12: false,
                        })}
                      </td>

                      <td className="p-3">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border",
                            e.eventType === "workflow_crash"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : e.eventType === "architecture"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : e.eventType === "rejected_pr"
                              ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                              : e.eventType === "sentinel_response"
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : "bg-neutral-800 text-neutral-400 border-neutral-700"
                          )}
                        >
                          {e.eventType?.replace("_", " ")}
                        </span>
                      </td>

                      <td
                        className="p-3 text-neutral-400 font-mono text-[11px] truncate max-w-[200px]"
                        title={e.filePath}
                      >
                        {e.filePath}
                      </td>

                      <td className="p-3">
                        {e.severityLabel === "critical" ||
                        e.severityLabel === "high" ? (
                          <span className="flex items-center gap-1 text-red-500 font-bold text-[10px] uppercase">
                            <AlertCircle size={12} /> {e.severityLabel}
                          </span>
                        ) : e.severityLabel === "medium" ? (
                          <span className="flex items-center gap-1 text-yellow-500 text-[10px] uppercase">
                            <AlertTriangle size={12} /> {e.severityLabel}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-500 text-[10px] uppercase">
                            <CheckCircle2 size={12} /> {e.severityLabel || "OK"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-neutral-800 text-center">
            <button
              onClick={() => setShowEvent((p) => p + 10)}
              className="text-[10px] text-neutral-500 hover:text-white"
            >
              Load more events…
            </button>
          </div>
        </Card>
      </main>
    </div>
  );
}

const Section = ({ title, children }: any) => (
  <>
    <div className="text-[10px] uppercase text-neutral-500 mb-2">{title}</div>
    <div className="h-56">{children}</div>
  </>
);

const KPI = ({ icon: Icon, label, value }: any) => (
  <Card className="p-4 bg-[#1c1c1c] border-neutral-800">
    <div className="flex items-center gap-2 text-[10px] text-neutral-500 uppercase">
      <Icon size={12} />
      {label}
    </div>
    <div className="text-2xl text-white font-bold">{value}</div>
  </Card>
);

const Meta = ({ icon: Icon, label, value }: any) => (
  <div className="flex items-center gap-1">
    <Icon size={12} />
    <span>{label}:</span>
    <span className="text-neutral-200">{value}</span>
  </div>
);
