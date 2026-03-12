/**
 * Test Gemini Vision API description accuracy improvements
 * Tests: resolution, color, prompt engineering, PDF-direct, structured output
 *
 * Usage: GEMINI_API_KEY=xxx node research/test_description_accuracy.mjs
 */
import fs from 'fs';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) { console.log('GEMINI_API_KEY not set'); process.exit(1); }

const PDF_PATH = 'data/uploads/1773218094989-repair_list_feb_2026__1_.pdf';
const pdfBuffer = fs.readFileSync(PDF_PATH);

// Known problem descriptions to check
const KNOWN_ISSUES = [
  { unitNo: 'B-10-03', expected: 'COOKER HOOD REPAIR' },
  { unitNo: 'B-16-07', expected: 'REPLACE WATER HEATER TANK', note: 'second B-16-07 row' },
  { unitNo: 'B-07-04', expected: 'CHANGE TOILET SEAT REPAIR', note: 'first B-07-04' },
  { unitNo: 'B-28-03', expected: 'ENTRANCE DIGITAL LOCK REPAIR', note: 'second B-28-03' },
  { unitNo: '20-13', expected: 'TOUCH UP BATHROOM CEILING REPAIR' },
  { unitNo: 'B-30-04', expected: 'BATHROOM CEILING WATER LEAKS REPAIR', note: 'second B-30-04' },
  { unitNo: 'B-16-07', expected: 'BATHROOM WATER HEATER PIPE REPAIR', note: 'first B-16-07' },
  { unitNo: 'B-28-07', expected: 'REPAIR KITCHEN WINDOW LOCK', note: 'window not wwindow' },
  { unitNo: 'B-30-01', expected: 'TOILET SHOWER GLASS RUBBER REPAIR', note: 'not REP' },
  { unitNo: 'B-09-04', expected: 'CHANGE WINDOW LOCK REPAIR', note: 'not REP' },
  { unitNo: '09-13', expected: 'CHANGE TOILET WATER VALVE REPAIR', note: 'not REP' },
  { unitNo: '15-11', expected: 'BATTERY REMOTE REPAIR', note: 'not VREMOTE' },
];

function checkDescriptions(items, testName) {
  let correct = 0;
  let total = KNOWN_ISSUES.length;
  const issues = [];

  for (const check of KNOWN_ISSUES) {
    const matches = items.filter(i => i.unitNo === check.unitNo);
    let found = false;
    for (const m of matches) {
      const desc = (m.description || '').toUpperCase();
      const exp = check.expected.toUpperCase();
      // Check if all words from expected are present
      const expWords = exp.split(/\s+/);
      const allWordsPresent = expWords.every(w => desc.includes(w));
      if (allWordsPresent) {
        found = true;
        correct++;
        break;
      }
    }
    if (!found) {
      const actualDescs = matches.map(m => m.description).join(' | ');
      issues.push(`  MISS: ${check.unitNo} (${check.note || ''}): expected "${check.expected}" got "${actualDescs}"`);
    }
  }

  console.log(`\n[${testName}] Accuracy: ${correct}/${total} (${(correct/total*100).toFixed(0)}%)`);
  if (issues.length > 0) {
    console.log('Issues:');
    issues.forEach(i => console.log(i));
  }
  return { testName, correct, total, issues };
}

async function callGemini(model, parts, config = {}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192, ...config },
      }),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini ${model} error ${response.status}: ${body.substring(0, 300)}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

// ----- Render helpers -----
async function renderPages(scale, colorSpace) {
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
  const pages = [];
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(
      [scale, 0, 0, scale, 0, 0],
      colorSpace === 'rgb' ? mupdf.ColorSpace.DeviceRGB : mupdf.ColorSpace.DeviceGray,
      false, true
    );
    pages.push({ png: Buffer.from(pixmap.asPNG()), w: pixmap.getWidth(), h: pixmap.getHeight() });
  }
  return pages;
}

