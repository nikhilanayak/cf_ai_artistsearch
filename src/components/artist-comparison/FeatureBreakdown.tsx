import { useState } from "react";
import { Card } from "@/components/card/Card";
import { Button } from "@/components/button/Button";
import type { ArtistFeatures } from "@/feature-extractor";
import type { ComparisonResult } from "@/comparison-engine";
import { fixArtistName } from "@/lib/utils";

interface FeatureBreakdownProps {
  sourceArtist: string;
  sourceFeatures: ArtistFeatures;
  targetArtist: string;
  targetFeatures: ArtistFeatures;
  explanation: ComparisonResult;
}

export function FeatureBreakdown({
  sourceArtist,
  sourceFeatures,
  targetArtist,
  targetFeatures,
  explanation
}: FeatureBreakdownProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <Card className="p-4 space-y-4">
      <h4 className="font-semibold">Detailed Comparison</h4>

      {/* Themes Section */}
      <div>
        <Button
          onClick={() => toggleSection("themes")}
          variant="ghost"
          size="sm"
          className="w-full justify-between"
        >
          <span>Themes & Topics</span>
          <span>{expandedSection === "themes" ? "−" : "+"}</span>
        </Button>
        {expandedSection === "themes" && (
          <div className="mt-2 space-y-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {fixArtistName(sourceArtist)} Themes
              </div>
              <div className="flex flex-wrap gap-1">
                {sourceFeatures.themes.map((theme, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 text-xs rounded ${
                      explanation.sharedCharacteristics.themes.includes(theme)
                        ? "bg-blue-200 dark:bg-blue-800"
                        : "bg-neutral-200 dark:bg-neutral-800"
                    }`}
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {fixArtistName(targetArtist)} Themes
              </div>
              <div className="flex flex-wrap gap-1">
                {targetFeatures.themes.map((theme, idx) => (
                  <span
                    key={idx}
                    className={`px-2 py-0.5 text-xs rounded ${
                      explanation.sharedCharacteristics.themes.includes(theme)
                        ? "bg-blue-200 dark:bg-blue-800"
                        : "bg-neutral-200 dark:bg-neutral-800"
                    }`}
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
            {explanation.sharedCharacteristics.themes.length > 0 && (
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Shared Themes
                </div>
                <div className="flex flex-wrap gap-1">
                  {explanation.sharedCharacteristics.themes.map((theme, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-xs bg-green-200 dark:bg-green-800 rounded"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Musical Characteristics Section */}
      <div>
        <Button
          onClick={() => toggleSection("musical")}
          variant="ghost"
          size="sm"
          className="w-full justify-between"
        >
          <span>Musical Characteristics</span>
          <span>{expandedSection === "musical" ? "−" : "+"}</span>
        </Button>
        {expandedSection === "musical" && (
          <div className="mt-2 space-y-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {sourceArtist}
                </div>
                <div className="space-y-1">
                  {sourceFeatures.musicalCharacteristics.tempo && (
                    <div>Tempo: {sourceFeatures.musicalCharacteristics.tempo}</div>
                  )}
                  {sourceFeatures.musicalCharacteristics.energy && (
                    <div>Energy: {sourceFeatures.musicalCharacteristics.energy}</div>
                  )}
                  {sourceFeatures.musicalCharacteristics.mood && (
                    <div>Mood: {sourceFeatures.musicalCharacteristics.mood}</div>
                  )}
                  {sourceFeatures.musicalCharacteristics.instrumentation &&
                    sourceFeatures.musicalCharacteristics.instrumentation.length > 0 && (
                      <div>
                        Instruments: {sourceFeatures.musicalCharacteristics.instrumentation.join(", ")}
                      </div>
                    )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {fixArtistName(targetArtist)}
                </div>
                <div className="space-y-1">
                  {targetFeatures.musicalCharacteristics.tempo && (
                    <div>Tempo: {targetFeatures.musicalCharacteristics.tempo}</div>
                  )}
                  {targetFeatures.musicalCharacteristics.energy && (
                    <div>Energy: {targetFeatures.musicalCharacteristics.energy}</div>
                  )}
                  {targetFeatures.musicalCharacteristics.mood && (
                    <div>Mood: {targetFeatures.musicalCharacteristics.mood}</div>
                  )}
                  {targetFeatures.musicalCharacteristics.instrumentation &&
                    targetFeatures.musicalCharacteristics.instrumentation.length > 0 && (
                      <div>
                        Instruments: {targetFeatures.musicalCharacteristics.instrumentation.join(", ")}
                      </div>
                    )}
                </div>
              </div>
            </div>
            {explanation.sharedCharacteristics.musical.length > 0 && (
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Shared Musical Traits
                </div>
                <div className="space-y-1">
                  {explanation.sharedCharacteristics.musical.map((trait, idx) => (
                    <div key={idx} className="text-sm">
                      {trait}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lyrical Style Section */}
      <div>
        <Button
          onClick={() => toggleSection("lyrical")}
          variant="ghost"
          size="sm"
          className="w-full justify-between"
        >
          <span>Lyrical Style</span>
          <span>{expandedSection === "lyrical" ? "−" : "+"}</span>
        </Button>
        {expandedSection === "lyrical" && (
          <div className="mt-2 space-y-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {sourceArtist}
                </div>
                <div className="space-y-1">
                  <div>Complexity: {sourceFeatures.lyricalStyle.complexity}</div>
                  <div>Tone: {sourceFeatures.lyricalStyle.emotionalTone}</div>
                  <div>Style: {sourceFeatures.lyricalStyle.narrativeStyle}</div>
                  {sourceFeatures.lyricalStyle.commonTopics.length > 0 && (
                    <div>
                      Topics: {sourceFeatures.lyricalStyle.commonTopics.slice(0, 3).join(", ")}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {fixArtistName(targetArtist)}
                </div>
                <div className="space-y-1">
                  <div>Complexity: {targetFeatures.lyricalStyle.complexity}</div>
                  <div>Tone: {targetFeatures.lyricalStyle.emotionalTone}</div>
                  <div>Style: {targetFeatures.lyricalStyle.narrativeStyle}</div>
                  {targetFeatures.lyricalStyle.commonTopics.length > 0 && (
                    <div>
                      Topics: {targetFeatures.lyricalStyle.commonTopics.slice(0, 3).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {explanation.sharedCharacteristics.lyrical.length > 0 && (
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Shared Lyrical Traits
                </div>
                <div className="space-y-1">
                  {explanation.sharedCharacteristics.lyrical.map((trait, idx) => (
                    <div key={idx} className="text-sm">
                      {trait}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

