import Context from "../core/context.js";

type LogValue = string | number | boolean | object | null | undefined;
type LogArgs = LogValue[];

const COLORS = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;

function ts(): string {
  return COLORS.gray + new Date().toISOString() + COLORS.reset;
}

export class Logger {
  private scope: string;
  private ctx?: Context;
  constructor(scope: string, ctx?: Context) {
    this.scope = scope;
    this.ctx = ctx;
  }

  private store(label: string, args: LogArgs) {
    if (!this.ctx) return;
    const line = `${new Date().toISOString()} ${label} [${this.scope}] ${args.join(" ")}`;
    this.ctx.addLog(line);
  }

  private fmt(label: string, color: string, args: LogArgs) {
    this.store(label, args);
    const tag = `${color}${label}${COLORS.reset}`;
    return [ts(), tag, `[${this.scope}]`, ...args];
  }

  info(...args: LogArgs) {
    console.log(...this.fmt("INFO", COLORS.green, args));
  }

  warn(...args: LogArgs) {
    console.warn(...this.fmt("WARN", COLORS.yellow, args));
  }

  error(...args: LogArgs) {
    console.error(...this.fmt("ERROR", COLORS.red, args));
  }

  debug(...args: LogArgs) {
    if (process.env.DEBUG) {
      console.log(...this.fmt("DEBUG", COLORS.cyan, args));
    }
  }

  sucess(...args: LogArgs) {
    console.log(...this.fmt("SUCCESS", COLORS.green, args));
  }
}

export const logger = new Logger("global");
