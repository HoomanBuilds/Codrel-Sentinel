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
  LineChart,
  Line,
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
} from "lucide-react";
import { Card, Badge, cn } from "@/components/ui/primitives";
import { useState } from "react";

const prTimeline = [
  { t: "Mon", opened: 6, merged: 4, rejected: 2 },
  { t: "Tue", opened: 9, merged: 6, rejected: 1 },
  { t: "Wed", opened: 4, merged: 3, rejected: 1 },
  { t: "Thu", opened: 11, merged: 7, rejected: 3 },
  { t: "Fri", opened: 8, merged: 6, rejected: 2 },
];

const analysisRuns = [
  {
    run: 1,
    latency: 180,
    files: 12,
    prs: 1,
    parse: 30,
    analyze: 90,
    index: 60,
  },
  {
    run: 2,
    latency: 420,
    files: 84,
    prs: 3,
    parse: 70,
    analyze: 240,
    index: 110,
  },
  {
    run: 3,
    latency: 260,
    files: 31,
    prs: 2,
    parse: 40,
    analyze: 140,
    index: 80,
  },
  {
    run: 4,
    latency: 610,
    files: 140,
    prs: 6,
    parse: 120,
    analyze: 360,
    index: 130,
  },
];

const fileChurn = [
  { t: "Mon", files: 120 },
  { t: "Tue", files: 240 },
  { t: "Wed", files: 90 },
  { t: "Thu", files: 310 },
  { t: "Fri", files: 200 },
];

const botVerdicts = [
  { name: "Clean", value: 21 },
  { name: "Warnings", value: 9 },
  { name: "Blocked", value: 4 },
];

const BOT_COLORS = ["#4caf50", "#ffd369", "#ff6b6b"];

const repoMeta = {
  name: "sentinel-core",
  description:
    "Sentinel bot analyzes PRs, file churn, and latency to detect risk and regressions.",
  stars: 1243,
  watchers: 87,
  forks: 112,
  visibility: "private",
  language: "TypeScript",
};

const README = `
# Sentinel Core

Sentinel listens to GitHub webhooks and analyzes:

- Pull request lifecycle
- Code churn & blast radius
- Repo analysis latency
- Risk signals via bot reviews

Every analysis run is correlated with repo size and PR activity.
`;
const events = Array.from({ length: 25 }).map((_, i) => ({
  ts: Date.now() - i * 60000,
  event:
    i % 3 === 0
      ? "analysis_completed"
      : i % 3 === 1
      ? "pr_reviewed"
      : "webhook_received",
  projectId: "sentinel-core",
  metadata: {
    latency_ms: 180 + i * 12,
    files: 10 + i,
    verdict: i % 4 === 0 ? "blocked" : "ok",
  },
  success: i % 4 !== 0,
}));