// ----- Prompts -----
const BASELINE_PROMPT = `You are a precise data extraction engine. Extract ALL repair/maintenance line items from this scanned repair work order table.

The table has these columns (left to right):
1. Date (DD/MM/YYYY)
2. Project name (abbreviations: MP4=MOLEK PINE 4, MP3=MOLEK PINE 3, SUASANA, PONDER OSA=PONDEROSA, SUMMER PLACE, IMPERIA, MOLEK PULAI)
3. Unit number (e.g. B-10-03, 14-01, B-13A-06)
4. Description of repair work (may span 2 lines)
5. Payment method (internet banking or petty cash)
6. Receipt No / Amount columns (printed numbers)
7. Tracking column
8. "Final Price (Claim to Customer) (RM)" — the RIGHTMOST column. These are often HANDWRITTEN numbers.

CRITICAL RULES:
- Extract EVERY row. Do not skip any.
- "costAmount" = the printed Internet Banking (RM) amount (column 6)
- "finalPrice" = the HANDWRITTEN amount in the rightmost "Final Price (Claim to Customer)" column. READ THE HANDWRITING CAREFULLY.
- If finalPrice is blank/unreadable for a row, set it to null.
- Some descriptions span 2 lines — merge them into one description.
- Expand project abbreviations.
- Date format: YYYY-MM-DD
- Return ONLY valid JSON array. No markdown, no explanation.

Output format:
[{"date":"2026-02-03","project":"PONDEROSA","unitNo":"B-10-03","description":"Cooker hood repair","costAmount":740,"finalPrice":1180},...]`;

const ENHANCED_PROMPT = `You are a precise data extraction engine specializing in repair/maintenance work orders. Extract ALL line items from this scanned table.

## Table columns (left to right):
1. Date (DD/MM/YYYY)
2. Project name (abbreviations: MP4=MOLEK PINE 4, MP3=MOLEK PINE 3, SUASANA, PONDER OSA=PONDEROSA, SUMMER PLACE, IMPERIA, MOLEK PULAI)
3. Unit number (e.g. B-10-03, 14-01, B-13A-06)
4. Description of repair work (may span 2 lines — MERGE into single description)
5. Payment method
6. Receipt No / Amount columns
7. Tracking column
8. "Final Price (Claim to Customer) (RM)" — RIGHTMOST column, often HANDWRITTEN

## VOCABULARY OF COMMON REPAIR TERMS (use these for spelling correction):
BATHROOM, BEDROOM, KITCHEN, LIVING ROOM, DINING ROOM, ENTRANCE, TOILET, CEILING, WINDOW, DOOR,
WATER HEATER, COOKER HOOD, AIRCON, COMPRESSOR, WASHING MACHINE, CEILING FAN, SHOWER, BATHTUB,
PIPE, LEAKAGE, REPAIR, REPLACE, CHANGE, INSTALL, SWITCH, VALVE, PUMP, FLUSH, LOCK, REMOTE,
DIGITAL LOCK, WATERPROOFING, STICKER, CABINET, MATTRESS, LIGHTS, PLUG, RUBBER, COVER, GLASS,
FLOOR TRAP, SINK, CLOG, BLOCK, BURST, STAIN, TOUCH UP, ACCESS CARD, BEDSHEETS

## CRITICAL EXTRACTION RULES:
1. Extract EVERY row — do not skip any.
2. "costAmount" = printed Internet Banking (RM) amount
3. "finalPrice" = HANDWRITTEN amount in rightmost column. If blank/unreadable, set null.
4. **DESCRIPTIONS**: Read carefully, character by character. Common scan artifacts to correct:
   - Missing letters (e.g., "BATROOM" → "BATHROOM", "TOILE" → "TOILET", "CEILNG" → "CEILING", "ATER" → "WATER", "ENRANCE" → "ENTRANCE", "WWINDOW" → "WINDOW")
   - Truncated words: Always write the FULL word (e.g., "REP" should be "REPAIR")
   - Merged characters: "VREMOTE" → "REMOTE" (or "V REMOTE" if V is a brand)
5. Multi-line descriptions: ALWAYS merge continuation lines into one complete description.
6. Expand project abbreviations.
7. Date format: YYYY-MM-DD

Return ONLY a valid JSON array. No markdown, no explanation.

Output format:
[{"date":"2026-02-03","project":"PONDEROSA","unitNo":"B-10-03","description":"COOKER HOOD REPAIR","costAmount":740,"finalPrice":1180},...]`;

