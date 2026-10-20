export type ResultSharingOutcome = "copied" | "shared" | "cancelled" | "manual";

export interface BrowserSharingApi {
  clipboard?: { writeText: (text: string) => Promise<void> };
  share?: (data: ShareData) => Promise<void>;
}

function browserApi(): BrowserSharingApi | undefined {
  return typeof navigator === "undefined" ? undefined : navigator;
}

export async function copyResultText(
  text: string,
  api: BrowserSharingApi | undefined = browserApi(),
): Promise<ResultSharingOutcome> {
  try {
    if (typeof api?.clipboard?.writeText !== "function") return "manual";
    await api.clipboard.writeText(text);
    return "copied";
  } catch {
    return "manual";
  }
}

export async function shareResultText(
  data: ShareData,
  fullText: string,
  api: BrowserSharingApi | undefined = browserApi(),
): Promise<ResultSharingOutcome> {
  try {
    if (typeof api?.share === "function") {
      await api.share(data);
      return "shared";
    }
  } catch (error) {
    // A user cancellation must not copy their result as a side effect.
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
      return "cancelled";
    }
  }
  return copyResultText(fullText, api);
}