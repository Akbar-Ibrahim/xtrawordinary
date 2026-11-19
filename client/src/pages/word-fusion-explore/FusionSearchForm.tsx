import { Plus, X } from "lucide-react";
import {
  WORD_FUSION_EXPLORE_MAX_COMPONENTS,
  WORD_FUSION_EXPLORE_MAX_COMPONENT_LENGTH,
  WORD_FUSION_EXPLORE_MIN_COMPONENTS,
} from "@shared/word-fusion-explore";
import { ExploreIconButton } from "@/components/explore/ExploreIconButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FusionSearchForm({
  values,
  isSearching,
  onChange,
  onSubmit,
  onAdd,
  onRemove,
}: {
  values: string[];
  isSearching: boolean;
  onChange: (index: number, value: string) => void;
  onSubmit: () => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <form
      className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Build your pool</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose {WORD_FUSION_EXPLORE_MIN_COMPONENTS}–{WORD_FUSION_EXPLORE_MAX_COMPONENTS} dictionary words.
            </p>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-foreground" aria-live="polite">
            {values.length} / {WORD_FUSION_EXPLORE_MAX_COMPONENTS}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {values.map((value, index) => (
          <div className="flex items-end gap-2" key={index}>
            <div className="min-w-0 flex-1">
              <Label htmlFor={`fusion-component-${index}`} className="text-xs text-muted-foreground">
                Component {index + 1}
              </Label>
              <Input
                id={`fusion-component-${index}`}
                autoComplete="off"
                className="mt-1.5 uppercase"
                maxLength={WORD_FUSION_EXPLORE_MAX_COMPONENT_LENGTH}
                placeholder={index === 0 ? "e.g. ACT" : "e.g. ON"}
                value={value}
                onChange={(event) => onChange(index, event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Remove component ${index + 1}`}
              title={values.length <= WORD_FUSION_EXPLORE_MIN_COMPONENTS
                ? `At least ${WORD_FUSION_EXPLORE_MIN_COMPONENTS} components are required`
                : `Remove component ${index + 1}`}
              disabled={values.length <= WORD_FUSION_EXPLORE_MIN_COMPONENTS}
              onClick={() => onRemove(index)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={values.length >= WORD_FUSION_EXPLORE_MAX_COMPONENTS}
        onClick={onAdd}
      >
        <Plus aria-hidden="true" /> Add a word
      </Button>

      <div className="rounded-lg bg-muted/70 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        The resulting word must use every pooled letter, including duplicates, exactly once.
      </div>

      <div className="flex justify-center">
        <ExploreIconButton
          type="submit"
          disabled={isSearching}
          label="Explore word fusion"
          isLoading={isSearching}
        />
      </div>
    </form>
  );
}
