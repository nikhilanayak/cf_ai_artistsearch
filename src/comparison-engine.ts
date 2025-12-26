import type { ArtistFeatures } from "./feature-extractor";

export interface ComparisonResult {
  userFriendlyExplanation: string;
  technicalBreakdown: {
    themeSimilarity: number;
    musicalSimilarity: number;
    lyricalSimilarity: number;
    overallSimilarity: number;
  };
  sharedCharacteristics: {
    themes: string[];
    musical: string[];
    lyrical: string[];
  };
  differences: {
    themes: string[];
    musical: string[];
    lyrical: string[];
  };
}

export async function compareArtists(
  ai: Ai,
  sourceArtist: string,
  sourceGenre: string,
  sourceFeatures: ArtistFeatures,
  targetArtist: string,
  targetGenre: string,
  targetFeatures: ArtistFeatures,
  vectorSimilarity: number
): Promise<ComparisonResult> {
  const themeSimilarity = calculateThemeSimilarity(sourceFeatures.themes, targetFeatures.themes);
  const musicalSimilarity = calculateMusicalSimilarity(
    sourceFeatures.musicalCharacteristics,
    targetFeatures.musicalCharacteristics
  );
  const lyricalSimilarity = calculateLyricalSimilarity(
    sourceFeatures.lyricalStyle,
    targetFeatures.lyricalStyle
  );
  
  const overallSimilarity = (
    vectorSimilarity * 0.5 +
    themeSimilarity * 0.2 +
    musicalSimilarity * 0.15 +
    lyricalSimilarity * 0.15
  );

  const sharedThemes = findIntersection(sourceFeatures.themes, targetFeatures.themes);
  const sharedMusical = findSharedMusicalCharacteristics(
    sourceFeatures.musicalCharacteristics,
    targetFeatures.musicalCharacteristics
  );
  const sharedLyrical = findSharedLyricalCharacteristics(
    sourceFeatures.lyricalStyle,
    targetFeatures.lyricalStyle
  );

  const differentThemes = findDifferences(sourceFeatures.themes, targetFeatures.themes);
  const differentMusical = findDifferentMusicalCharacteristics(
    sourceFeatures.musicalCharacteristics,
    targetFeatures.musicalCharacteristics
  );
  const differentLyrical = findDifferentLyricalCharacteristics(
    sourceFeatures.lyricalStyle,
    targetFeatures.lyricalStyle
  );

  const userFriendlyExplanation = await generateUserFriendlyExplanation(
    ai,
    sourceArtist,
    sourceGenre,
    sourceFeatures,
    targetArtist,
    targetGenre,
    targetFeatures,
    {
      themeSimilarity,
      musicalSimilarity,
      lyricalSimilarity,
      sharedThemes,
      sharedMusical,
      sharedLyrical
    }
  );

  return {
    userFriendlyExplanation,
    technicalBreakdown: {
      themeSimilarity,
      musicalSimilarity,
      lyricalSimilarity,
      overallSimilarity
    },
    sharedCharacteristics: {
      themes: sharedThemes,
      musical: sharedMusical,
      lyrical: sharedLyrical
    },
    differences: {
      themes: differentThemes,
      musical: differentMusical,
      lyrical: differentLyrical
    }
  };
}

