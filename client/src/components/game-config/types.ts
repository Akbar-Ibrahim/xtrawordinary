export interface GameConfigProps {
  params: Record<string, any>;
  setParams: (updater: (p: Record<string, any>) => Record<string, any>) => void;
  /** Which dialog is hosting this component. Controls data-testid prefixes and small copy differences that predate this shared extraction. */
  dialogType: "quiz" | "season";
  /** Whether the host dialog is currently open. Async validation queries are gated on this. */
  open: boolean;
}
