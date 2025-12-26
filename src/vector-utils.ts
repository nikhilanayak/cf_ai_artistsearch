export interface ArtistResult {
  artist: string;
  genre: string;
  score: number;
}

export async function getArtistVector(
  vectorize: VectorizeIndex,
  artist: string,
  genre: string
): Promise<number[] | null> {
  const id = `${genre}_${artist}`.replace(/\s+/g, '_').replace(/\//g, '_');
  
  try {
    const result = await vectorize.getByIds([id]);
    if (result.length === 0 || !result[0]) {
      return null;
    }
    
    const vector = result[0];
    // Vectorize returns values as Float32Array, convert to regular array
    if (vector.values instanceof Float32Array) {
      return Array.from(vector.values);
    }
    return vector.values as number[];
  } catch (error) {
    console.error(`Error getting artist vector for ${artist} (${genre}):`, error);
    return null;
  }
}

export async function getAverageGenreVector(
  vectorize: VectorizeIndex,
  genre: string
): Promise<number[] | null> {
  const id = `avg_genre_${genre}`;
  
  try {
    const result = await vectorize.getByIds([id]);
    if (result.length === 0 || !result[0]) {
      return null;
    }
    
    const vector = result[0];
    // Vectorize returns values as Float32Array, convert to regular array
    if (vector.values instanceof Float32Array) {
      return Array.from(vector.values);
    }
    return vector.values as number[];
  } catch (error) {
    console.error(`Error getting average genre vector for ${genre}:`, error);
    return null;
  }
}

function vectorArithmetic(
  artistVector: number[],
  avgSourceGenreVector: number[],
  avgTargetGenreVector: number[]
): number[] {
  const dims = artistVector.length;
  if (avgSourceGenreVector.length !== dims || avgTargetGenreVector.length !== dims) {
    throw new Error("Vector dimension mismatch");
  }
  
  const result: number[] = new Array(dims);
  for (let i = 0; i < dims; i++) {
    result[i] = artistVector[i] - avgSourceGenreVector[i] + avgTargetGenreVector[i];
  }
  
  return result;
}

export async function findEquivalentArtists(
  vectorize: VectorizeIndex,
  sourceArtist: string,
  sourceGenre: string,
  targetGenre: string,
  topK: number = 3
): Promise<ArtistResult[]> {
  const artistVector = await getArtistVector(vectorize, sourceArtist, sourceGenre);
  if (!artistVector) {
    throw new Error(`Artist ${sourceArtist} not found in genre ${sourceGenre}`);
  }
  
  const avgSourceVector = await getAverageGenreVector(vectorize, sourceGenre);
  if (!avgSourceVector) {
    throw new Error(`Average vector not found for source genre ${sourceGenre}`);
  }
  
  const avgTargetVector = await getAverageGenreVector(vectorize, targetGenre);
  if (!avgTargetVector) {
    throw new Error(`Average vector not found for target genre ${targetGenre}`);
  }
  
  const equivalentVector = vectorArithmetic(artistVector, avgSourceVector, avgTargetVector);
  
  const allMatches: Array<{ match: any; metadata: any }> = [];
  
  for (let i = 0; i < 3; i++) {
    const queryVector = i === 0 
      ? equivalentVector 
      : equivalentVector.map(v => v + (Math.random() - 0.5) * 0.001);
    
    const queryResult = await vectorize.query(queryVector, {
      topK: 50,
      returnMetadata: true,
      returnValues: false
    });
    
    for (const match of queryResult.matches || []) {
      allMatches.push({
        match,
        metadata: match.metadata as { genre?: string; artist?: string; type?: string }
      });
    }
  }
  
  const seen = new Set<string>();
  const uniqueMatches = allMatches.filter(({ match }) => {
    if (match.id && !seen.has(match.id)) {
      seen.add(match.id);
      return true;
    }
    return false;
  });
  
  uniqueMatches.sort((a, b) => (b.match.score || 0) - (a.match.score || 0));
  
  console.log(`Query returned ${uniqueMatches.length} unique matches`);
  
  const results: ArtistResult[] = [];
  
  for (const { match, metadata } of uniqueMatches) {
    if (results.length === 0 && uniqueMatches.indexOf({ match, metadata }) < 10) {
      console.log(`Match:`, {
        id: match.id,
        type: metadata.type,
        genre: metadata.genre,
        artist: metadata.artist,
        score: match.score,
        matchesTarget: metadata.genre === targetGenre && metadata.type === "artist"
      });
    }
    
    const matchGenre = metadata.genre?.toLowerCase().trim();
    const targetGenreLower = targetGenre.toLowerCase().trim();
    
    if (
      metadata.type === "artist" &&
      matchGenre === targetGenreLower &&
      metadata.artist
    ) {
      results.push({
        artist: metadata.artist,
        genre: metadata.genre || targetGenre,
        score: match.score || 0
      });
      
      if (results.length >= topK) {
        break;
      }
    }
  }
  
  console.log(`Filtered to ${results.length} results in target genre ${targetGenre}`);
  
  if (results.length === 0) {
    const availableGenres = Array.from(new Set(
      uniqueMatches.map(({ metadata }) => metadata.genre?.toLowerCase().trim()).filter(Boolean)
    ));
    console.warn(`No artists found in target genre "${targetGenre}". Available genres in results:`, availableGenres);
    console.warn(`Looking for: "${targetGenreLower}", found genres:`, availableGenres);
  }
  
  return results;
}

