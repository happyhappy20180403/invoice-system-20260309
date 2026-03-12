/**
 * Final verification: enhanced prompt + post-processing on page 1
 * Checks all 12 known problem descriptions
 */
import fs from 'fs';

const API_KEY = fs.readFileSync('.env.local', 'utf8').match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!API_KEY) { console.log('No GEMINI_API_KEY in .env.local'); process.exit(1); }

const pdfBuffer = fs.readFileSync('data/uploads/1773218094989-repair_list_feb_2026__1_.pdf');
const mupdf = await import('mupdf');
const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');

// Use the SAME prompt as production code
const PROMPT = `You are a precise data extraction engine for property repair work orders. Read the scanned table carefully, character by character, and extract ALL line items.

TABLE COLUMNS (left to right):
1. Date (DD/MM/YYYY)
2. Project name (abbreviations: MP4=MOLEK PINE 4, MP3=MOLEK PINE 3, SUASANA, PONDER OSA=PONDEROSA, SUMMER PLACE, IMPERIA, MOLEK PULAI)
3. Unit number (e.g. B-10-03, 14-01, B-13A-06)
4. Description of repair work (may span 2 lines in the table — merge into one)
5. Payment method (internet banking or petty cash)
6. Receipt No / Amount columns (printed numbers)
7. Tracking column
8. "Final Price (Claim to Customer) (RM)" — the RIGHTMOST column with HANDWRITTEN numbers

VALID REPAIR VOCABULARY (use these exact words when correcting descriptions):
BATHROOM, BEDROOM, KITCHEN, LIVING ROOM, DINING ROOM, ENTRANCE, TOILET, CEILING, WINDOW, DOOR,
WATER HEATER, COOKER HOOD, AIRCON, COMPRESSOR, WASHING MACHINE, CEILING FAN, SHOWER, BATHTUB,
PIPE, LEAKAGE, REPAIR, REPLACE, CHANGE, INSTALL, SWITCH, VALVE, PUMP, FLUSH, LOCK, REMOTE,
DIGITAL LOCK, WATERPROOFING, STICKER, CABINET, MATTRESS, LIGHTS, PLUG, RUBBER, COVER, GLASS,
FLOOR TRAP, SINK, CLOG, BLOCK, BURST, STAIN, TOUCH UP, ACCESS CARD, BEDSHEETS, STOPPER, TAP

SCAN ARTIFACT CORRECTIONS (always apply these):
- BATROOM / BATHROM → BATHROOM
- TOILE → TOILET
- CEILNG / CEILLING → CEILING
- ATER HEATER → WATER HEATER
- ENRANCE / ENTRACE → ENTRANCE
- WWINDOW → WINDOW
- VREMOTE → REMOTE
- KITHCEN / KTICHEN → KITCHEN
- DINNING → DINING
- Truncated "REP" at end of description → "REPAIR"
- Truncated "REPL" at end → "REPLACE"
- Remove stray punctuation at end (trailing commas, periods)

CRITICAL RULES:
- Extract EVERY row. Do not skip any.
- "costAmount" = the printed Internet Banking (RM) amount
- "finalPrice" = the HANDWRITTEN amount in the rightmost "Final Price (Claim to Customer)" column.
- If finalPrice is blank/unreadable, set it to null.
- Descriptions must use corrected vocabulary above. Fix ALL scan typos.
- Date format: YYYY-MM-DD
- Return ONLY valid JSON array. No markdown, no explanation.

Output format:
[{"date":"2026-02-03","project":"PONDEROSA","unitNo":"B-10-03","description":"COOKER HOOD REPAIR","costAmount":740,"finalPrice":1180},...]`;

// Post-processing (same as production)
const CORRECTIONS = {
  'BATROOM': 'BATHROOM', 'BATHROM': 'BATHROOM', 'TOILE ': 'TOILET ',
  'CEILNG': 'CEILING', 'CEILLING': 'CEILING', 'ATER HEATER': 'WATER HEATER',
  'ENRANCE': 'ENTRANCE', 'ENTRACE': 'ENTRANCE', 'WWINDOW': 'WINDOW',
  'WWATER': 'WATER', 'VREMOTE': 'REMOTE', 'KITHCEN': 'KITCHEN', 'KTICHEN': 'KITCHEN', 'DINNING': 'DINING',
};
function correctDescription(desc) {
  let fixed = desc;
  for (const [wrong, right] of Object.entries(CORRECTIONS)) {
    fixed = fixed.replace(new RegExp(wrong, 'gi'), right);
  }
  fixed = fixed.replace(/,\s*REP\s*$/i, ', REPAIR');
  fixed = fixed.replace(/\s+REP\s*$/i, ' REPAIR');
  fixed = fixed.replace(/[,.\s]+$/, '');
  return fixed;
}

