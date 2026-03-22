import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const upstream = await fetch("http://localhost:3000/api/export/csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const blob = await upstream.arrayBuffer();
  return new Response(blob, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "text/csv",
      "Content-Disposition": upstream.headers.get("Content-Disposition") || "attachment",
    },
  });
}
