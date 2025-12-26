import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats genre names for display.
 * Converts "rb" to "r&b" (case-insensitive).
 */
export function formatGenreDisplay(genre: string): string {
  if (!genre) return genre;
  return genre.toLowerCase() === "rb" ? "r&b" : genre;
}

/**
 * Fixes common artist name issues, particularly Unicode character problems.
 * This handles cases where special characters (like accents) are lost during storage/retrieval.
 */
export function fixArtistName(name: string): string {
  if (!name) return name;
  
  // Common name corrections for artists with special characters
  const nameCorrections: Record<string, string> = {
    "Beyonc": "Beyoncé",
    "beyonc": "Beyoncé",
    "BEYONC": "Beyoncé",
  };
  
  // Check for exact matches first
  if (nameCorrections[name]) {
    return nameCorrections[name];
  }
  
  // Check case-insensitive matches
  const lowerName = name.toLowerCase();
  for (const [wrong, correct] of Object.entries(nameCorrections)) {
    if (wrong.toLowerCase() === lowerName) {
      return correct;
    }
  }
  
  return name;
}