export default function RepoAnalyticsPage() {
  const { data: session } = useSession();
  const [showEvent, setShowEvent] = useState(10);
  const installations: any[] = [];

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
            <div className="text-sm text-white truncate">sentinel-core</div>
            <div className="text-[10px] text-neutral-500 truncate">
              codrel / sentinel-core
            </div>

            <div className="flex gap-2 mt-2">
              <Badge className="text-[9px]">PRIVATE</Badge>
              <Badge className="text-[9px]">TypeScript</Badge>
            </div>
          </Card>
          <button
            className=" w-full px-2 py-1 text-xs border rounded-t-none border-neutral-700 rounded bg-red-600 hover:bg-neutral-800"
            onClick={() => history.back()}
          >
            Disconnect
          </button>
        </div>

        <div>
          <div className="text-[10px] uppercase text-neutral-500 mb-2">
            Repositories
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto">
            {[
              "sentinel-core",
              "sentinel-ui",
              "sentinel-agent",
              "infra-config",
            ].map((repo) => (
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
            onClick={() => history.back()}
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
          <KPI icon={GitPullRequest} label="PRs Opened" value="38" />
          <KPI icon={GitMerge} label="Merged" value="26" />
          <KPI icon={AlertTriangle} label="Rejected" value="9" />
          <KPI icon={FileDiff} label="Files Touched" value="960" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="p-4 bg-[#1c1c1c] border-neutral-800 xl:col-span-2">
            <Section title="PR Lifecycle">
              <AreaChartBlock />
            </Section>
          </Card>

          <Card className="p-4 bg-[#1c1c1c] border-neutral-800">
            <Section title="Sentinel Bot Verdicts">
              <BotPie />
            </Section>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4 bg-[#1c1c1c] border-neutral-800">
            <Section title="Repo Analysis Latency (per run)">
              <LatencyScatter />
            </Section>
          </Card>

          <Card className="p-4 bg-[#1c1c1c] border-neutral-800">
            <Section title="Files Changed (push events)">
              <FileBar />
            </Section>
          </Card>
        </div>

        <Card className="p-5 bg-[#1c1c1c] border-neutral-800 space-y-4">
          <div className="flex justify-between">
            <div>
              <div className="text-sm text-white">{repoMeta.name}</div>
              <div className="text-xs text-neutral-500">
                {repoMeta.description}
              </div>
            </div>
            <Badge className="text-[10px]">{repoMeta.visibility}</Badge>
          </div>

          <div className="flex gap-6 text-[10px] text-neutral-400">
            <Meta icon={Star} label="Stars" value={repoMeta.stars} />
            <Meta icon={Eye} label="Watchers" value={repoMeta.watchers} />
            <Meta icon={GitBranch} label="Forks" value={repoMeta.forks} />
            <Meta icon={Bot} label="Lang" value={repoMeta.language} />
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <div className="text-[10px] uppercase text-neutral-500 mb-2">
              README
            </div>
            <pre className="text-[11px] text-neutral-300 whitespace-pre-wrap">
              {README}
            </pre>
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
                <tr className="text-[10px] uppercase text-neutral-500 border-b border-neutral-800">
                  <th className="p-3 pl-4">Timestamp</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Project</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-neutral-800/50">
                {events.slice(0, showEvent).map((e, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="p-3 pl-4 text-neutral-500">
                      {new Date(e.ts).toLocaleTimeString()}
                    </td>
                    <td className="p-3">{e.event}</td>
                    <td className="p-3 text-neutral-400">{e.projectId}</td>
                    <td className="p-3 text-neutral-400">
                      {e.metadata.latency_ms} ms
                    </td>
                    <td className="p-3">
                      {e.success ? (
                        <span className="flex items-center gap-1 text-green-500">
                          <CheckCircle2 size={12} /> OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertCircle size={12} /> ERR
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
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

const AreaChartBlock = () => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={prTimeline}>
      <CartesianGrid stroke="#222" />
      <XAxis dataKey="t" tick={{ fill: "#666", fontSize: 10 }} />
      <YAxis tick={{ fill: "#666", fontSize: 10 }} />
      <Tooltip />
      <Area dataKey="opened" stackId="1" stroke="#29b6f6" fill="#29b6f6" />
      <Area dataKey="merged" stackId="1" stroke="#4caf50" fill="#4caf50" />
      <Area dataKey="rejected" stackId="1" stroke="#ff6b6b" fill="#ff6b6b" />
    </AreaChart>
  </ResponsiveContainer>
);

const LatencyScatter = () => (
  <ResponsiveContainer width="100%" height="100%">
    <ScatterChart>
      <CartesianGrid stroke="#222" />
      <XAxis dataKey="files" name="Files" />
      <YAxis dataKey="latency" name="Latency" unit="ms" />
      <Tooltip
        cursor={{ strokeDasharray: "3 3" }}
        content={({ payload }) => {
          if (!payload || !payload.length) return null;
          const d = payload[0].payload;
          return (
            <div className="bg-[#111] border border-neutral-700 p-2 text-[10px]">
              <div>Latency: {d.latency}ms</div>
              <div>Files: {d.files}</div>
              <div>PRs: {d.prs}</div>
              <div>Parse: {d.parse}ms</div>
              <div>Analyze: {d.analyze}ms</div>
              <div>Index: {d.index}ms</div>
            </div>
          );
        }}
      />
      <Scatter data={analysisRuns} fill="#ffa726" />
    </ScatterChart>
  </ResponsiveContainer>
);

const FileBar = () => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={fileChurn}>
      <CartesianGrid stroke="#222" />
      <XAxis dataKey="t" tick={{ fill: "#666", fontSize: 10 }} />
      <YAxis tick={{ fill: "#666", fontSize: 10 }} />
      <Tooltip />
      <Bar dataKey="files" fill="#ffd369" />
    </BarChart>
  </ResponsiveContainer>
);

const BotPie = () => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie data={botVerdicts} innerRadius={50} outerRadius={80} dataKey="value">
        {botVerdicts.map((_, i) => (
          <Cell key={i} fill={BOT_COLORS[i]} />
        ))}
      </Pie>
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
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
