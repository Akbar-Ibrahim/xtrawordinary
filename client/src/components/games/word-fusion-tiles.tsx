import { motion } from "framer-motion";

export interface FusionTile {
  id: string;
  letter: string;
  componentIndex: number;
  position: number;
}

const GROUP_STYLES = [
  "border-blue-600 bg-blue-50 text-blue-950 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-50",
  "border-amber-600 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-50",
  "border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-50",
  "border-fuchsia-600 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-400 dark:bg-fuchsia-950 dark:text-fuchsia-50",
  "border-cyan-700 bg-cyan-50 text-cyan-950 dark:border-cyan-400 dark:bg-cyan-950 dark:text-cyan-50",
];

export function makeFusionTiles(components: string[]): FusionTile[] {
  return components.flatMap((component, componentIndex) =>
    component.toUpperCase().split("").map((letter, position) => ({
      id: `${componentIndex}-${position}`,
      letter,
      componentIndex,
      position,
    })),
  );
}

export function ComponentTileGroups({
  components,
  selectedIds,
  disabled,
  onSelect,
}: {
  components: string[];
  selectedIds: Set<string>;
  disabled?: boolean;
  onSelect: (tile: FusionTile) => void;
}) {
  const tiles = makeFusionTiles(components);
  return (
    <div className="flex flex-wrap justify-center gap-3" aria-label="Component letter groups">
      {components.map((component, componentIndex) => (
        <fieldset
          key={`${componentIndex}-${component}`}
          className={`min-w-0 rounded-xl border-2 p-3 ${GROUP_STYLES[componentIndex % GROUP_STYLES.length]}`}
          data-testid={`fusion-component-${componentIndex}`}
        >
          <legend className="px-1 text-xs font-bold uppercase tracking-wide">
            Component {componentIndex + 1}
          </legend>
          <div className="flex flex-wrap justify-center gap-1.5">
            {tiles.filter(tile => tile.componentIndex === componentIndex).map(tile => {
              const used = selectedIds.has(tile.id);
              return (
                <motion.button
                  key={tile.id}
                  type="button"
                  whileTap={used || disabled ? undefined : { scale: 0.9 }}
                  onClick={() => onSelect(tile)}
                  disabled={used || disabled}
                  aria-label={`${tile.letter}, component ${componentIndex + 1}, position ${tile.position + 1}${used ? ", used" : ""}`}
                  className="flex h-11 w-10 items-center justify-center rounded-lg border-2 border-current bg-white/90 font-mono text-xl font-black shadow-sm transition hover:-translate-y-0.5 hover:shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                  data-testid={`fusion-tile-${tile.id}`}
                >
                  {tile.letter}
                </motion.button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function AnswerTiles({
  tiles,
  onRemove,
}: {
  tiles: FusionTile[];
  onRemove: (index: number) => void;
}) {
  if (tiles.length === 0) {
    return (
      <div className="flex min-h-14 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 px-4 text-sm text-muted-foreground">
        Your answer appears here
      </div>
    );
  }

  return (
    <div className="flex min-h-14 flex-wrap items-center justify-center gap-1.5 rounded-xl border-2 border-primary/30 bg-primary/5 p-2" aria-label="Your assembled answer">
      {tiles.map((tile, index) => (
        <button
          key={`${tile.id}-${index}`}
          type="button"
          onClick={() => onRemove(index)}
          className="flex h-10 w-9 items-center justify-center rounded-md border border-primary/50 bg-background font-mono text-lg font-bold shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          aria-label={`Remove ${tile.letter} from position ${index + 1}`}
          data-testid={`fusion-answer-tile-${index}`}
        >
          {tile.letter}
        </button>
      ))}
    </div>
  );
}