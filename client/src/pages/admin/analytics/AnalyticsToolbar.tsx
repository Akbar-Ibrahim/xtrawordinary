import { Download, Filter, RefreshCw } from "lucide-react";
import type { Game } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TRACKED_ANALYTICS_MODES } from "./query";

export interface AnalyticsToolbarProps {
  startDate: string;
  endDate: string;
  gameSlug?: string;
  gameMode?: string;
  games: Game[];
  isFetching?: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onGameChange: (value?: string) => void;
  onModeChange: (value?: string) => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

export function AnalyticsToolbar({
  startDate, endDate, gameSlug, gameMode, games, isFetching,
  onStartDateChange, onEndDateChange, onGameChange, onModeChange, onRefresh, onExport,
}: AnalyticsToolbarProps) {
  const modes = TRACKED_ANALYTICS_MODES;
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Filter className="h-4 w-4 text-primary" /> Report controls
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {startDate} — {endDate}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.15fr_1.15fr_auto] lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="analytics-start">Start date</Label>
          <Input id="analytics-start" type="date" value={startDate} max={endDate} onChange={(e) => onStartDateChange(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="analytics-end">End date</Label>
          <Input id="analytics-end" type="date" value={endDate} min={startDate} onChange={(e) => onEndDateChange(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Game</Label>
          <Select value={gameSlug ?? "all"} onValueChange={(value) => onGameChange(value === "all" ? undefined : value)}>
            <SelectTrigger><SelectValue placeholder="All games" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All games</SelectItem>{games.map((game) => <SelectItem key={game.slug} value={game.slug}>{game.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select value={gameMode ?? "all"} onValueChange={(value) => onModeChange(value === "all" ? undefined : value)}>
            <SelectTrigger><SelectValue placeholder="All modes" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All modes</SelectItem>{modes.map((mode) => <SelectItem key={mode.slug} value={mode.slug}>{mode.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {onRefresh && <Button type="button" variant="outline" size="icon" onClick={onRefresh} disabled={isFetching} aria-label="Refresh report"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button>}
          {onExport && <Button type="button" variant="outline" onClick={onExport}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>}
        </div>
      </div>
    </div>
  );
}