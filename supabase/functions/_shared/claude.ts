// Shared Anthropic Claude streaming helper.
// Converts Anthropic's SSE event stream into OpenAI-style chat-completion SSE chunks
// so existing client streaming code (used by dataset-search) keeps working unchanged.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type ClaudeMessage = { role: "user" | "assistant"; content: string };

export interface ClaudeStreamOptions {
  model?: string;
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * Calls Anthropic Messages API with stream=true and returns a ReadableStream
 * formatted as OpenAI chat-completion SSE chunks (`data: { choices:[{delta:{content}}] }`).
 * Throws on non-2xx; caller should map 429/402 if desired.
 */
export async function streamClaudeAsOpenAISSE(opts: ClaudeStreamOptions): Promise<Response> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? "claude-sonnet-4-20250514",
      system: opts.system,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.3,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.text().catch(() => "");
    const err = new Error(`Anthropic error ${upstream.status}: ${body}`) as Error & { status?: number };
    err.status = upstream.status;
    throw err;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const out = new ReadableStream({
    async start(controller) {
      let buf = "";
      const emit = (text: string) => {
        const chunk = { choices: [{ delta: { content: text } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const raw = buf.slice(0, nl).replace(/\r$/, "");
            buf = buf.slice(nl + 1);
            if (!raw.startsWith("data: ")) continue;
            const json = raw.slice(6).trim();
            if (!json) continue;
            try {
              const evt = JSON.parse(json);
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                emit(evt.delta.text as string);
              } else if (evt.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // ignore parse errors on partial frames
            }
          }
        }
      } catch (e) {
        console.error("Claude stream error:", e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(out, { headers: { "Content-Type": "text/event-stream" } });
}

/** Non-streaming JSON helper — returns the assistant text. */
export async function callClaude(opts: ClaudeStreamOptions): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? "claude-sonnet-4-20250514",
      system: opts.system,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.2,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    const err = new Error(`Anthropic error ${resp.status}: ${body}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const text = data?.content?.[0]?.text ?? "";
  return typeof text === "string" ? text : "";
}