import { useResultSharing } from "@/hooks/use-result-sharing";

/** Link-specific recovery labels; result-sharing defaults remain unchanged. */
export function useLinkCopy(
  kind: "quiz" | "invitation",
  feedback?: { title: string; description?: string },
) {
  const sharing = useResultSharing(feedback);
  return {
    ...sharing,
    dialogProps: {
      text: sharing.manualText,
      onClose: sharing.closeManualCopy,
      restoreFocus: sharing.restoreFocus,
      title: kind === "quiz" ? "Copy quiz link" : "Copy invitation link",
      label: kind === "quiz" ? "Quiz link" : "Invitation link",
      description: "Automatic copying isn't available in this browser. Select the link below, then use your device's Copy command (or Ctrl+C / Command+C) and paste it where you want to share.",
      selectLabel: "Select link",
      rows: 3,
    },
  };
}