type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  timestamp: number;
}

class Logger {
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: Date.now(),
    };

    const prefix = {
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
      debug: "🔍",
    }[level];

    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    console.log(`${prefix} ${message}${contextStr}`);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log("error", message, context);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log("debug", message, context);
  }
}

export const logger = new Logger();
