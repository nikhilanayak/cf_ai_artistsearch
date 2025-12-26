export interface ArtistFeatures {
  themes: string[];
  musicalCharacteristics: {
    tempo?: string;
    key?: string;
    mood?: string;
    instrumentation?: string[];
    energy?: string;
  };
  lyricalStyle: {
    complexity: "simple" | "moderate" | "complex";
    emotionalTone: string;
    narrativeStyle: string;
    commonTopics: string[];
  };
}

export async function extractArtistFeatures(
  ai: Ai,
  artistDocument: string,
  artistName: string,
  genre: string
): Promise<ArtistFeatures> {
  const prompt = `Analyze the following artist document and extract key features. Return a JSON object with this exact structure:
{
  "themes": ["array", "of", "main", "themes", "in", "lyrics"],
  "musicalCharacteristics": {
    "tempo": "fast/medium/slow or specific BPM if mentioned",
    "key": "major/minor or specific key if mentioned",
    "mood": "description of overall mood",
    "instrumentation": ["list", "of", "instruments", "mentioned"],
    "energy": "high/medium/low"
  },
  "lyricalStyle": {
    "complexity": "simple/moderate/complex",
    "emotionalTone": "description of emotional tone",
    "narrativeStyle": "description of storytelling approach",
    "commonTopics": ["list", "of", "common", "topics", "or", "subjects"]
  }
}

Artist: ${artistName}
Genre: ${genre}

Document:
${artistDocument}

Return only valid JSON, no additional text.`;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-70b-instruct", {
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    let responseText = "";
    if (response.response) {
      responseText = response.response;
    } else if (typeof response === "string") {
      responseText = response;
    } else if (response.choices && response.choices[0] && response.choices[0].message) {
      responseText = response.choices[0].message.content || "";
    }

    responseText = responseText.trim();
    if (responseText.startsWith("```json")) {
      responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    let jsonText = responseText;
    if (!responseText.trim().startsWith("{")) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    let features: ArtistFeatures;
    try {
      features = JSON.parse(jsonText) as ArtistFeatures;
    } catch (parseError) {
      try {
        let fixedJson = jsonText.replace(/,(\s*[}\]])/g, '$1');
        fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        features = JSON.parse(fixedJson) as ArtistFeatures;
      } catch (fixError) {
        console.warn(`Failed to parse JSON for ${artistName}, attempting fallback extraction`);
        features = extractFeaturesFromText(responseText);
      }
    }

    if (!features.themes || !Array.isArray(features.themes)) {
      features.themes = [];
    }
    if (!features.musicalCharacteristics) {
      features.musicalCharacteristics = {};
    }
    if (!features.lyricalStyle) {
      features.lyricalStyle = {
        complexity: "moderate",
        emotionalTone: "neutral",
        narrativeStyle: "descriptive",
        commonTopics: []
      };
    }

    return features;
  } catch (error) {
    console.error(`Error extracting features for ${artistName}:`, error);
    return {
      themes: [],
      musicalCharacteristics: {},
      lyricalStyle: {
        complexity: "moderate",
        emotionalTone: "neutral",
        narrativeStyle: "descriptive",
        commonTopics: []
      }
    };
  }
}