function calculateThemeSimilarity(themes1: string[], themes2: string[]): number {
  if (themes1.length === 0 && themes2.length === 0) return 1.0;
  if (themes1.length === 0 || themes2.length === 0) return 0.0;

  const set1 = new Set(themes1.map(t => t.toLowerCase().trim()));
  const set2 = new Set(themes2.map(t => t.toLowerCase().trim()));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

function calculateMusicalSimilarity(
  music1: ArtistFeatures["musicalCharacteristics"],
  music2: ArtistFeatures["musicalCharacteristics"]
): number {
  let matches = 0;
  let total = 0;

  const compare = (val1: string | undefined, val2: string | undefined) => {
    if (val1 && val2) {
      total++;
      if (val1.toLowerCase() === val2.toLowerCase()) {
        matches++;
      }
    }
  };

  compare(music1.tempo, music2.tempo);
  compare(music1.key, music2.key);
  compare(music1.mood, music2.mood);
  compare(music1.energy, music2.energy);

  if (music1.instrumentation && music2.instrumentation) {
    const inst1 = new Set(music1.instrumentation.map(i => i.toLowerCase()));
    const inst2 = new Set(music2.instrumentation.map(i => i.toLowerCase()));
    const intersection = new Set([...inst1].filter(x => inst2.has(x)));
    const union = new Set([...inst1, ...inst2]);
    if (union.size > 0) {
      total++;
      matches += intersection.size / union.size;
    }
  }

  return total > 0 ? matches / total : 0.5;
}

function calculateLyricalSimilarity(
  style1: ArtistFeatures["lyricalStyle"],
  style2: ArtistFeatures["lyricalStyle"]
): number {
  let matches = 0;
  let total = 0;

  if (style1.complexity && style2.complexity) {
    total++;
    if (style1.complexity === style2.complexity) {
      matches++;
    }
  }

  if (style1.emotionalTone && style2.emotionalTone) {
    total++;
    const tone1 = style1.emotionalTone.toLowerCase();
    const tone2 = style2.emotionalTone.toLowerCase();
    const words1 = new Set(tone1.split(/\s+/));
    const words2 = new Set(tone2.split(/\s+/));
    const commonWords = new Set([...words1].filter(w => words2.has(w) && w.length > 3));
    if (words1.size > 0 && words2.size > 0) {
      matches += commonWords.size / Math.max(words1.size, words2.size);
    }
  }

  if (style1.commonTopics && style2.commonTopics) {
    const topicSimilarity = calculateThemeSimilarity(style1.commonTopics, style2.commonTopics);
    total++;
    matches += topicSimilarity;
  }

  return total > 0 ? matches / total : 0.5;
}

function findIntersection(arr1: string[], arr2: string[]): string[] {
  const set1 = new Set(arr1.map(s => s.toLowerCase().trim()));
  const set2 = new Set(arr2.map(s => s.toLowerCase().trim()));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  
  return arr1.filter(s => intersection.has(s.toLowerCase().trim()));
}

function findDifferences(arr1: string[], arr2: string[]): string[] {
  const set2 = new Set(arr2.map(s => s.toLowerCase().trim()));
  return arr1.filter(s => !set2.has(s.toLowerCase().trim()));
}

function findSharedMusicalCharacteristics(
  music1: ArtistFeatures["musicalCharacteristics"],
  music2: ArtistFeatures["musicalCharacteristics"]
): string[] {
  const shared: string[] = [];

  if (music1.tempo && music2.tempo && music1.tempo.toLowerCase() === music2.tempo.toLowerCase()) {
    shared.push(`Tempo: ${music1.tempo}`);
  }
  if (music1.energy && music2.energy && music1.energy.toLowerCase() === music2.energy.toLowerCase()) {
    shared.push(`Energy: ${music1.energy}`);
  }
  if (music1.mood && music2.mood && music1.mood.toLowerCase() === music2.mood.toLowerCase()) {
    shared.push(`Mood: ${music1.mood}`);
  }

  if (music1.instrumentation && music2.instrumentation) {
    const sharedInstruments = findIntersection(music1.instrumentation, music2.instrumentation);
    if (sharedInstruments.length > 0) {
      shared.push(`Instruments: ${sharedInstruments.join(", ")}`);
    }
  }

  return shared;
}

function findDifferentMusicalCharacteristics(
  music1: ArtistFeatures["musicalCharacteristics"],
  music2: ArtistFeatures["musicalCharacteristics"]
): string[] {
  const differences: string[] = [];

  if (music1.tempo && music2.tempo && music1.tempo.toLowerCase() !== music2.tempo.toLowerCase()) {
    differences.push(`${music1.tempo} vs ${music2.tempo} tempo`);
  }
  if (music1.energy && music2.energy && music1.energy.toLowerCase() !== music2.energy.toLowerCase()) {
    differences.push(`${music1.energy} vs ${music2.energy} energy`);
  }

  return differences;
}

function findSharedLyricalCharacteristics(
  style1: ArtistFeatures["lyricalStyle"],
  style2: ArtistFeatures["lyricalStyle"]
): string[] {
  const shared: string[] = [];

  if (style1.complexity === style2.complexity) {
    shared.push(`${style1.complexity} lyrical complexity`);
  }

  const sharedTopics = findIntersection(style1.commonTopics || [], style2.commonTopics || []);
  if (sharedTopics.length > 0) {
    shared.push(`Topics: ${sharedTopics.join(", ")}`);
  }

  return shared;
}

function findDifferentLyricalCharacteristics(
  style1: ArtistFeatures["lyricalStyle"],
  style2: ArtistFeatures["lyricalStyle"]
): string[] {
  const differences: string[] = [];

  if (style1.complexity !== style2.complexity) {
    differences.push(`${style1.complexity} vs ${style2.complexity} complexity`);
  }

  return differences;
}

async function generateUserFriendlyExplanation(
  ai: Ai,
  sourceArtist: string,
  sourceGenre: string,
  sourceFeatures: ArtistFeatures,
  targetArtist: string,
  targetGenre: string,
  targetFeatures: ArtistFeatures,
  similarities: {
    themeSimilarity: number;
    musicalSimilarity: number;
    lyricalSimilarity: number;
    sharedThemes: string[];
    sharedMusical: string[];
    sharedLyrical: string[];
  }
): Promise<string> {
  const prompt = `Explain why ${sourceArtist} (${sourceGenre}) and ${targetArtist} (${targetGenre}) are similar artists. 

Source Artist Features:
- Themes: ${sourceFeatures.themes.join(", ") || "various"}
- Musical: ${JSON.stringify(sourceFeatures.musicalCharacteristics)}
- Lyrical Style: ${sourceFeatures.lyricalStyle.complexity} complexity, ${sourceFeatures.lyricalStyle.emotionalTone} tone

Target Artist Features:
- Themes: ${targetFeatures.themes.join(", ") || "various"}
- Musical: ${JSON.stringify(targetFeatures.musicalCharacteristics)}
- Lyrical Style: ${targetFeatures.lyricalStyle.complexity} complexity, ${targetFeatures.lyricalStyle.emotionalTone} tone

Shared Characteristics:
- Themes: ${similarities.sharedThemes.join(", ") || "none"}
- Musical: ${similarities.sharedMusical.join(", ") || "none"}
- Lyrical: ${similarities.sharedLyrical.join(", ") || "none"}

Write a concise, natural explanation (2-3 sentences) that helps users understand why these artists are equivalent across genres. Focus on what makes them similar in style, themes, or approach.`;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-70b-instruct", {
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    let explanation = "";
    if (response.response) {
      explanation = response.response;
    } else if (typeof response === "string") {
      explanation = response;
    } else if (response.choices && response.choices[0] && response.choices[0].message) {
      explanation = response.choices[0].message.content || "";
    }

    return explanation.trim() || "These artists share similar musical and lyrical characteristics that make them equivalent across genres.";
  } catch (error) {
    console.error("Error generating explanation:", error);
    const sharedParts: string[] = [];
    if (similarities.sharedThemes.length > 0) {
      sharedParts.push(`both explore themes like ${similarities.sharedThemes.slice(0, 3).join(", ")}`);
    }
    if (similarities.sharedMusical.length > 0) {
      sharedParts.push(`share ${similarities.sharedMusical[0]}`);
    }
    
    if (sharedParts.length > 0) {
      return `${sourceArtist} and ${targetArtist} are equivalent because they ${sharedParts.join(" and ")}.`;
    }
    
    return `${sourceArtist} and ${targetArtist} share similar artistic approaches that make them equivalent across the ${sourceGenre} and ${targetGenre} genres.`;
  }
}

