import { NextRequest } from "next/server";

/**
 * POST /api/export/pdf
 *
 * Accepts report markdown + findings JSON.
 * Returns a styled HTML document (dark theme) as a downloadable file.
 * Uses HTML instead of PDF to avoid puppeteer dependency — suitable for hackathon demo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const report: string = body.report || "";
    const findings: Array<{
      hypothesis: string;
      grade: string;
      surprise_score: number;
      p_value: number;
      effect_size: number;
      checks: Array<{ name: string; result: string; reason: string }>;
      interpretation: string;
    }> = body.findings || [];

    const sorted = [...findings].sort((a, b) => (b.surprise_score ?? 0) - (a.surprise_score ?? 0));

    const timestamp = new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    function esc(str: string): string {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function markdownToHtml(md: string): string {
      return md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        .replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`)
        .replace(/\n\n/g, "</p><p>")
        .replace(/^/, "<p>")
        .replace(/$/, "</p>");
    }

    function gradeColor(grade: string): string {
      if (grade === "A") return "#4ade80";
      if (grade === "B") return "#facc15";
      return "#f87171";
    }

    function pColor(p: number): string {
      if (p < 0.01) return "#4ade80";
      if (p < 0.05) return "#facc15";
      return "#f87171";
    }

    const findingsTableRows = sorted
      .map((f, i) => {
        const passedChecks = (f.checks || []).filter((c) => c.result === "PASS");
        const failedChecks = (f.checks || []).filter((c) => c.result === "FAIL");
        return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #27272a;text-align:center;color:#a1a1aa;font-size:14px;">${i + 1}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #27272a;color:#e4e4e7;font-size:13px;">${esc(f.hypothesis)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #27272a;text-align:center;">
            <span style="font-weight:700;font-size:18px;color:${gradeColor(f.grade)};">${esc(f.grade)}</span>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #27272a;text-align:center;color:#a78bfa;font-size:13px;">${(f.surprise_score ?? 0).toFixed(2)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #27272a;text-align:center;color:${pColor(f.p_value ?? 1)};font-size:13px;font-family:monospace;">${(f.p_value ?? 1).toFixed(4)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #27272a;text-align:center;color:#e4e4e7;font-size:13px;font-family:monospace;">${(f.effect_size ?? 0).toFixed(3)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #27272a;font-size:12px;">
            ${passedChecks.map(c => `<span style="background:#14532d;color:#4ade80;border-radius:4px;padding:2px 6px;margin:2px;display:inline-block;">${esc(c.name)}</span>`).join("")}
            ${failedChecks.map(c => `<span style="background:#450a0a;color:#f87171;border-radius:4px;padding:2px 6px;margin:2px;display:inline-block;">${esc(c.name)}</span>`).join("")}
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #27272a;color:#a1a1aa;font-size:12px;">${esc(f.interpretation)}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LITMUS Discovery Report — ${timestamp}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #09090b;
      color: #e4e4e7;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      min-height: 100vh;
    }
    .page { max-width: 1200px; margin: 0 auto; padding: 48px 32px; }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 48px;
      padding-bottom: 32px;
      border-bottom: 2px solid #3f3f46;
    }
    .logo {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -1px;
      background: linear-gradient(135deg, #818cf8, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .logo-sub {
      font-size: 13px;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .header-meta {
      margin-left: auto;
      text-align: right;
      color: #71717a;
      font-size: 13px;
    }

    /* Section headers */
    h2.section-title {
      font-size: 20px;
      font-weight: 600;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 24px;
      padding-bottom: 8px;
      border-bottom: 1px solid #27272a;
    }

    /* Report prose */
    .report-body {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 48px;
    }
    .report-body h1 { font-size: 24px; color: #e4e4e7; margin: 24px 0 12px; }
    .report-body h2 { font-size: 20px; color: #d4d4d8; margin: 20px 0 10px; }
    .report-body h3 { font-size: 16px; color: #a1a1aa; margin: 16px 0 8px; }
    .report-body p { color: #a1a1aa; margin: 10px 0; font-size: 15px; }
    .report-body ul { padding-left: 20px; color: #a1a1aa; font-size: 15px; }
    .report-body li { margin: 4px 0; }
    .report-body strong { color: #e4e4e7; }

    /* Findings table */
    .findings-section { margin-bottom: 48px; }
    .findings-table {
      width: 100%;
      border-collapse: collapse;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      overflow: hidden;
    }
    .findings-table th {
      background: #27272a;
      color: #71717a;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 12px 16px;
      text-align: left;
    }
    .findings-table tr:hover td { background: #1f1f23; }

    /* Stats summary */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 48px;
    }
    .stat-card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
    }
    .stat-value { font-size: 32px; font-weight: 700; color: #818cf8; }
    .stat-label { font-size: 12px; color: #71717a; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }

    /* Footer */
    .footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid #27272a;
      color: #52525b;
      font-size: 12px;
      text-align: center;
    }

    @media print {
      body { background: white; color: black; }
      .header { border-color: #ccc; }
      .report-body, .findings-table, .stat-card { background: #f9f9f9; border-color: #ddd; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="logo">LITMUS</div>
        <div class="logo-sub">Autonomous Data Discovery</div>
      </div>
      <div class="header-meta">
        <div>Generated: ${timestamp}</div>
        <div style="margin-top:4px;color:#52525b;">EmpireHacks 2026 — Track 1: The Operator</div>
      </div>
    </div>

    <!-- Summary Stats -->
    <h2 class="section-title">Summary</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${sorted.length}</div>
        <div class="stat-label">Total Findings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#4ade80;">${sorted.filter(f => f.grade === "A").length}</div>
        <div class="stat-label">Grade A Findings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#facc15;">${sorted.filter(f => f.grade === "B").length}</div>
        <div class="stat-label">Grade B Findings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:#f87171;">${sorted.filter(f => f.p_value < 0.05).length}</div>
        <div class="stat-label">p &lt; 0.05</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${sorted.length > 0 ? (sorted.reduce((s, f) => s + (f.surprise_score ?? 0), 0) / sorted.length).toFixed(2) : "—"}</div>
        <div class="stat-label">Avg Surprise Score</div>
      </div>
    </div>

    <!-- Narrated Report -->
    ${report ? `
    <h2 class="section-title">Discovery Report</h2>
    <div class="report-body">
      ${markdownToHtml(report)}
    </div>
    ` : ""}

    <!-- Findings Table -->
    <div class="findings-section">
      <h2 class="section-title">Findings Detail</h2>
      <table class="findings-table">
        <thead>
          <tr>
            <th style="text-align:center;">Rank</th>
            <th>Finding</th>
            <th style="text-align:center;">Grade</th>
            <th style="text-align:center;">Surprise</th>
            <th style="text-align:center;">P-Value</th>
            <th style="text-align:center;">Effect Size</th>
            <th>Checks</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          ${findingsTableRows || `<tr><td colspan="8" style="padding:24px;text-align:center;color:#52525b;">No findings data provided</td></tr>`}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>LITMUS — Autonomous Statistical Discovery Engine &nbsp;·&nbsp; EmpireHacks 2026</p>
      <p style="margin-top:4px;">All statistical tests computed in-browser. FDR correction via Benjamini-Hochberg. Effect sizes via Cohen's d.</p>
    </div>
  </div>
</body>
</html>`;

    const fileTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `litmus-report-${fileTimestamp}.html`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
