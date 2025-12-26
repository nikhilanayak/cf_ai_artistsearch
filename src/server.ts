import { routeAgentRequest, type Schedule } from "agents";

import { getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

export class Chat extends AIChatAgent<Env> {
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    let mcpTools = {};
    try {
      if (this.mcp && typeof this.mcp.getAITools === 'function') {
        const tools = this.mcp.getAITools();
        if (tools && typeof tools === 'object') {
          mcpTools = tools;
        }
      }
    } catch (error) {
      // MCP tools are optional
    }
    
    const allTools = {
      ...tools,
      ...mcpTools
    };

    const workersai = createWorkersAI({ binding: this.env.AI });
    const model = workersai("@cf/meta/llama-3.1-70b-instruct");

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const cleanedMessages = cleanupMessages(this.messages);

        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        const result = streamText({
          system: `You are a helpful assistant that can do various tasks. 

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.

When generating songs using the generateSongInStyle tool:
- The tool will return artist documents containing lyrics and features for both the source and target artists
- Use these documents to understand each artist's style, themes, and musical characteristics
- Generate a short song (1-2 verses and a chorus) that blends the source artist's artistic voice with the target artist's style
- Use material refernces from the source artist's documents, but use the target artist's style to create the structure and overall style of the songs
- Do NOT write about being a rapper, singer, etc. or about the genres of the artists in the songs
- CRITICAL: Use actual newline characters (\\n) to separate each line of lyrics. Each line should be on its own line.
- Format verses and chorus with blank lines between them (double newlines)
- Return only the lyrics text as plain text, with proper line breaks between verses and chorus
- Do not return JSON or additional formatting - just the song lyrics
- Do not include any instructions or explanations in your response - only the lyrics
- Example format:
  [Verse 1]
  Line one of verse
  Line two of verse
  
  [Chorus]
  Line one of chorus
  Line two of chorus
`,

          messages: await convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

async function checkPasscode(request: Request, env: Env): Promise<Response | null> {
  const expectedPasscode = env.APP_PASSCODE;
  if (!expectedPasscode) {
    // If no passcode is set, allow access (for development)
    return null;
  }

  // For validate-passcode endpoint, skip validation
  if (request.url.includes("/api/validate-passcode")) {
    return null;
  }

  // Check for passcode in X-Passcode header
  const passcode = request.headers.get("X-Passcode");
  if (passcode && passcode === expectedPasscode) {
    return null; // Passcode is valid
  }

  // If no passcode header found, deny access
  return new Response(
    JSON.stringify({ error: "Invalid or missing passcode" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Validate passcode for all API routes except the validation endpoint
    if (url.pathname.startsWith("/api/") && url.pathname !== "/api/validate-passcode") {
      const passcodeCheck = await checkPasscode(request, env);
      if (passcodeCheck) {
        return passcodeCheck;
      }
    }

    if (url.pathname === "/api/validate-passcode" && request.method === "POST") {
      try {
        const body = await request.json<{ passcode?: string }>();
        const expectedPasscode = env.APP_PASSCODE;
        
        if (!expectedPasscode) {
          // If no passcode is set, allow access
          return Response.json({ valid: true });
        }

        if (body.passcode && body.passcode === expectedPasscode) {
          return Response.json({ valid: true });
        } else {
          return Response.json({ valid: false }, { status: 401 });
        }
      } catch (error) {
        return Response.json({ valid: false, error: "Invalid request" }, { status: 400 });
      }
    }

    if (url.pathname === "/api/embeddings/generate" && request.method === "POST") {
      try {
        const body = await request.json<{ 
          objectKey?: string;
          startIndex?: number;
          batchSize?: number;
        }>();
        
        if (!env.AI) {
          return Response.json({ error: "AI binding not configured" }, { status: 500 });
        }

        if (!env.ARTIST_DOCUMENTS) {
          return Response.json({ error: "R2 binding not configured" }, { status: 500 });
        }

        const objectKey = body.objectKey || "artist_documents.json";
        const startIndex = body.startIndex || 0;
        const batchSize = body.batchSize || 5;

        console.log(`Loading documents from R2: ${objectKey}, starting at index ${startIndex}, batch size ${batchSize}`);

        const r2Object = await env.ARTIST_DOCUMENTS.get(objectKey);
        if (!r2Object) {
          return Response.json({ error: `Object ${objectKey} not found in R2` }, { status: 404 });
        }

        const documentsData = await r2Object.json() as { artists: Array<{ genre: string; artist: string; document: string }> };
        const allArtists = documentsData.artists || [];
        
        const endIndex = Math.min(startIndex + batchSize, allArtists.length);
        const batch = allArtists.slice(startIndex, endIndex);

        if (batch.length === 0) {
          return Response.json({ 
            embeddings: [],
            count: 0,
            nextIndex: null,
            done: true
          });
        }

        console.log(`Processing batch: ${startIndex} to ${endIndex} (${batch.length} documents)...`);

        const embeddingArray: number[][] = [];
        
        for (let i = 0; i < batch.length; i++) {
          const artist = batch[i];
          const text = artist.document?.trim();
          
          if (!text) {
            console.warn(`Skipping artist ${i + 1}: no document text`);
            embeddingArray.push(new Array(1024).fill(0));
            continue;
          }
          
          try {
            console.log(`Processing ${startIndex + i + 1}/${allArtists.length}: ${artist.artist} (${artist.genre})...`);
            
            const embeddingPromise = env.AI.run("@cf/baai/bge-large-en-v1.5", {
              text: text
            });
            
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("Timeout")), 20000);
            });
            
            const embeddingsResponse = await Promise.race([embeddingPromise, timeoutPromise]) as any;
            
            let embedding: number[] | null = null;
            
            if (embeddingsResponse.data) {
              if (Array.isArray(embeddingsResponse.data)) {
                const firstItem = embeddingsResponse.data[0];
                if (firstItem instanceof Float32Array) {
                  embedding = Array.from(firstItem);
                } else if (Array.isArray(firstItem)) {
                  embedding = firstItem.map((v: any) => typeof v === 'number' ? v : Number(v));
                }
              } else if (embeddingsResponse.data instanceof Float32Array) {
                embedding = Array.from(embeddingsResponse.data);
              }
            } else if (Array.isArray(embeddingsResponse)) {
              const firstItem = embeddingsResponse[0];
              if (firstItem instanceof Float32Array) {
                embedding = Array.from(firstItem);
              } else if (Array.isArray(firstItem)) {
                embedding = firstItem.map((v: any) => typeof v === 'number' ? v : Number(v));
              }
            } else if (embeddingsResponse.shape && embeddingsResponse.data) {
              const shape = embeddingsResponse.shape;
              const data = embeddingsResponse.data;
              const dims = shape[1] || 1024;
              
              if (data instanceof Float32Array) {
                embedding = Array.from(data.slice(0, dims));
              } else if (Array.isArray(data)) {
                embedding = data.slice(0, dims).map((v: any) => typeof v === 'number' ? v : Number(v));
              }
            }
            
            if (!embedding || embedding.length === 0) {
              console.error(`Failed to extract embedding. Response keys:`, Object.keys(embeddingsResponse));
              embeddingArray.push(new Array(1024).fill(0));
              continue;
            }
            
            if (embedding.length !== 1024) {
              if (embedding.length > 1024) {
                embedding = embedding.slice(0, 1024);
              } else {
                embedding = [...embedding, ...new Array(1024 - embedding.length).fill(0)];
              }
            }
            
            embeddingArray.push(embedding);
            console.log(`✓ Generated embedding ${startIndex + i + 1}/${allArtists.length}`);
            
          } catch (error) {
            console.error(`Error for ${artist.artist}:`, error);
            embeddingArray.push(new Array(1024).fill(0));
          }
        }

        const nextIndex = endIndex < allArtists.length ? endIndex : null;

        return Response.json({
          embeddings: embeddingArray,
          count: embeddingArray.length,
          nextIndex: nextIndex,
          done: nextIndex === null,
          artists: batch.map(a => ({ genre: a.genre, artist: a.artist }))
        });
      } catch (error) {
        console.error("Error generating embeddings:", error);
        return Response.json({ 
          error: "Failed to generate embeddings", 
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }
    }

    if (url.pathname === "/api/analyze-artist" && request.method === "POST") {
      try {
        const body = await request.json<{
          artist: string;
          genre: string;
        }>();

        if (!env.AI) {
          return Response.json({ error: "AI binding not configured" }, { status: 500 });
        }

        if (!env.ARTIST_DOCUMENTS) {
          return Response.json({ error: "R2 binding not configured" }, { status: 500 });
        }

        // Load artist documents from R2
        const r2Object = await env.ARTIST_DOCUMENTS.get("artist_documents.json");
        if (!r2Object) {
          return Response.json({ error: "Artist documents not found in R2" }, { status: 404 });
        }

        const documentsData = await r2Object.json() as { artists: Array<{ genre: string; artist: string; document: string }> };
        const artistData = documentsData.artists.find(
          a => a.artist === body.artist && a.genre === body.genre
        );

        if (!artistData) {
          return Response.json({ error: `Artist ${body.artist} not found in genre ${body.genre}` }, { status: 404 });
        }

        const { extractArtistFeatures } = await import("./feature-extractor");
        const features = await extractArtistFeatures(
          env.AI,
          artistData.document,
          body.artist,
          body.genre
        );

        return Response.json({
          artist: body.artist,
          genre: body.genre,
          features
        });
      } catch (error) {
        console.error("Error analyzing artist:", error);
        return Response.json(
          {
            error: error instanceof Error ? error.message : String(error),
            features: null
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/api/compare-artists" && request.method === "POST") {
      try {
        const body = await request.json<{
          sourceArtist: string;
          sourceGenre: string;
          targetArtist: string;
          targetGenre: string;
          vectorSimilarity: number;
        }>();

        if (!env.AI) {
          return Response.json({ error: "AI binding not configured" }, { status: 500 });
        }

        if (!env.ARTIST_DOCUMENTS) {
          return Response.json({ error: "R2 binding not configured" }, { status: 500 });
        }

        // Load artist documents from R2
        const r2Object = await env.ARTIST_DOCUMENTS.get("artist_documents.json");
        if (!r2Object) {
          return Response.json({ error: "Artist documents not found in R2" }, { status: 404 });
        }

        const documentsData = await r2Object.json() as { artists: Array<{ genre: string; artist: string; document: string }> };
        
        const sourceData = documentsData.artists.find(
          a => a.artist === body.sourceArtist && a.genre === body.sourceGenre
        );
        const targetData = documentsData.artists.find(
          a => a.artist === body.targetArtist && a.genre === body.targetGenre
        );

        if (!sourceData) {
          return Response.json({ error: `Source artist ${body.sourceArtist} not found` }, { status: 404 });
        }
        if (!targetData) {
          return Response.json({ error: `Target artist ${body.targetArtist} not found` }, { status: 404 });
        }

        const { extractArtistFeatures } = await import("./feature-extractor");
        const sourceFeatures = await extractArtistFeatures(
          env.AI,
          sourceData.document,
          body.sourceArtist,
          body.sourceGenre
        );
        const targetFeatures = await extractArtistFeatures(
          env.AI,
          targetData.document,
          body.targetArtist,
          body.targetGenre
        );

        const { compareArtists } = await import("./comparison-engine");
        const comparison = await compareArtists(
          env.AI,
          body.sourceArtist,
          body.sourceGenre,
          sourceFeatures,
          body.targetArtist,
          body.targetGenre,
          targetFeatures,
          body.vectorSimilarity
        );

        return Response.json({
          comparison,
          sourceFeatures,
          targetFeatures
        });
      } catch (error) {
        console.error("Error comparing artists:", error);
        return Response.json(
          {
            error: error instanceof Error ? error.message : String(error),
            comparison: null
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/api/find-equivalent" && request.method === "POST") {
      try {
        const body = await request.json<{
          sourceArtist: string;
          sourceGenre: string;
          targetGenre: string;
          includeExplanations?: boolean;
        }>();

        if (!env.ARTIST_EMBEDDINGS) {
          return Response.json({ error: "Vectorize binding not configured" }, { status: 500 });
        }

        console.log(`Finding equivalent for ${body.sourceArtist} (${body.sourceGenre}) in ${body.targetGenre}`);
        
        const { findEquivalentArtists } = await import("./vector-utils");
        const results = await findEquivalentArtists(
          env.ARTIST_EMBEDDINGS,
          body.sourceArtist,
          body.sourceGenre,
          body.targetGenre,
          3
        );

        console.log(`Found ${results.length} equivalent artists`);

        if (body.includeExplanations && env.AI && env.ARTIST_DOCUMENTS) {
          console.log("Explanations requested, loading documents from R2...");
          try {
            const r2Object = await env.ARTIST_DOCUMENTS.get("artist_documents.json");
            if (!r2Object) {
              console.warn("R2 object not found - artist_documents.json missing");
              // Fall through to return basic results
            } else {
              console.log("R2 object found, parsing documents...");
              const documentsData = await r2Object.json() as { artists: Array<{ genre: string; artist: string; document: string }> };
              console.log(`Loaded ${documentsData.artists.length} artist documents from R2`);
              
              const sourceData = documentsData.artists.find(
                a => a.artist.toLowerCase() === body.sourceArtist.toLowerCase() && 
                     a.genre.toLowerCase() === body.sourceGenre.toLowerCase()
              );

              if (sourceData) {
                console.log(`Found source artist data for ${body.sourceArtist}`);
                const { extractArtistFeatures } = await import("./feature-extractor");
                const { compareArtists } = await import("./comparison-engine");

                console.log("Extracting source features...");
                const sourceFeatures = await extractArtistFeatures(
                  env.AI,
                  sourceData.document,
                  body.sourceArtist,
                  body.sourceGenre
                );
                console.log("Source features extracted:", Object.keys(sourceFeatures));

                console.log("Processing results with explanations...");
                const enhancedResults = await Promise.all(
                  results.map(async (result, idx) => {
                    try {
                      console.log(`Processing result ${idx + 1}/${results.length}: ${result.artist}`);
                      const targetData = documentsData.artists.find(
                        a => a.artist.toLowerCase() === result.artist.toLowerCase() && 
                             a.genre.toLowerCase() === result.genre.toLowerCase()
                      );

                      if (targetData) {
                        console.log(`Found target data for ${result.artist}, extracting features...`);
                        const targetFeatures = await extractArtistFeatures(
                          env.AI,
                          targetData.document,
                          result.artist,
                          result.genre
                        );
                        console.log(`Target features extracted for ${result.artist}`);

                        console.log(`Comparing ${body.sourceArtist} with ${result.artist}...`);
                        const comparison = await compareArtists(
                          env.AI,
                          body.sourceArtist,
                          body.sourceGenre,
                          sourceFeatures,
                          result.artist,
                          result.genre,
                          targetFeatures,
                          result.score
                        );
                        console.log(`Comparison complete for ${result.artist}`);

                        return {
                          artist: result.artist,
                          genre: result.genre,
                          score: Math.round(result.score * 1000) / 1000,
                          explanation: comparison,
                          sourceFeatures,
                          targetFeatures
                        };
                      } else {
                        console.warn(`Target data not found for ${result.artist} in ${result.genre}`);
                      }
                    } catch (error) {
                      console.error(`Error getting explanation for ${result.artist}:`, error);
                    }

                    return {
                      artist: result.artist,
                      genre: result.genre,
                      score: Math.round(result.score * 1000) / 1000,
                      explanation: null
                    };
                  })
                );

                console.log(`Returning ${enhancedResults.length} results with explanations`);
                return Response.json({
                  results: enhancedResults
                });
              } else {
                console.warn(`Source artist data not found for ${body.sourceArtist} in ${body.sourceGenre}`);
                console.log("Available artists in source genre:", 
                  documentsData.artists
                    .filter(a => a.genre.toLowerCase() === body.sourceGenre.toLowerCase())
                    .map(a => a.artist)
                    .slice(0, 10)
                );
              }
            }
          } catch (r2Error) {
            console.error("Error loading from R2:", r2Error);
            // Fall through to return basic results
          }
        } else {
          console.log("Explanations not requested or AI/R2 not configured");
          if (!env.AI) console.warn("AI binding not configured");
          if (!env.ARTIST_DOCUMENTS) console.warn("R2 binding not configured");
        }

        return Response.json({
          results: results.map((r) => ({
            artist: r.artist,
            genre: r.genre,
            score: Math.round(r.score * 1000) / 1000
          }))
        });
      } catch (error) {
        console.error("Error finding equivalent artists:", error);
        return Response.json(
          {
            error: error instanceof Error ? error.message : String(error),
            results: []
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/api/generate-song" && request.method === "POST") {
      try {
        const body = await request.json<{
          equivalentArtist: string;
          targetGenre: string;
        }>();

        if (!env.AI) {
          return Response.json({ error: "AI binding not configured" }, { status: 500 });
        }

        const prompt = `Write a short song (1-2 verses and a chorus) in the style of ${body.equivalentArtist}, a ${body.targetGenre} artist. Return only the lyrics text, no additional formatting.`;

        const response = await env.AI.run("@cf/meta/llama-3.1-70b-instruct", {
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        });

        let songText = "";
        if (response.response) {
          songText = response.response;
        } else if (typeof response === "string") {
          songText = response;
        } else if (response.choices && response.choices[0] && response.choices[0].message) {
          songText = response.choices[0].message.content || "";
        }

        return Response.json({
          song: songText.trim(),
          artist: body.equivalentArtist,
          genre: body.targetGenre
        });
      } catch (error) {
        console.error("Error generating song:", error);
        return Response.json(
          {
            error: error instanceof Error ? error.message : String(error),
            song: ""
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/api/artists" && request.method === "GET") {
      try {
        if (!env.ARTIST_EMBEDDINGS) {
          return Response.json({ error: "Vectorize binding not configured" }, { status: 500 });
        }

        const artistsSet = new Set<string>();
        const genresSet = new Set<string>();
        const artists: Array<{ name: string; genre: string }> = [];
        
        for (let i = 0; i < 3; i++) {
          const queryVector = Array.from({ length: 1024 }, () => (Math.random() - 0.5) * 0.01);
          
          const queryResult = await env.ARTIST_EMBEDDINGS.query(queryVector, {
            topK: 50,
            returnMetadata: true,
            returnValues: false
          });

          for (const match of queryResult.matches || []) {
            const metadata = match.metadata as { genre?: string; artist?: string; type?: string };
            if (metadata.type === "artist" && metadata.artist && metadata.genre) {
              const key = `${metadata.genre}|${metadata.artist}`;
              if (!artistsSet.has(key)) {
                artistsSet.add(key);
                genresSet.add(metadata.genre);
                artists.push({
                  name: metadata.artist,
                  genre: metadata.genre
                });
              }
            }
          }
        }

        return Response.json({
          artists: artists.sort((a, b) => {
            if (a.genre !== b.genre) return a.genre.localeCompare(b.genre);
            return a.name.localeCompare(b.name);
          }),
          genres: Array.from(genresSet).sort()
        });
      } catch (error) {
        console.error("Error fetching artists:", error);
        return Response.json({
          artists: [],
          genres: [],
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (url.pathname === "/api/get-artist-documents" && request.method === "POST") {
      try {
        const body = await request.json<{
          sourceArtist: string;
          sourceGenre: string;
          targetArtist: string;
          targetGenre: string;
        }>();

        if (!env.ARTIST_DOCUMENTS) {
          return Response.json({ error: "R2 binding not configured" }, { status: 500 });
        }

        // Load artist documents from R2
        const r2Object = await env.ARTIST_DOCUMENTS.get("artist_documents.json");
        if (!r2Object) {
          return Response.json({ 
            sourceDocument: "",
            targetDocument: "",
            error: "Artist documents not found in R2"
          });
        }

        const documentsData = await r2Object.json() as { artists: Array<{ genre: string; artist: string; document: string }> };
        
        const sourceData = documentsData.artists.find(
          a => a.artist.toLowerCase() === body.sourceArtist.toLowerCase() && 
               a.genre.toLowerCase() === body.sourceGenre.toLowerCase()
        );
        const targetData = documentsData.artists.find(
          a => a.artist.toLowerCase() === body.targetArtist.toLowerCase() && 
               a.genre.toLowerCase() === body.targetGenre.toLowerCase()
        );

        return Response.json({
          sourceDocument: sourceData?.document || "",
          targetDocument: targetData?.document || "",
          sourceArtist: body.sourceArtist,
          sourceGenre: body.sourceGenre,
          targetArtist: body.targetArtist,
          targetGenre: body.targetGenre
        });
      } catch (error) {
        console.error("Error getting artist documents:", error);
        return Response.json(
          {
            sourceDocument: "",
            targetDocument: "",
            error: error instanceof Error ? error.message : String(error)
          },
          { status: 500 }
        );
      }
    }

    if (url.pathname === "/check-open-ai-key") {
      return Response.json({
        success: true,
        message: "Using Workers AI instead of OpenAI"
      });
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
