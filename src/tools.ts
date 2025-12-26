import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";
import { findEquivalentArtists } from "./vector-utils";

const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() })
});

const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  }
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

const findEquivalentArtistsTool = tool({
  description: "Find equivalent artists across genres using vector arithmetic. Returns top 3 equivalent artists with similarity scores.",
  inputSchema: z.object({
    sourceArtist: z.string().describe("The name of the source artist"),
    sourceGenre: z.string().describe("The genre of the source artist"),
    targetGenre: z.string().describe("The target genre to find equivalent artists in")
  }),
  execute: async ({ sourceArtist, sourceGenre, targetGenre }) => {
    const { agent } = getCurrentAgent<Chat>();
    
    if (!agent?.env.ARTIST_EMBEDDINGS) {
      return {
        error: "Vectorize binding not configured",
        results: []
      };
    }
    
    try {
      const results = await findEquivalentArtists(
        agent.env.ARTIST_EMBEDDINGS,
        sourceArtist,
        sourceGenre,
        targetGenre,
        3
      );
      
      return {
        results: results.map(r => ({
          artist: r.artist,
          genre: r.genre,
          score: Math.round(r.score * 1000) / 1000
        }))
      };
    } catch (error) {
      console.error("Error finding equivalent artists:", error);
      return {
        error: error instanceof Error ? error.message : String(error),
        results: []
      };
    }
  }
});

const generateSongInStyle = tool({
  description: "Get artist documents for a source artist and target artist. Use this when the user wants to generate a song as if the source artist wrote in the style of the target artist. Returns the documents containing lyrics and features for both artists.",
  inputSchema: z.object({
    sourceArtist: z.string().describe("The name of the source artist who is writing the song"),
    sourceGenre: z.string().describe("The genre of the source artist"),
    equivalentArtist: z.string().describe("The name of the equivalent artist to write in the style of"),
    targetGenre: z.string().describe("The genre of the equivalent artist")
  }),
  execute: async ({ sourceArtist, sourceGenre, equivalentArtist, targetGenre }) => {
    const { agent } = getCurrentAgent<Chat>();
    
    if (!agent?.env.ARTIST_DOCUMENTS) {
      return {
        error: "R2 binding not configured",
        sourceDocument: "",
        targetDocument: ""
      };
    }
    
    try {
      // Fetch both artists' documents from R2
      let sourceDocument = "";
      let targetDocument = "";
      
      const r2Object = await agent.env.ARTIST_DOCUMENTS.get("artist_documents.json");
      if (r2Object) {
        const documentsData = await r2Object.json() as { artists: Array<{ genre: string; artist: string; document: string }> };
        
        // Find both artists (case-insensitive)
        const sourceData = documentsData.artists.find(
          a => a.artist.toLowerCase() === sourceArtist.toLowerCase() && 
               a.genre.toLowerCase() === sourceGenre.toLowerCase()
        );
        const targetData = documentsData.artists.find(
          a => a.artist.toLowerCase() === equivalentArtist.toLowerCase() && 
               a.genre.toLowerCase() === targetGenre.toLowerCase()
        );
        
        sourceDocument = sourceData?.document || "";
        targetDocument = targetData?.document || "";
      }
      
      return {
        sourceArtist,
        sourceGenre,
        targetArtist: equivalentArtist,
        targetGenre,
        sourceDocument,
        targetDocument,
        prompt: `Write a short song (1-2 verses and a chorus) as if ${sourceArtist} (a ${sourceGenre} artist) wrote a ${targetGenre} song in the style of ${equivalentArtist}. The song should blend ${sourceArtist}'s artistic voice with ${equivalentArtist}'s ${targetGenre} style.`
      };
    } catch (error) {
      console.error("Error fetching artist documents:", error);
      return {
        error: error instanceof Error ? error.message : String(error),
        sourceDocument: "",
        targetDocument: ""
      };
    }
  }
});

export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  findEquivalentArtists: findEquivalentArtistsTool,
  generateSongInStyle
} satisfies ToolSet;

export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  }
};
