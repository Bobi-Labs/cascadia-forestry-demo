/**
 * Hood River vegetation-control bid / agreement parser.
 *
 * Format tag: `hr-vegetation-control-bid`. Mode B (PDF, text-extractable).
 *
 * Important caveat: the Hood River files we've seen so far are the
 * MASTER Services Agreement only — a 3-page boilerplate document
 * referencing "one or more executed Statement of Work(s) in the form
 * attached as Exhibit A". The per-unit info (acreage, location, mix,
 * application rate) lives in those Statement of Work documents, which
 * Hood River often emails separately and we haven't ingested yet.
 *
 * What this parser CAN do:
 *   - Extract the project-level metadata that IS in the master agreement
 *     (customer name, county, state, effective date)
 *   - Queue a single placeholder row tagged `needs_sow_attachment` so
 *     the office knows to upload the Statement of Work and either
 *     hand-enter units or wait for a future SoW parser
 *
 * What this parser cannot do (yet):
 *   - Parse actual unit acreage / location / mix data — there's nothing
 *     to parse until SoW attachments land in the contract folder
 *
 * When the SoW format stabilizes we extend this parser (or add a
 * sibling parser) to extract per-unit data from those attachments.
 *
 * No DB writes here. Orchestrator dispatches based on `format_tag`
 * and inserts to `unit_pending_review` (always queued, since the row
 * has parser warnings).
 */

import { canonicalizeState, canonicalizeWorkType } from "../canonicalize.mjs";
import { extractLocation } from "../extract-location.mjs";

function ensurePdfJsGlobals() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix { constructor() {} };
  }
  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageData { constructor() {} };
  }
  if (typeof globalThis.Path2D === "undefined") {
    globalThis.Path2D = class Path2D { constructor() {} };
  }
}

let _getDocument = null;
async function loadGetDocument() {
  if (_getDocument) return _getDocument;
  ensurePdfJsGlobals();
  const workerMod = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  globalThis.pdfjsWorker = workerMod;
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  _getDocument = mod.getDocument;
  return _getDocument;
}

export const FORMAT_TAG = "hr-vegetation-control-bid";
export const PARSER_VERSION = 1;

/**
 * Pull the customer name out of the agreement preamble. Pattern:
 *   "...the 'Effective Date') by and between Ramos Reforestation,
 *    a Washington incorporated company having its principal offices at
 *    PO Box 697, Longview WA 98632 ('Applicator'), and Hood River
 *    County, having its principal offices at..."
 *
 * Match the customer name between "and " (after Applicator's address
 * block) and the comma that introduces their address.
 */
function extractCustomer(text) {
  // Anchor on "and <Customer>, having its principal offices…". The
  // Applicator block uses either straight or smart quotes around
  // "Applicator" depending on Word's autocorrect mood, so we just
  // anchor on the literal "and" that immediately precedes the
  // customer name and let the comma terminate the capture.
  // pdfjs strips smart-quote escapes already, but be liberal anyway
  // — `Applicator["'’]` covers all three forms.
  const m = text.match(
    /Applicator["'’]\)\s*,?\s*and\s+([A-Z][A-Za-z .'-]+?)\s*,\s*having/,
  );
  return m ? m[1].trim() : "";
}

/**
 * The customer in the Hood River agreements is always "Hood River
 * County" (or similar). Strip "County" if present and return the
 * county name on its own.
 */
function countyFromCustomer(customer) {
  return customer.replace(/\s+County\s*$/i, "").trim();
}

/**
 * State extraction. The Hood River master agreement names the customer
 * address with the state — typically "Hood River, Oregon 97031". Use
 * the Oregon city + ZIP combo.
 */
function extractState(text) {
  // First-pass: ZIP-anchored "<CITY>, <STATE-NAME> <ZIP>" pattern (the
  // customer address). Hood River agreements consistently put state
  // as a full name, not USPS code, in this address.
  const m = text.match(
    /,\s+(Oregon|Washington|Idaho|Montana|California)\s+\d{5}/i,
  );
  if (m) return m[1];
  // Fallback to USPS code with ZIP
  const code = text.match(/,\s+([A-Z]{2})\s+\d{5}/);
  return code ? code[1] : "";
}

/**
 * Effective date in the agreement preamble. Pattern:
 *   "...is entered into as of April 16, 2026 (the 'Effective Date')..."
 */
function extractEffectiveDate(text) {
  const m = text.match(
    /entered\s+into\s+as\s+of\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/,
  );
  return m ? m[1] : "";
}

/**
 * Title from the first line of the agreement, e.g.
 *   "SPRING 2026 GROUND VEGETATION CONTROL APPLICATION SERVICES AGREEMENT"
 */
function extractTitle(text) {
  const m = text.match(
    /([A-Z]{3,}[A-Z\s\d]+(?:VEGETATION|HERBICIDE|GROUND APPLICATION)[A-Z\s]+AGREEMENT)/,
  );
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

/**
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer
 */
export async function parseHoodRiverVegetationControl(buffer) {
  const u8 = buffer instanceof Buffer
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : (buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  const getDocument = await loadGetDocument();
  const doc = await getDocument({
    data: u8,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  let allText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const txt = await page.getTextContent();
    for (const item of txt.items) {
      if (typeof item.str === "string") allText += " " + item.str;
    }
  }

  const sheetWarnings = [];
  const customer = extractCustomer(allText);
  const county = countyFromCustomer(customer);
  const stateRaw = extractState(allText);
  const state = canonicalizeState(stateRaw);
  const effectiveDate = extractEffectiveDate(allText);
  const title = extractTitle(allText);

  // No per-unit data is parseable from the master agreement; queue a
  // single placeholder row so the office sees this contract in the
  // Pending Units queue and can either hand-enter units from a SoW
  // attachment or upload it for future SoW-parser work.
  //
  // The notes copy is intentionally plain English — the office reads
  // this without knowing the parser's terminology. Avoid jargon like
  // "Statement of Work attachments (Exhibit A)" in the notes itself;
  // the WhyPanel above the field list re-states that context with
  // proper formatting. Notes here are just the metadata the office
  // typically wants to see (effective date + customer).
  const projectName = title || "Hood River Vegetation Control";
  const noteParts = [];
  if (customer) noteParts.push(`Customer: ${customer}`);
  if (effectiveDate) noteParts.push(`Effective: ${effectiveDate}`);

  const canonicalRow = {
    name: projectName,
    notes: noteParts.join(" · "),
    work_type: canonicalizeWorkType("herbicide_spray"),
  };
  if (state) canonicalRow.state = state;
  const sharedLocation = extractLocation(allText);
  if (sharedLocation.latitude != null) canonicalRow.latitude = sharedLocation.latitude;
  if (sharedLocation.longitude != null) canonicalRow.longitude = sharedLocation.longitude;
  if (sharedLocation.township_range) canonicalRow.township_range = sharedLocation.township_range;
  if (county) canonicalRow.county = county;

  return {
    formatTag: FORMAT_TAG,
    version: PARSER_VERSION,
    rowCount: 1,
    parsed: [
      {
        canonicalRow,
        sourceRow: {
          customer,
          county,
          state: stateRaw,
          effectiveDate,
          title,
        },
        unmappedFields: {},
        // The warning shape "needs_sow_attachment" is what the
        // Pending Units WhyPanel matches on to render the
        // master-agreement explanation. Keep the prefix stable.
        warnings: [
          "needs_sow_attachment: master agreement only, no per-unit data in this file",
        ],
      },
    ],
    sheetWarnings,
  };
}
