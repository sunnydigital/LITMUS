/**
 * lib/sheets.ts — Google Sheets integration for LITMUS
 *
 * Pushes findings and narrative report to a Google Spreadsheet.
 * Uses service account credentials from GOOGLE_SHEETS_CREDENTIALS env var.
 * Gracefully skips if no credentials are configured.
 */

interface Finding {
  hypothesis: string;
  grade: string;
  surprise_score: number;
  p_value: number;
  effect_size: number;
  checks: Array<{ name: string; result: string; reason: string }>;
  interpretation: string;
}

export interface SheetsResult {
  url: string;
  spreadsheetId: string;
}

/**
 * Push findings and report to Google Sheets.
 * Returns the sheet URL on success, or null if not configured / on error.
 */
export async function pushToGoogleSheets(
  findings: Finding[],
  reportSummary: string,
): Promise<SheetsResult | null> {
  // Check for credentials
  const credsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!credsJson) {
    return null; // Silently skip — no credentials configured
  }

  try {
    const { google } = await import("googleapis");

    // Parse service account credentials
    let credentials: Record<string, string>;
    try {
      credentials = JSON.parse(credsJson);
    } catch {
      console.error("[LITMUS] Invalid GOOGLE_SHEETS_CREDENTIALS JSON");
      return null;
    }

    // Authenticate with Google
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
      ],
    });

    const sheetsClient = google.sheets({ version: "v4", auth });
    const driveClient = google.drive({ version: "v3", auth });

    // Create or use existing spreadsheet
    let spreadsheetId = process.env.GOOGLE_SHEET_ID || "";

    if (!spreadsheetId) {
      // Create a new spreadsheet
      const timestamp = new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const createResponse = await sheetsClient.spreadsheets.create({
        requestBody: {
          properties: { title: `LITMUS Discovery — ${timestamp}` },
          sheets: [
            { properties: { title: "Findings", sheetId: 0, index: 0 } },
            { properties: { title: "Report", sheetId: 1, index: 1 } },
          ],
        },
      });

      spreadsheetId = createResponse.data.spreadsheetId!;

      // Make it accessible (anyone with link can view)
      try {
        await driveClient.permissions.create({
          fileId: spreadsheetId,
          requestBody: { role: "reader", type: "anyone" },
        });
      } catch {
        // Permission setting may fail in some setups; continue anyway
      }
    } else {
      // Clear existing sheets before writing
      try {
        await sheetsClient.spreadsheets.values.clear({
          spreadsheetId,
          range: "Findings!A:Z",
        });
        await sheetsClient.spreadsheets.values.clear({
          spreadsheetId,
          range: "Report!A:Z",
        });
      } catch {
        // Sheet might not exist yet; ignore
      }
    }

    // Sort findings by surprise score
    const sorted = [...findings].sort((a, b) => (b.surprise_score ?? 0) - (a.surprise_score ?? 0));

    // --- Sheet 1: Findings ---
    const findingsHeader = [
      "Rank",
      "Finding",
      "Grade",
      "Surprise Score",
      "P-Value",
      "Effect Size",
      "Checks Passed",
      "Checks Failed",
      "Interpretation",
    ];

    const findingsRows = sorted.map((f, i) => {
      const passed = (f.checks || []).filter((c) => c.result === "PASS").map((c) => c.name).join(", ");
      const failed = (f.checks || []).filter((c) => c.result === "FAIL").map((c) => c.name).join(", ");
      return [
        i + 1,
        f.hypothesis,
        f.grade,
        f.surprise_score?.toFixed(3) ?? "",
        f.p_value?.toFixed(4) ?? "",
        f.effect_size?.toFixed(3) ?? "",
        passed,
        failed,
        f.interpretation,
      ];
    });

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: "Findings!A1",
      valueInputOption: "RAW",
      requestBody: { values: [findingsHeader, ...findingsRows] },
    });

    // Apply bold formatting to header row
    try {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat.bold",
              },
            },
          ],
        },
      });
    } catch {
      // Non-critical formatting — ignore errors
    }

    // --- Sheet 2: Report ---
    const reportRows: string[][] = [];
    reportRows.push(["LITMUS Discovery Report"]);
    reportRows.push([`Generated: ${new Date().toLocaleString()}`]);
    reportRows.push([""]);

    // Split report into rows
    const reportLines = reportSummary.split("\n");
    for (const line of reportLines) {
      reportRows.push([line]);
    }

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: "Report!A1",
      valueInputOption: "RAW",
      requestBody: { values: reportRows },
    });

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return { url, spreadsheetId };
  } catch (err) {
    console.error("[LITMUS] Google Sheets push failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