function extractFeaturesFromText(text: string): ArtistFeatures {
  const features: ArtistFeatures = {
    themes: [],
    musicalCharacteristics: {},
    lyricalStyle: {
      complexity: "moderate",
      emotionalTone: "neutral",
      narrativeStyle: "descriptive",
      commonTopics: []
    }
  };

  const themesMatch = text.match(/"themes"\s*:\s*\[(.*?)\]/s) || text.match(/themes[:\s]+\[(.*?)\]/is);
  if (themesMatch) {
    const themesText = themesMatch[1];
    features.themes = themesText
      .split(",")
      .map(t => t.trim().replace(/^["']|["']$/g, ""))
      .filter(t => t.length > 0);
  }

  const musicalMatch = text.match(/"musicalCharacteristics"\s*:\s*\{([^}]*)\}/s) || 
                       text.match(/musicalCharacteristics[:\s]+\{([^}]*)\}/is);
  if (musicalMatch) {
    const musicalText = musicalMatch[1];
    if (musicalText.includes("tempo")) {
      const tempoMatch = musicalText.match(/"tempo"\s*:\s*"([^"]+)"/) || 
                        musicalText.match(/tempo[:\s]+"([^"]+)"/i);
      if (tempoMatch) features.musicalCharacteristics.tempo = tempoMatch[1];
    }
    if (musicalText.includes("mood")) {
      const moodMatch = musicalText.match(/"mood"\s*:\s*"([^"]+)"/) || 
                       musicalText.match(/mood[:\s]+"([^"]+)"/i);
      if (moodMatch) features.musicalCharacteristics.mood = moodMatch[1];
    }
    if (musicalText.includes("energy")) {
      const energyMatch = musicalText.match(/"energy"\s*:\s*"([^"]+)"/) || 
                         musicalText.match(/energy[:\s]+"([^"]+)"/i);
      if (energyMatch) features.musicalCharacteristics.energy = energyMatch[1];
    }
  }

  // Try to extract lyrical style
  const lyricalMatch = text.match(/"lyricalStyle"\s*:\s*\{([^}]*)\}/s) || 
                      text.match(/lyricalStyle[:\s]+\{([^}]*)\}/is);
  if (lyricalMatch) {
    const lyricalText = lyricalMatch[1];
    if (lyricalText.includes("complexity")) {
      const complexityMatch = lyricalText.match(/"complexity"\s*:\s*"([^"]+)"/) || 
                             lyricalText.match(/complexity[:\s]+"([^"]+)"/i);
      if (complexityMatch) {
        const comp = complexityMatch[1].toLowerCase();
        if (comp === "simple" || comp === "moderate" || comp === "complex") {
          features.lyricalStyle.complexity = comp as "simple" | "moderate" | "complex";
        }
      }
    }
    if (lyricalText.includes("emotionalTone")) {
      const toneMatch = lyricalText.match(/"emotionalTone"\s*:\s*"([^"]+)"/) || 
                       lyricalText.match(/emotionalTone[:\s]+"([^"]+)"/i);
      if (toneMatch) features.lyricalStyle.emotionalTone = toneMatch[1];
    }
  }

  return features;
}

export function parseMusicalFeatures(featuresText: string): Partial<ArtistFeatures["musicalCharacteristics"]> {
  const result: Partial<ArtistFeatures["musicalCharacteristics"]> = {};
  
  if (!featuresText) return result;

  const tempoMatch = featuresText.match(/\b(\d+)\s*bpm\b/i) || featuresText.match(/\b(tempo|bpm)[:\s]+(\d+)/i);
  if (tempoMatch) {
    const bpm = parseInt(tempoMatch[1] || tempoMatch[2]);
    if (bpm < 90) result.tempo = "slow";
    else if (bpm < 130) result.tempo = "medium";
    else result.tempo = "fast";
  }

  const keyMatch = featuresText.match(/\b([A-G][#b]?)\s*(major|minor)\b/i);
  if (keyMatch) {
    result.key = `${keyMatch[1]} ${keyMatch[2]}`;
  }

  const moodKeywords = {
    high: ["energetic", "upbeat", "high energy", "fast", "intense"],
    low: ["mellow", "slow", "calm", "relaxed", "soft"],
    medium: ["moderate", "balanced", "steady"]
  };

  const lowerText = featuresText.toLowerCase();
  for (const [level, keywords] of Object.entries(moodKeywords)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      result.energy = level;
      break;
    }
  }

  const instruments: string[] = [];
  const instrumentKeywords = ["guitar", "piano", "drums", "bass", "violin", "saxophone", "trumpet", "synth", "keyboard"];
  for (const inst of instrumentKeywords) {
    if (lowerText.includes(inst)) {
      instruments.push(inst);
    }
  }
  if (instruments.length > 0) {
    result.instrumentation = instruments;
  }

  return result;
}

