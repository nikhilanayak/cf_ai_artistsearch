import { Card } from "@/components/card/Card";
import type { ComparisonResult } from "@/comparison-engine";

interface ComparisonCardProps {
  sourceArtist: string;
  sourceGenre: string;
  targetArtist: string;
  targetGenre: string;
  explanation: ComparisonResult;
}

export function ComparisonCard({
  sourceArtist,
  sourceGenre,
  targetArtist,
  targetGenre,
  explanation
}: ComparisonCardProps) {
  return (
    <Card className="p-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Source Artist */}
        <div className="space-y-3">
          <div>
            <div className="font-semibold text-lg">{sourceArtist}</div>
            <div className="text-sm text-muted-foreground">{sourceGenre}</div>
          </div>
          
          {explanation.sharedCharacteristics.themes.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Themes</div>
              <div className="flex flex-wrap gap-1">
                {explanation.sharedCharacteristics.themes.slice(0, 5).map((theme, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 rounded"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Target Artist */}
        <div className="space-y-3">
          <div>
            <div className="font-semibold text-lg">{targetArtist}</div>
            <div className="text-sm text-muted-foreground">{targetGenre}</div>
          </div>
          
          {explanation.sharedCharacteristics.themes.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Themes</div>
              <div className="flex flex-wrap gap-1">
                {explanation.sharedCharacteristics.themes.slice(0, 5).map((theme, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 rounded"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shared Characteristics */}
      {(explanation.sharedCharacteristics.musical.length > 0 ||
        explanation.sharedCharacteristics.lyrical.length > 0) && (
        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="text-xs font-medium text-muted-foreground mb-2">Shared Characteristics</div>
          <div className="space-y-1">
            {explanation.sharedCharacteristics.musical.map((char, idx) => (
              <div key={`musical-${idx}`} className="text-sm">
                <span className="text-muted-foreground">Musical: </span>
                {char}
              </div>
            ))}
            {explanation.sharedCharacteristics.lyrical.map((char, idx) => (
              <div key={`lyrical-${idx}`} className="text-sm">
                <span className="text-muted-foreground">Lyrical: </span>
                {char}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

