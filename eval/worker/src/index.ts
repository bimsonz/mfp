// POST /run {model, input} → {ok, ms, output} or {ok: false, ms, error}.
// The harness builds every request and scores every response; this Worker
// only carries one inference across the AI binding.

interface Env {
  AI: { run(model: string, input: unknown): Promise<unknown> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/run")
      return new Response("POST /run {model, input}", { status: 404 });
    const { model, input } = (await request.json()) as { model: string; input: unknown };
    const started = Date.now();
    try {
      const output = await env.AI.run(model, input);
      return Response.json({ ok: true, ms: Date.now() - started, output });
    } catch (e) {
      // The first line only: under wrangler dev the rest is a stack trace with local paths.
      const error = (e instanceof Error ? e.message : String(e)).split("\n")[0];
      return Response.json({ ok: false, ms: Date.now() - started, error });
    }
  },
};
