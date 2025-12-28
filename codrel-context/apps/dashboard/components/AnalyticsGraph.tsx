/* AnalyticsGraphXY - working version + proper CustomTooltip */

import React, { useMemo, useState } from "react";
import { Card } from "./ui/primitives";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

function formatShortTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const ranges = {
  "1h": 60 * 60 * 1000,
  "7h": 7 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  all: null,
};

export default function AnalyticsGraphXY({ events }: { events: any[] }) {
  const data = useMemo(() => {
    if (!Array.isArray(events)) return [];

    const map = new Map();

    for (const evt of events) {
      const ts = new Date(evt.ts);
      // ts.setSeconds(0, 0); // bucket by minute
      // ts.setMinutes(0, 0, 0); // This is portrait. bucket by hour

      ts.setSeconds(0, 0);
      const m = ts.getMinutes();
      const half = m < 30 ? 0 : 30;
      ts.setMinutes(half, 0, 0);

      const key = ts.getTime();

      const row = map.get(key) || {
        tsMs: key,

        // counts
        ask: 0,
        ingest: 0,
        token_create: 0,
        token_delete: 0,

        // ask success/error split
        ask_success: 0,
        ask_error: 0,

        // latency
        latency_sum: 0,
        latency_count: 0,

        // project events
        project_created: 0,
        project_deleted: 0,
      };
      if (evt.event === "ask") {
        row.ask++;

        if (evt.success) row.ask_success++;
        else row.ask_error++;
      }

      // -------- INGEST --------
      if (evt.event === "ingest") row.ingest++;

      // -------- TOKENS --------
      if (evt.event === "token_create") row.token_create++;
      if (evt.event === "token_delete") row.token_delete++;

      // -------- PROJECTS --------
      if (evt.event === "project_create") row.project_created++;
      if (evt.event === "project_delete") row.project_deleted++;

      if (evt.metadata?.latency_ms != null) {
        row.latency_sum += evt.metadata.latency_ms;
        row.latency_count++;
      }

      map.set(key, row);
    }

    const arr = Array.from(map.values()).sort((a, b) => a.tsMs - b.tsMs);

    const base = arr[0]?.tsMs || 0;
    arr.forEach((r) => {
      r.x = r.tsMs - base;
      r.avgLatency =
        r.latency_count > 0 ? Math.round(r.latency_sum / r.latency_count) : 0;
    });

    return arr;
  }, [events]);

  const [range, setRange] = useState<keyof typeof ranges>("all");

  const now = Date.now();
  const windowMs = ranges[range];

  const firstTs = data[0]?.tsMs ?? now;
  const lastTs = data[data.length - 1]?.tsMs ?? now;

  // RANGE FILTER
  const filtered =
    range === "all" || windowMs == null
      ? data
      : data.filter((d) => d.tsMs >= now - windowMs);

  // X-AXIS DOMAIN
  const minX = range === "all" || windowMs == null ? firstTs : now - windowMs;
  const maxX = range === "all" ? lastTs : now;

  return (
    <>
      <Card className="p-6 bg-[#1c1c1c] border-neutral-800 flex flex-col col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono text-neutral-300 uppercase">
            Activity Overview
          </h3>

          <select
            value={range}
            onChange={(e) => setRange(e.target.value as keyof typeof ranges)}
            className="bg-[#111] text-neutral-300 text-xs border border-neutral-700 rounded px-2 py-1"
          >
            <option value="1h">1 Hour</option>
            <option value="7h">7 Hours</option>
            <option value="24h">24 Hours</option>
            <option value="7d">7 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <AreaChart data={filtered}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />

              <XAxis
                dataKey="tsMs"
                type="number"
                domain={[minX, maxX]}
                tickFormatter={(v) => formatShortTime(v)}
                stroke="#404040"
                fontSize={11}
              />

              <YAxis
                yAxisId="left"
                stroke="#404040"
                fontSize={11}
                allowDecimals={false}
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#555"
                fontSize={11}
                allowDecimals={false}
              />

              <Tooltip content={<CustomTooltip base={0} />} />

              <Area
                yAxisId="left"
                type="monotone"
                dataKey={(row) =>
                  row.ask + row.ingest + row.token_create + row.token_delete
                }
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
                strokeWidth={2}
                dot
              />

              <Area
                yAxisId="right"
                type="step"
                dataKey="ingest"
                stroke="#666"
                fill="#666"
                fillOpacity={0.15}
                strokeWidth={2}
                dot
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      {/* --- NEW INGEST-ONLY GRAPH --- */}
      <Card className="p-6 bg-[#1c1c1c] border-neutral-800 flex flex-col col-span-1">
        <h3 className="text-sm font-mono text-neutral-300 uppercase mb-4">
          Ingest Requests
        </h3>

        <div style={{ width: "100%", height: "100%" }}>
          <ResponsiveContainer>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />

              <XAxis
                dataKey="x"
                type="number"
                tickFormatter={(v) => formatShortTime(data[0].tsMs + v)}
                stroke="#404040"
                fontSize={11}
              />

              <YAxis stroke="#404040" allowDecimals={false} fontSize={11} />

              <Tooltip
                content={<CustomIngestTooltip base={data[0]?.tsMs || 0} />}
              />

              <Area
                type="step"
                dataKey="ingest"
                name="Ingest Count"
                stroke="gray"
                fill="gray"
                fillOpacity={0.2}
                strokeWidth={2}
                dot
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6 bg-[#1c1c1c] border-neutral-800 flex flex-col col-span-2">
        <h3 className="text-sm font-mono text-neutral-300 uppercase mb-4">
          Ask Requests — Success vs Error
        </h3>

        <div style={{ width: "100%", height: 400 }}>
          <ResponsiveContainer>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />

              <XAxis
                dataKey="x"
                type="number"
                tickFormatter={(v) => formatShortTime(data[0].tsMs + v)}
                stroke="#404040"
                fontSize={11}
              />

              <YAxis stroke="#404040" allowDecimals={false} fontSize={11} />

              <Tooltip
                content={
                  <CustomAskSuccessErrorTooltip base={data[0]?.tsMs || 0} />
                }
              />

              {/* Successful asks */}
              <Area
                type="monotone"
                dataKey="ask_success"
                name="Success"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.15}
                strokeWidth={2}
                dot
              />

              {/* Failed asks */}
              <Area
                type="monotone"
                dataKey="ask_error"
                name="Errors"
                stroke="#ef4444"
                fill="transparent"
                fillOpacity={0.15}
                strokeWidth={1}
                dot
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}

function CustomTooltip({ active, payload, base }: any) {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;

  const fullTime = new Date(base + row.x).toLocaleString();

  return (
    <div className="bg-[#191919] border border-neutral-800 p-3 rounded-md text-xs font-mono min-w-[170px]">
      <p className="text-neutral-400 mb-2 border-b border-neutral-800 pb-1">
        {fullTime}
      </p>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-neutral-300">ask:</span>
        <span className="text-white font-bold">{row.ask}</span>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-neutral-300">ingest:</span>
        <span className="text-white font-bold">{row.ingest}</span>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-neutral-300">token_create:</span>
        <span className="text-white font-bold">{row.token_create}</span>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-neutral-300">token_delete:</span>
        <span className="text-white font-bold">{row.token_delete}</span>
      </div>

      <div className="mt-2 pt-2 border-t border-neutral-800">
        <span className="text-neutral-400">avgLatency: </span>
        <span className="text-white">{row.avgLatency} ms</span>
      </div>

      <div className="mt-2 pt-2 border-t border-neutral-800">
        <span className="text-neutral-300">project_create: </span>
        <span className="text-white">{row.project_created}</span>
      </div>

      <div className="">
        <span className="text-neutral-300">project_delete: </span>
        <span className="text-white">{row.project_deleted}</span>
      </div>
    </div>
  );
}
function CustomAskSuccessErrorTooltip({ active, payload, base }: any) {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;
  const time = new Date(base + row.x).toLocaleString();

  return (
    <div className="bg-[#191919] border border-neutral-800 p-3 rounded-md text-xs font-mono min-w-40">
      <p className="text-neutral-400 mb-2 border-b border-neutral-800 pb-1">
        {time}
      </p>

      <div className="flex items-center justify-between mb-1">
        <span className="text-blue-400">success:</span>
        <span className="text-white font-bold">{row.ask_success || 0}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-red-400">errors:</span>
        <span className="text-white font-bold">{row.ask_error || 0}</span>
      </div>
    </div>
  );
}

function CustomIngestTooltip({ active, payload, base }: any) {
  if (!active || !payload?.length) return null;

  const row = payload[0].payload;
  const time = new Date(base + row.x).toLocaleString();

  return (
    <div className="bg-[#191919] border border-neutral-800 p-3 rounded-md text-xs font-mono min-w-40">
      <p className="text-neutral-400 mb-2 border-b border-neutral-800 pb-1">
        {time}
      </p>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-neutral-300">ingest:</span>
        <span className="text-white font-bold">{row.ingest}</span>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-neutral-300">avg latency:</span>
        <span className="text-white">{row.avgLatency} ms</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-neutral-300">total events:</span>
        <span className="text-white">{row.latency_count}</span>
      </div>
    </div>
  );
}
