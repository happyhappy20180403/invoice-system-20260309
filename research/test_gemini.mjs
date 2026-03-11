/**
 * Test Gemini Vision API — reads "Final Price (Claim to Customer)" column
 * Usage: GEMINI_API_KEY=xxx node research/test_gemini.mjs
 */
import fs from 'fs';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.log('GEMINI_API_KEY is not set.');
  process.exit(1);
}

const pdfBuffer = fs.readFileSync('data/uploads/1773218094989-repair_list_feb_2026__1_.pdf');
const mupdf = await import('mupdf');
const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
const pageCount = doc.countPages();

const PROMPT = `You are a precise data extraction engine. Extract ALL repair/maintenance line items from this scanned repair work order table.

The table has these columns (left to right):
1. Date (DD/MM/YYYY)
2. Project name (abbreviations: MP4=MOLEK PINE 4, MP3=MOLEK PINE 3, SUASANA, PONDER OSA=PONDEROSA, SUMMER PLACE, IMPERIA, MOLEK PULAI)
3. Unit number (e.g. B-10-03, 14-01, B-13A-06)
4. Description of repair work (may span 2 lines)
5. Payment method (internet banking or petty cash)
6. Receipt No / Amount columns (printed numbers)
7. Tracking column
8. **"Final Price (Claim to Customer) (RM)"** — the RIGHTMOST column. These are often HANDWRITTEN numbers. This is the most important amount.

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

let allItems = [];

for (let i = 0; i < pageCount; i++) {
  const page = doc.loadPage(i);
  const pixmap = page.toPixmap([2.0, 0, 0, 2.0, 0, 0], mupdf.ColorSpace.DeviceGray, false, true);
  const png = Buffer.from(pixmap.asPNG());
  console.log(`Page ${i + 1}: sending to Gemini...`);

  const response = await fetch(
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

  if (!response.ok) {
    console.error('Gemini error:', response.status, await response.text());
    process.exit(1);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const jsonStr = text.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  try {
    const rows = JSON.parse(jsonStr);
    console.log(`Page ${i + 1}: ${rows.length} items\n`);
    allItems.push(...rows);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    console.log('Raw:', text.substring(0, 500));
  }
}

console.log('=== RESULTS ===');
console.log(`Total: ${allItems.length} items\n`);
console.log('#  | Date       | Project        | Unit     | Cost   | Final Price | Description');
console.log('-'.repeat(110));

for (let i = 0; i < allItems.length; i++) {
  const r = allItems[i];
  const cost = r.costAmount != null ? String(r.costAmount).padStart(6) : '     ?';
  const final = r.finalPrice != null ? String(r.finalPrice).padStart(6) : '     -';
  console.log(
    `${String(i+1).padStart(2)} | ${r.date} | ${(r.project||'').padEnd(14)} | ${(r.unitNo||'').padEnd(8)} | ${cost} | ${final}      | ${r.description}`
  );
}

fs.writeFileSync('research/gemini_result.json', JSON.stringify(allItems, null, 2));
console.log('\nSaved to research/gemini_result.json');
