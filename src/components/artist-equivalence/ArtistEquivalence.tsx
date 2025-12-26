import { useEffect, useState, useMemo, useRef } from "react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Label } from "@/components/label/Label";
import { ExplanationSummary } from "@/components/artist-comparison/ExplanationSummary";
import { ComparisonCard } from "@/components/artist-comparison/ComparisonCard";
import { FeatureBreakdown } from "@/components/artist-comparison/FeatureBreakdown";
import type { ComparisonResult } from "@/comparison-engine";
import type { ArtistFeatures } from "@/feature-extractor";
import { apiFetch } from "@/api-utils";

interface Artist {
  name: string;
  genre: string;
}

interface EnhancedEquivalentResult {
  artist: string;
  genre: string;
  score: number;
  explanation: ComparisonResult | null;
  sourceFeatures: ArtistFeatures | null;
  targetFeatures: ArtistFeatures | null;
}

interface ArtistEquivalenceProps {
  onGenerateSong: (sourceArtist: string, sourceGenre: string, targetArtist: string, targetGenre: string) => void;
}

export function ArtistEquivalence({ onGenerateSong }: ArtistEquivalenceProps) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [artistSearch, setArtistSearch] = useState<string>("");
  const [genreFilterSearch, setGenreFilterSearch] = useState<string>("");
  const [targetGenreSearch, setTargetGenreSearch] = useState<string>("");
  const [showArtistDropdown, setShowArtistDropdown] = useState(false);
  const [showGenreFilterDropdown, setShowGenreFilterDropdown] = useState(false);
  const [showTargetGenreDropdown, setShowTargetGenreDropdown] = useState(false);
  const [results, setResults] = useState<EnhancedEquivalentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Finding equivalent artists...");
  const [error, setError] = useState<string | null>(null);
  const artistDropdownRef = useRef<HTMLDivElement>(null);
  const genreFilterDropdownRef = useRef<HTMLDivElement>(null);
  const targetGenreDropdownRef = useRef<HTMLDivElement>(null);
  const artistInputRef = useRef<HTMLInputElement>(null);
  const targetGenreInputRef = useRef<HTMLInputElement>(null);

  // Fetch artists and genres on mount
  useEffect(() => {
    apiFetch("/api/artists")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json() as Promise<{ artists: Artist[]; genres: string[]; error?: string }>;
      })
      .then((data) => {
        if (data.error) {
          console.error("API error:", data.error);
        }
        setArtists(data.artists || []);
        setGenres(data.genres || []);
        if ((data.artists || []).length === 0) {
          console.warn("No artists found. Make sure embeddings are uploaded to Vectorize.");
        }
      })
      .catch((error) => {
        console.error("Error fetching artists:", error);
        setError("Failed to load artists and genres.");
      });
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (artistDropdownRef.current && !artistDropdownRef.current.contains(event.target as Node)) {
        setShowArtistDropdown(false);
      }
      if (genreFilterDropdownRef.current && !genreFilterDropdownRef.current.contains(event.target as Node)) {
        setShowGenreFilterDropdown(false);
      }
      if (targetGenreDropdownRef.current && !targetGenreDropdownRef.current.contains(event.target as Node)) {
        setShowTargetGenreDropdown(false);
      }
    };

    if (showArtistDropdown || showGenreFilterDropdown || showTargetGenreDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showArtistDropdown, showGenreFilterDropdown, showTargetGenreDropdown]);

  // Get selected artist data (now using just artist name)
  const selectedArtistData = artists.find((a) => a.name === selectedArtist);
  
  // Filter artists by genre filter and search query
  const filteredArtists = useMemo(() => {
    return artists.filter((artist) => {
      const matchesGenre = !genreFilter || artist.genre.toLowerCase() === genreFilter.toLowerCase();
      const matchesSearch = !artistSearch || 
        artist.name.toLowerCase().includes(artistSearch.toLowerCase()) ||
        artist.genre.toLowerCase().includes(artistSearch.toLowerCase());
      return matchesGenre && matchesSearch;
    });
  }, [artists, genreFilter, artistSearch]);

  // Filter genres for genre filter dropdown
  const filteredGenresForFilter = useMemo(() => {
    return genres.filter((genre) => {
      const matchesSearch = !genreFilterSearch || 
        genre.toLowerCase().includes(genreFilterSearch.toLowerCase());
      return matchesSearch;
    });
  }, [genres, genreFilterSearch]);

  // Filter genres for target genre dropdown (exclude "misc" and transform "rb" to "r&b" in display)
  const filteredTargetGenres = useMemo(() => {
    return genres
      .filter((genre) => genre.toLowerCase() !== "misc")
      .filter((genre) => {
        const matchesSearch = !targetGenreSearch || 
          genre.toLowerCase().includes(targetGenreSearch.toLowerCase()) ||
          (genre.toLowerCase() === "rb" && "r&b".toLowerCase().includes(targetGenreSearch.toLowerCase()));
        return matchesSearch;
      });
  }, [genres, targetGenreSearch]);

  // Helper to format genre display (rb -> r&b)
  const formatGenreDisplay = (genre: string) => {
    return genre.toLowerCase() === "rb" ? "r&b" : genre;
  };

  const handleFindEquivalent = async () => {
    if (!selectedArtist || !selectedGenre || !selectedArtistData) {
      setError("Please select both an artist and a target genre.");
      return;
    }

    setLoading(true);
    setResults([]);
    setError(null);
    setLoadingMessage("Finding equivalent artists...");

    // Simulate progress messages
    const progressMessages = [
      "Finding equivalent artists...",
      "Processing results with explanations...",
      "Extracting artist features...",
      "Comparing artists...",
      "Generating explanations..."
    ];

    let messageIndex = 0;
    let messageInterval: ReturnType<typeof setInterval> | null = null;
    
    messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % progressMessages.length;
      setLoadingMessage(progressMessages[messageIndex]);
    }, 1500);

    try {
      const requestBody = {
        sourceArtist: selectedArtistData.name,
        sourceGenre: selectedArtistData.genre,
        targetGenre: selectedGenre,
        includeExplanations: true
      };
      
      console.log("Calling /api/find-equivalent with:", requestBody);
      
      const response = await apiFetch("/api/find-equivalent", {
        method: "POST",
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json() as { results?: EnhancedEquivalentResult[]; error?: string };
        console.log("Response data:", data);
        console.log("First result structure:", data.results?.[0]);
        console.log("Has explanation in first result:", !!data.results?.[0]?.explanation);
        
        if (data.results && Array.isArray(data.results)) {
          if (data.results.length > 0) {
            setResults(data.results);
            // Log explanation status
            data.results.forEach((r: EnhancedEquivalentResult, idx: number) => {
              console.log(`Result ${idx + 1}: ${r.artist} - has explanation: ${!!r.explanation}, has features: ${!!r.sourceFeatures}`);
            });
          } else {
            setError("No results returned for this combination.");
          }
        } else if (data.error) {
          setError(`API Error: ${data.error}`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
        setError(`Error ${response.status}: ${errorData.error || "Failed to find equivalent artists"}`);
      }
    } catch (error) {
      console.error("Error finding equivalent artists:", error);
      setError(`Failed to find equivalent artists: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (messageInterval) {
        clearInterval(messageInterval);
      }
      setLoading(false);
      setLoadingMessage("Finding equivalent artists...");
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Find Equivalent Artists</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Find artists in different genres that are similar to each other!
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {/* Loading Progress Bar */}
      {loading && (
        <div className="w-full space-y-2">
          <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-[#F48120] rounded-full progress-bar-animation" />
          </div>
          <p className="text-sm text-muted-foreground text-center">{loadingMessage}</p>
        </div>
      )}

      {/* Selection UI: [Genre Filter] + [Artist] + [Target Genre] = [Button] */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative" ref={genreFilterDropdownRef}>
          <Label htmlFor="genre-filter" title="Filter by Genre (Optional)" />
          <input
            id="genre-filter"
            type="text"
            autoComplete="off"
            value={genreFilterSearch}
            onChange={(e) => {
              setGenreFilterSearch(e.target.value);
              setShowGenreFilterDropdown(true);
              // Clear filter if search doesn't match selected filter
              if (genreFilter && e.target.value !== genreFilter) {
                setGenreFilter("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredGenresForFilter.length === 1) {
                e.preventDefault();
                const genre = filteredGenresForFilter[0];
                setGenreFilter(genre);
                setGenreFilterSearch(genre);
                setShowGenreFilterDropdown(false);
                // Clear artist selection if it no longer matches filter
                if (selectedArtistData && selectedArtistData.genre.toLowerCase() !== genre.toLowerCase()) {
                  setSelectedArtist("");
                  setArtistSearch("");
                }
                // Auto-focus artist input
                setTimeout(() => artistInputRef.current?.focus(), 100);
              }
            }}
            onFocus={() => setShowGenreFilterDropdown(true)}
            placeholder="Filter by genre..."
            className="w-full add-size-base btn btn-secondary border border-ob-border focus:border-ob-border-active focus:outline-none px-3 rounded-md"
          />
          {showGenreFilterDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-auto">
              <button
                type="button"
                onClick={() => {
                  setGenreFilter("");
                  setGenreFilterSearch("");
                  setShowGenreFilterDropdown(false);
                  // Auto-focus artist input
                  setTimeout(() => artistInputRef.current?.focus(), 100);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  !genreFilter ? "bg-neutral-100 dark:bg-neutral-800" : ""
                }`}
              >
                <div className="font-medium">All genres</div>
              </button>
              {filteredGenresForFilter.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    setGenreFilter(genre);
                    setGenreFilterSearch(genre);
                    setShowGenreFilterDropdown(false);
                    // Clear artist selection if it no longer matches filter
                    if (selectedArtistData && selectedArtistData.genre.toLowerCase() !== genre.toLowerCase()) {
                      setSelectedArtist("");
                      setArtistSearch("");
                    }
                    // Auto-focus artist input
                    setTimeout(() => artistInputRef.current?.focus(), 100);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                    genreFilter === genre ? "bg-neutral-100 dark:bg-neutral-800" : ""
                  }`}
                >
                  <div className="font-medium">{formatGenreDisplay(genre)}</div>
                </button>
              ))}
            </div>
          )}
          {genreFilter && (
            <div className="mt-2 text-sm text-muted-foreground">
              Filter: <span className="font-medium">{formatGenreDisplay(genreFilter)}</span>
            </div>
          )}
        </div>

        <div className="text-2xl font-bold text-muted-foreground self-center">+</div>

        <div className="flex-1 w-full relative" ref={artistDropdownRef}>
          <Label htmlFor="artist-search" title="Artist" />
          <input
            id="artist-search"
            ref={artistInputRef}
            type="text"
            autoComplete="off"
            value={artistSearch}
            onChange={(e) => {
              setArtistSearch(e.target.value);
              setShowArtistDropdown(true);
              // Clear selection if search doesn't match selected artist
              if (selectedArtist && e.target.value !== selectedArtist) {
                setSelectedArtist("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredArtists.length === 1) {
                e.preventDefault();
                const artist = filteredArtists[0];
                setSelectedArtist(artist.name);
                setArtistSearch(artist.name);
                setShowArtistDropdown(false);
                // Auto-focus target genre input
                setTimeout(() => targetGenreInputRef.current?.focus(), 100);
              }
            }}
            onFocus={() => setShowArtistDropdown(true)}
            placeholder="Search or select an artist..."
            className="w-full add-size-base btn btn-secondary border border-ob-border focus:border-ob-border-active focus:outline-none px-3 rounded-md"
          />
          {showArtistDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-auto">
              {filteredArtists.length > 0 ? (
                filteredArtists.map((artist) => (
                  <button
                    key={`${artist.genre}-${artist.name}`}
                    type="button"
                    onClick={() => {
                      setSelectedArtist(artist.name);
                      setArtistSearch(artist.name);
                      setShowArtistDropdown(false);
                      // Auto-focus target genre input
                      setTimeout(() => targetGenreInputRef.current?.focus(), 100);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                      selectedArtist === artist.name ? "bg-neutral-100 dark:bg-neutral-800" : ""
                    }`}
                  >
                    <div className="font-medium">{artist.name}</div>
                    <div className="text-xs text-muted-foreground">{formatGenreDisplay(artist.genre)}</div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-muted-foreground">
                  No artists found
                </div>
              )}
            </div>
          )}
          {selectedArtist && (
            <div className="mt-2 text-sm text-muted-foreground">
              Selected: <span className="font-medium">{selectedArtist}</span>
              {selectedArtistData && (
                <span className="ml-2">({formatGenreDisplay(selectedArtistData.genre)})</span>
              )}
            </div>
          )}
        </div>

        <div className="text-2xl font-bold text-muted-foreground self-center">+</div>

        <div className="flex-1 w-full relative" ref={targetGenreDropdownRef}>
          <Label htmlFor="target-genre-search" title="Target Genre" />
          <input
            id="target-genre-search"
            ref={targetGenreInputRef}
            type="text"
            autoComplete="off"
            value={targetGenreSearch}
            onChange={(e) => {
              setTargetGenreSearch(e.target.value);
              setShowTargetGenreDropdown(true);
              // Clear selection if search doesn't match selected genre
              if (selectedGenre && e.target.value !== formatGenreDisplay(selectedGenre)) {
                setSelectedGenre("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredTargetGenres.length === 1) {
                e.preventDefault();
                const genre = filteredTargetGenres[0];
                setSelectedGenre(genre);
                setTargetGenreSearch(formatGenreDisplay(genre));
                setShowTargetGenreDropdown(false);
              }
            }}
            onFocus={() => setShowTargetGenreDropdown(true)}
            placeholder="Search or select a genre..."
            className="w-full add-size-base btn btn-secondary border border-ob-border focus:border-ob-border-active focus:outline-none px-3 rounded-md"
          />
          {showTargetGenreDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-auto">
              {filteredTargetGenres.length > 0 ? (
                filteredTargetGenres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => {
                      setSelectedGenre(genre);
                      setTargetGenreSearch(formatGenreDisplay(genre));
                      setShowTargetGenreDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                      selectedGenre === genre ? "bg-neutral-100 dark:bg-neutral-800" : ""
                    }`}
                  >
                    <div className="font-medium">{formatGenreDisplay(genre)}</div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-muted-foreground">
                  No genres found
                </div>
              )}
            </div>
          )}
          {selectedGenre && (
            <div className="mt-2 text-sm text-muted-foreground">
              Selected: <span className="font-medium">{formatGenreDisplay(selectedGenre)}</span>
            </div>
          )}
        </div>

        <div className="text-2xl font-bold text-muted-foreground self-center">=</div>

        <div className="flex flex-col">
          <Label htmlFor="find-button" title=" " className="invisible" />
          <Button
            id="find-button"
            onClick={handleFindEquivalent}
            disabled={!selectedArtist || !selectedGenre || !selectedArtistData || loading}
            className="whitespace-nowrap"
          >
            {loading ? "Finding..." : "Find Equivalent"}
          </Button>
        </div>
      </div>

      {/* Results with Explanations */}
      {results.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Top 3 Equivalent Artists</h3>
          {results.map((result, index) => (
            <div key={index} className="space-y-4">
              <Card className="p-4 bg-neutral-100 dark:bg-neutral-900">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="font-semibold text-lg">{result.artist}</div>
                    <div className="text-sm text-muted-foreground">{result.genre}</div>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground">
                    Similarity: {(result.score * 100).toFixed(1)}%
                  </div>
                </div>

                {result.explanation && selectedArtistData && (
                  <>
                    <ExplanationSummary
                      sourceArtist={selectedArtistData.name}
                      targetArtist={result.artist}
                      explanation={result.explanation}
                    />
                    
                    <div className="mt-4">
                      <ComparisonCard
                        sourceArtist={selectedArtistData.name}
                        sourceGenre={selectedArtistData.genre}
                        targetArtist={result.artist}
                        targetGenre={result.genre}
                        explanation={result.explanation}
                      />
                    </div>

                    {result.sourceFeatures && result.targetFeatures && (
                      <div className="mt-4">
                        <FeatureBreakdown
                          sourceArtist={selectedArtistData.name}
                          sourceFeatures={result.sourceFeatures}
                          targetArtist={result.artist}
                          targetFeatures={result.targetFeatures}
                          explanation={result.explanation}
                        />
                      </div>
                    )}
                  </>
                )}

                <Button
                  onClick={() => {
                    if (selectedArtistData) {
                      onGenerateSong(
                        selectedArtistData.name,
                        selectedArtistData.genre,
                        result.artist,
                        result.genre
                      );
                    }
                  }}
                  variant="primary"
                  size="md"
                  className="mt-4 w-full"
                  disabled={!selectedArtistData}
                >
                  Generate Song: {selectedArtistData?.name} writes {result.genre} in style of {result.artist}
                </Button>
              </Card>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
