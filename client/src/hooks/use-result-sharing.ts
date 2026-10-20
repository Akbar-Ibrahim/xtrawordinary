import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { copyResultText, shareResultText, type ResultSharingOutcome } from "@/lib/result-sharing";

export function useResultSharing(copyFeedback?: { title: string; description?: string }) {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(copiedTimer.current);
    };
  }, []);

  const run = async (text: string, operation: () => Promise<ResultSharingOutcome>, source?: HTMLElement) => {
    // React state alone would not guard two clicks before the next render.
    if (busy.current) return;
    busy.current = true;
    trigger.current = source ?? null;
    setIsPending(true);
    setCopied(false);
    setCopiedText(null);
    clearTimeout(copiedTimer.current);
    try {
      const outcome = await operation();
      if (!mounted.current) return;
      if (outcome === "copied") {
        setCopied(true);
        setCopiedText(text);
        if (copyFeedback) toast(copyFeedback);
        copiedTimer.current = setTimeout(() => {
          setCopied(false);
          setCopiedText(null);
        }, 2000);
      } else if (outcome === "manual") {
        setManualText(text);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setIsPending(false);
    }
  };

  return {
    isPending,
    copied,
    copiedText,
    manualText,
    closeManualCopy: () => setManualText(null),
    restoreFocus: () => trigger.current?.focus(),
    copy: (text: string, source?: HTMLElement) => run(text, () => copyResultText(text), source),
    share: (data: ShareData, fullText: string, source?: HTMLElement) =>
      run(fullText, () => shareResultText(data, fullText), source),
  };
}