const STRUCTURED_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      date: { type: "STRING", description: "Date in YYYY-MM-DD format" },
      project: { type: "STRING", description: "Project name, expanded from abbreviations" },
      unitNo: { type: "STRING", description: "Unit number e.g. B-10-03" },
      description: { type: "STRING", description: "Full description of repair work. Correct any OCR typos. Use full words (REPAIR not REP). Common terms: BATHROOM, TOILET, CEILING, ENTRANCE, WINDOW, WATER HEATER, DIGITAL LOCK" },
      costAmount: { type: "NUMBER", description: "Printed Internet Banking amount in RM", nullable: true },
      finalPrice: { type: "NUMBER", description: "Handwritten Final Price amount in RM", nullable: true },
    },
    required: ["date", "project", "unitNo", "description"],
  },
};

// ----- Tests -----
const results = [];

// TEST 1: Baseline (current) — 2x grayscale + baseline prompt
console.log('\n========== TEST 1: Baseline (2x grayscale + baseline prompt) ==========');
{
  const pages = await renderPages(2.0, 'gray');
  console.log(`Rendered: ${pages.length} pages, ${pages[0].w}x${pages[0].h}`);
  let allItems = [];
  for (let i = 0; i < pages.length; i++) {
    const json = await callGemini('gemini-2.5-flash', [
      { text: BASELINE_PROMPT },
      { inlineData: { mimeType: 'image/png', data: pages[i].png.toString('base64') } },
    ]);
    try { allItems.push(...JSON.parse(json)); } catch(e) { console.error(`Parse error p${i+1}:`, e.message); }
  }
  console.log(`Total items: ${allItems.length}`);
  results.push(checkDescriptions(allItems, 'Baseline-2x-gray'));
}

// TEST 2: 3x COLOR + baseline prompt
console.log('\n========== TEST 2: 3x COLOR + baseline prompt ==========');
{
  const pages = await renderPages(3.0, 'rgb');
  console.log(`Rendered: ${pages.length} pages, ${pages[0].w}x${pages[0].h}`);
  let allItems = [];
  for (let i = 0; i < pages.length; i++) {
    const json = await callGemini('gemini-2.5-flash', [
      { text: BASELINE_PROMPT },
      { inlineData: { mimeType: 'image/png', data: pages[i].png.toString('base64') } },
    ]);
    try { allItems.push(...JSON.parse(json)); } catch(e) { console.error(`Parse error p${i+1}:`, e.message); }
  }
  console.log(`Total items: ${allItems.length}`);
  results.push(checkDescriptions(allItems, '3x-color-baseline'));
}

// TEST 3: 3x COLOR + enhanced prompt (with vocabulary + typo corrections)
console.log('\n========== TEST 3: 3x COLOR + enhanced prompt ==========');
{
  const pages = await renderPages(3.0, 'rgb');
  let allItems = [];
  for (let i = 0; i < pages.length; i++) {
    const json = await callGemini('gemini-2.5-flash', [
      { text: ENHANCED_PROMPT },
      { inlineData: { mimeType: 'image/png', data: pages[i].png.toString('base64') } },
    ]);
    try { allItems.push(...JSON.parse(json)); } catch(e) { console.error(`Parse error p${i+1}:`, e.message); }
  }
  console.log(`Total items: ${allItems.length}`);
  results.push(checkDescriptions(allItems, '3x-color-enhanced'));
  // Save for analysis
  fs.writeFileSync('research/gemini_enhanced_result.json', JSON.stringify(allItems, null, 2));
}

