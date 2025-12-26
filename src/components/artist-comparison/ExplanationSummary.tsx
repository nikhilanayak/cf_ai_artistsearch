import { useState } from "react";
import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import type { ComparisonResult } from "@/comparison-engine";
import { fixArtistName } from "@/lib/utils";

interface ExplanationSummaryProps {
  sourceArtist: string;
  targetArtist: string;
  explanation: ComparisonResult;
}

export function ExplanationSummary({
  sourceArtist,
  targetArtist,
  explanation
}: ExplanationSummaryProps) {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h4 className="font-semibold mb-2">Why {fixArtistName(sourceArtist)} matches {fixArtistName(targetArtist)}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {explanation.userFriendlyExplanation}
        </p>
      </div>

      <Button
        onClick={() => setShowTechnical(!showTechnical)}
        variant="ghost"
        size="sm"
        className="w-full"
      >
        {showTechnical ? "Hide" : "Show"} Technical Details
      </Button>

      {showTechnical && (
        <div className="space-y-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Similarity Scores</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Overall Similarity</span>
                <span className="font-mono">
                  {(explanation.technicalBreakdown.overallSimilarity * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Theme Similarity</span>
                <span className="font-mono">
                  {(explanation.technicalBreakdown.themeSimilarity * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Musical Similarity</span>
                <span className="font-mono">
                  {(explanation.technicalBreakdown.musicalSimilarity * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Lyrical Similarity</span>
                <span className="font-mono">
                  {(explanation.technicalBreakdown.lyricalSimilarity * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

