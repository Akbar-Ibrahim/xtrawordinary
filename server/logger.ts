export type LogLevel = "info" | "warn" | "error";

export function log(message: string, source = "express", level: LogLevel = "info") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const levelTag = level === "error" ? " [ERROR]" : level === "warn" ? " [WARN]" : "";
  console.log(`${formattedTime} [${source}]${levelTag} ${message}`);
}
