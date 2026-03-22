import { NextRequest } from "next/server";

const BACKEND = "http://localhost:3000";

export async function POST(req: NextRequest) {
  const body = await req.formData();

  const upstream = await fetch(`${BACKEND}/api/discover`, {
    method: "POST",
    body,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: `Backend ${upstream.status}` }), {
      status: upstream.status,
    });
  }

  // Stream SSE directly — no buffering
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