// TEST 4: Send PDF directly to Gemini (no image conversion)
console.log('\n========== TEST 4: PDF direct + enhanced prompt ==========');
{
  const pdfBase64 = pdfBuffer.toString('base64');
  const json = await callGemini('gemini-2.5-flash', [
    { text: ENHANCED_PROMPT },
    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
  ]);
  let allItems = [];
  try { allItems = JSON.parse(json); } catch(e) { console.error('Parse error:', e.message); }
  console.log(`Total items: ${allItems.length}`);
  results.push(checkDescriptions(allItems, 'PDF-direct-enhanced'));
  fs.writeFileSync('research/gemini_pdf_direct_result.json', JSON.stringify(allItems, null, 2));
}

// TEST 5: 3x COLOR + enhanced prompt + structured output (JSON schema)
console.log('\n========== TEST 5: 3x COLOR + enhanced + structured output ==========');
{
  const pages = await renderPages(3.0, 'rgb');
  let allItems = [];
  for (let i = 0; i < pages.length; i++) {
    const json = await callGemini('gemini-2.5-flash', [
      { text: ENHANCED_PROMPT },
      { inlineData: { mimeType: 'image/png', data: pages[i].png.toString('base64') } },
    ], {
      responseMimeType: 'application/json',
      responseSchema: STRUCTURED_SCHEMA,
    });
    try { allItems.push(...JSON.parse(json)); } catch(e) { console.error(`Parse error p${i+1}:`, e.message); }
  }
  console.log(`Total items: ${allItems.length}`);
  results.push(checkDescriptions(allItems, '3x-color-structured'));
}

// TEST 6: gemini-2.5-pro (page 1 only — for comparison)
console.log('\n========== TEST 6: gemini-2.5-pro (page 1 only, 3x color, enhanced) ==========');
{
  const pages = await renderPages(3.0, 'rgb');
  const json = await callGemini('gemini-2.5-pro', [
    { text: ENHANCED_PROMPT },
    { inlineData: { mimeType: 'image/png', data: pages[0].png.toString('base64') } },
  ]);
  let pageItems = [];
  try { pageItems = JSON.parse(json); } catch(e) { console.error('Parse error:', e.message); }
  console.log(`Page 1 items: ${pageItems.length}`);
  // Only check items that should be on page 1
  const p1Checks = KNOWN_ISSUES.filter(c =>
    ['B-10-03','14-01','B-16-07','B-07-04'].some(u => c.unitNo === u)
  );
  let correct = 0;
  for (const check of p1Checks) {
    const matches = pageItems.filter(i => i.unitNo === check.unitNo);
    for (const m of matches) {
      const desc = (m.description || '').toUpperCase();
      const expWords = check.expected.toUpperCase().split(/\s+/);
      if (expWords.every(w => desc.includes(w))) { correct++; break; }
    }
  }
  console.log(`Pro model page 1 check: ${correct}/${p1Checks.length}`);
  results.push({ testName: 'gemini-2.5-pro-p1', correct, total: p1Checks.length, issues: [] });
  fs.writeFileSync('research/gemini_pro_p1_result.json', JSON.stringify(pageItems, null, 2));
}

// ----- Summary -----
console.log('\n\n========== SUMMARY ==========');
console.log('Test                          | Correct | Total | Accuracy');
console.log('-'.repeat(65));
for (const r of results) {
  const pct = (r.correct / r.total * 100).toFixed(0);
  console.log(`${r.testName.padEnd(30)} | ${String(r.correct).padStart(7)} | ${String(r.total).padStart(5)} | ${pct}%`);
}

// Save full results
fs.writeFileSync('research/description_accuracy_tests.json', JSON.stringify(results, null, 2));
console.log('\nResults saved to research/description_accuracy_tests.json');
