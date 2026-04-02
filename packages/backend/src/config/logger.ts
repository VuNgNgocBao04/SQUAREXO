type LogLevel = "info" | "warn" | "error" | "debug";

type LogRecord = {
  ts: string;
  level: LogLevel;
  msg: string;
  context?: Record<string, unknown>;
};

function write(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
  const payload: LogRecord = {
    ts: new Date().toISOString(),
    level,
    msg,
    context,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(msg: string, context?: Record<string, unknown>) {
    write("info", msg, context);
  },
  warn(msg: string, context?: Record<string, unknown>) {
    write("warn", msg, context);
  },
  error(msg: string, context?: Record<string, unknown>) {
    write("error", msg, context);
  },
  debug(msg: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      write("debug", msg, context);
    }
  },
};