// Known problem checks
// Each check targets a SPECIFIC description (partial match) for a unit
const CHECKS = [
  { unitNo: 'B-16-07', descContains: 'HEATER PIPE', must: 'WATER HEATER', mustNot: 'WWATER' },
  { unitNo: 'B-16-07', descContains: 'HEATER TANK', must: 'WATER HEATER', mustNot: 'WWATER' },
  { unitNo: 'B-07-04', descContains: 'TOILET SEAT', must: 'TOILET', mustNot: null },
  { unitNo: 'B-07-04', descContains: 'CEILING', must: 'BATHROOM', mustNot: 'BATROOM' },
  { unitNo: 'B-28-03', descContains: 'DIGITAL LOCK', must: 'ENTRANCE', mustNot: 'ENRANCE' },
  { unitNo: 'B-28-03', descContains: 'HEATER TANK', must: 'WATER HEATER', mustNot: 'WWATER' },
  { unitNo: '20-13', descContains: 'CEILING', must: 'CEILING', mustNot: 'CEILNG' },
  { unitNo: 'B-08-07', descContains: 'WINDOW', must: 'WINDOW', mustNot: 'WWINDOW' },
  { unitNo: '15-11', descContains: 'REMOTE', must: 'REMOTE', mustNot: 'VREMOTE' },
  { unitNo: '15-11', descContains: 'HEATER', must: 'WATER HEATER', mustNot: 'WWATER' },
  { unitNo: 'B-33-07', descContains: 'DINING', must: 'DINING', mustNot: 'DINNING' },
  { unitNo: 'B-19-02', descContains: 'HEATER', must: 'WATER HEATER', mustNot: 'WWATER' },
];

let allItems = [];
for (let i = 0; i < doc.countPages(); i++) {
  const page = doc.loadPage(i);
  const pixmap = page.toPixmap([2.0, 0, 0, 2.0, 0, 0], mupdf.ColorSpace.DeviceGray, false, true);
  const png = Buffer.from(pixmap.asPNG());
  console.log(`Page ${i+1}: sending...`);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192 },
      }),
    },
  );

  if (!res.ok) {
    console.error(`Page ${i+1}: API error ${res.status}`);
    const errText = await res.text();
    console.error(errText.substring(0, 300));
    process.exit(1);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) {
    console.error(`Page ${i+1}: empty response`, JSON.stringify(data).substring(0, 300));
    process.exit(1);
  }
  const jsonStr = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const rows = JSON.parse(jsonStr);
  console.log(`Page ${i+1}: ${rows.length} items`);
  allItems.push(...rows);
}

console.log(`\n=== ${allItems.length} items total ===\n`);

// Apply post-processing & verify
let pass = 0, fail = 0;
for (const item of allItems) {
  item.description = correctDescription(item.description);
}

for (const check of CHECKS) {
  const matches = allItems.filter(i => i.unitNo === check.unitNo && i.description.includes(check.descContains));
  if (matches.length === 0) {
    console.log(`FAIL | ${check.unitNo} | NO MATCH for "${check.descContains}"`);
    fail++;
    continue;
  }
  for (const m of matches) {
    const ok = m.description.includes(check.must) && (check.mustNot ? !m.description.includes(check.mustNot) : true);
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${m.unitNo} | "${m.description}" | expect: "${check.must}"${check.mustNot ? ` not: "${check.mustNot}"` : ''}`);
    if (ok) pass++; else fail++;
  }
}

console.log(`\n--- Quality Check: ${pass} pass, ${fail} fail ---\n`);

// Print all descriptions
for (const item of allItems) {
  console.log(`${item.unitNo.padEnd(9)} | RM ${String(item.finalPrice ?? '?').padStart(5)} | ${item.description}`);
}
