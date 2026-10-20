import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function ManualCopyDialog({
  text, onClose, restoreFocus,
  title = "Copy your result",
  label = "Result text",
  description = "Automatic copying isn't available in this browser. Select the text below, then use your device's Copy command (or Ctrl+C / Command+C) and paste it where you want to share.",
  selectLabel = "Select text",
  rows = 8,
}: {
  text: string | null;
  onClose: () => void;
  restoreFocus: () => void;
  title?: string;
  label?: string;
  description?: string;
  selectLabel?: string;
  rows?: number;
}) {
  const fieldId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const selectText = () => {
    field.current?.focus();
    field.current?.select();
  };

  return (
    <Dialog open={text !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto"
        onOpenAutoFocus={(event) => { event.preventDefault(); selectText(); }}
        onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
          <Textarea
            id={fieldId}
            ref={field}
            readOnly
            value={text ?? ""}
            rows={rows}
            data-testid="manual-copy-result-text"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={selectText} data-testid="button-select-result-text">{selectLabel}</Button>
          <DialogClose asChild><Button data-testid="button-close-manual-copy">Done</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}