import type { sheets_v4 } from "googleapis";

/**
 * Applies GBH brand formatting to the backup Google Sheet.
 * Navy background (#000d1a), gold headers (#CE9C5C), Inter font.
 *
 * Only runs formatting if the sheet hasn't been formatted yet
 * (checks for a custom "GBH_FORMATTED" developer metadata key).
 */

// Brand colors (RGB 0–1)
const navy = { red: 0, green: 0.05, blue: 0.1 };
const darkNavy = { red: 0, green: 0.03, blue: 0.07 };
const gold = { red: 0.808, green: 0.612, blue: 0.361 };
const softWhite = { red: 0.9, green: 0.9, blue: 0.92 };
const bgAlt = { red: 0.02, green: 0.07, blue: 0.13 };

interface SheetConfig {
  name: string;
  headerRow: number; // 0-indexed
  cols: number;
  colWidths: number[];
}

const SHEET_CONFIGS: SheetConfig[] = [
  {
    name: "Member Investments",
    headerRow: 2,
    cols: 7,
    colWidths: [180, 220, 200, 130, 130, 130, 130],
  },
  {
    name: "Portfolio Holdings",
    headerRow: 2,
    cols: 9,
    colWidths: [80, 200, 80, 100, 120, 120, 120, 120, 70],
  },
  {
    name: "Trade History",
    headerRow: 2,
    cols: 7,
    colWidths: [110, 80, 70, 80, 120, 120, 200],
  },
  {
    name: "Fund Summary",
    headerRow: 0,
    cols: 2,
    colWidths: [250, 200],
  },
  {
    name: "NAV History",
    headerRow: 0,
    cols: 10,
    colWidths: [110, 120, 130, 130, 130, 120, 100, 80, 100, 180],
  },
  {
    name: "Fund Updates",
    headerRow: 2,
    cols: 7,
    colWidths: [100, 200, 400, 110, 140, 70, 120],
  },
  {
    name: "Voting Config",
    headerRow: 2,
    cols: 8,
    colWidths: [120, 70, 200, 300, 100, 150, 110, 110],
  },
  {
    name: "Vote Records",
    headerRow: 2,
    cols: 7,
    colWidths: [150, 200, 150, 200, 150, 110, 120],
  },
];

export async function applyBrandFormatting(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<boolean> {
  try {
    // Get sheet metadata
    const spreadsheet = await sheetsApi.spreadsheets.get({ spreadsheetId });
    const allSheets = spreadsheet.data.sheets || [];

    // Check if already formatted (via spreadsheet title)
    if (spreadsheet.data.properties?.title === "GBH Capital — Fund Backup") {
      return false; // Already formatted
    }

    const sheetMap: Record<string, number> = {};
    for (const s of allSheets) {
      if (s.properties?.title && s.properties?.sheetId !== undefined) {
        sheetMap[s.properties.title] = s.properties.sheetId!;
      }
    }

    // Delete default Sheet1 if it exists
    if (sheetMap["Sheet1"] !== undefined) {
      try {
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              { deleteSheet: { sheetId: sheetMap["Sheet1"] } },
            ],
          },
        });
      } catch {
        // Sheet1 may have data or be the only sheet
      }
    }

    const requests: sheets_v4.Schema$Request[] = [];

    for (const cfg of SHEET_CONFIGS) {
      const sheetId = sheetMap[cfg.name];
      if (sheetId === undefined) continue;

      // Tab color: gold
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId,
            tabColorStyle: { rgbColor: gold },
          },
          fields: "tabColorStyle",
        },
      });

      // All cells: navy bg, soft white text, Inter font
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1000,
            startColumnIndex: 0,
            endColumnIndex: cfg.cols,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: navy,
              textFormat: {
                foregroundColorStyle: { rgbColor: softWhite },
                fontFamily: "Inter",
                fontSize: 10,
              },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      });

      // Timestamp row: dark navy, gold italic
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: cfg.cols,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: darkNavy,
              textFormat: {
                foregroundColorStyle: { rgbColor: gold },
                fontFamily: "Inter",
                fontSize: 9,
                italic: true,
              },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      });

      // Header row: gold bg, dark navy bold text, centered
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: cfg.headerRow,
            endRowIndex: cfg.headerRow + 1,
            startColumnIndex: 0,
            endColumnIndex: cfg.cols,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: gold,
              textFormat: {
                foregroundColorStyle: {
                  rgbColor: { red: 0, green: 0.03, blue: 0.07 },
                },
                fontFamily: "Inter",
                fontSize: 10,
                bold: true,
              },
              horizontalAlignment: "CENTER",
              borders: {
                bottom: {
                  style: "SOLID_MEDIUM",
                  colorStyle: {
                    rgbColor: { red: 0.7, green: 0.5, blue: 0.28 },
                  },
                },
              },
            },
          },
          fields:
            "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,borders)",
        },
      });

      // Freeze rows through header
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: { frozenRowCount: cfg.headerRow + 1 },
          },
          fields: "gridProperties.frozenRowCount",
        },
      });

      // Column widths
      for (let i = 0; i < cfg.colWidths.length; i++) {
        requests.push({
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: i,
              endIndex: i + 1,
            },
            properties: { pixelSize: cfg.colWidths[i] },
            fields: "pixelSize",
          },
        });
      }

      // Alternating row banding
      requests.push({
        addBanding: {
          bandedRange: {
            range: {
              sheetId,
              startRowIndex: cfg.headerRow + 1,
              endRowIndex: 500,
              startColumnIndex: 0,
              endColumnIndex: cfg.cols,
            },
            rowProperties: {
              firstBandColorStyle: { rgbColor: navy },
              secondBandColorStyle: { rgbColor: bgAlt },
            },
          },
        },
      });
    }

    // Fund Summary section headers: gold bold
    const summaryId = sheetMap["Fund Summary"];
    if (summaryId !== undefined) {
      for (const row of [2, 9, 13, 16, 22, 27]) {
        requests.push({
          repeatCell: {
            range: {
              sheetId: summaryId,
              startRowIndex: row,
              endRowIndex: row + 1,
              startColumnIndex: 0,
              endColumnIndex: 2,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  foregroundColorStyle: { rgbColor: gold },
                  fontFamily: "Inter",
                  fontSize: 11,
                  bold: true,
                },
              },
            },
            fields: "userEnteredFormat(textFormat)",
          },
        });
      }
    }

    // Apply in batches
    for (let i = 0; i < requests.length; i += 50) {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: requests.slice(i, i + 50) },
      });
    }

    // Rename spreadsheet
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSpreadsheetProperties: {
              properties: { title: "GBH Capital — Fund Backup" },
              fields: "title",
            },
          },
        ],
      },
    });

    return true; // Formatting was applied
  } catch (err) {
    console.error("Sheet formatting error:", err);
    return false;
  }
}
