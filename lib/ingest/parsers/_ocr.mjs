/**
 * OCR helper — extracts text from image-only PDFs using Google Cloud
 * Vision (DOCUMENT_TEXT_DETECTION mode).
 *
 * Used by parsers that handle scanned PDFs (currently:
 * Weyerhaeuser PlantationExam_UnitNoPlots_*.pdf — typed-form scans
 * with no embedded text layer).
 *
 * Auth: reuses the existing GOOGLE_CREDENTIALS_BASE64 service account
 * key. The same service account that owns the Drive integration must
 * also have the "Cloud Vision API User" role on the GCP project, AND
 * the Vision API must be enabled in the project. Setup steps live in
 * docs/unit-ingest-ocr-setup.md.
 *
 * Failure mode: if Vision isn't enabled OR the service account is
 * missing the IAM role, this throws. Callers MUST wrap calls in
 * try/catch and fall back to whatever they did before OCR shipped
 * (typically: filename-only path that queues the row for office
 * review). That way the pipeline degrades gracefully when the API
 * is mid-setup, instead of bricking every WY ingest run.
 *
 * Cost: $1.50 per 1,000 pages of DOCUMENT_TEXT_DETECTION. Free tier
 * is 1,000 units/month — realistic forestry volume sits at ~50-500
 * pages/year, well inside free.
 */

let _client = null;

/**
 * Lazily build the Vision client. Throws if the env var is missing or
 * the package isn't installed (defensive; the package is in the deps
 * but if the import fails we want a useful error).
 */
async function getClient() {
  if (_client) return _client;

  const b64 = (process.env.GOOGLE_CREDENTIALS_BASE64 || "").trim();
  if (!b64) {
    throw new Error(
      "OCR unavailable: GOOGLE_CREDENTIALS_BASE64 not set. " +
        "OCR uses the same service-account credentials as the rest of " +
        "the Google integrations.",
    );
  }

  let visionModule;
  try {
    visionModule = await import("@google-cloud/vision");
  } catch (e) {
    throw new Error(
      `OCR unavailable: failed to load @google-cloud/vision (${e.message}). ` +
        "Run pnpm install to refresh dependencies.",
    );
  }
  const ImageAnnotatorClient = visionModule.default?.ImageAnnotatorClient || visionModule.ImageAnnotatorClient;
  if (!ImageAnnotatorClient) {
    throw new Error("OCR unavailable: ImageAnnotatorClient not exported by @google-cloud/vision");
  }

  const creds = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  _client = new ImageAnnotatorClient({ credentials: creds, projectId: creds.project_id });
  return _client;
}

/**
 * Run OCR on a PDF buffer. Returns the full extracted text (newline-
 * separated by page break) OR throws if the API call fails.
 *
 * Using `batchAnnotateFiles` with PDF input (vs converting pages to
 * images on our side) — Vision handles the page split + OCR in one
 * round-trip, faster + cheaper than per-page calls.
 *
 * @param {Buffer | ArrayBuffer | Uint8Array} buffer  PDF file bytes
 * @returns {Promise<{text: string, pageCount: number}>}
 */
export async function ocrPdf(buffer) {
  const client = await getClient();

  // Normalize to Buffer
  const buf =
    Buffer.isBuffer(buffer)
      ? buffer
      : buffer instanceof Uint8Array
      ? Buffer.from(buffer)
      : Buffer.from(new Uint8Array(buffer));

  // batchAnnotateFiles with `inputConfig.content` runs OCR on every
  // page of the PDF and returns one TextAnnotation per page.
  const [result] = await client.batchAnnotateFiles({
    requests: [
      {
        inputConfig: {
          mimeType: "application/pdf",
          content: buf.toString("base64"),
        },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      },
    ],
  });

  const responses = result.responses?.[0]?.responses ?? [];
  const pages = responses.map((r) => r.fullTextAnnotation?.text ?? "");
  const text = pages.join("\n\n=== PAGE BREAK ===\n\n");

  return { text, pageCount: pages.length };
}

/**
 * Quick availability check — does the service account currently have
 * permission to call Vision? Returns true/false so callers can decide
 * whether to attempt OCR or skip straight to fallback. Caches the
 * result for the lifetime of the process to avoid hammering the
 * authorize endpoint on every batch.
 */
let _availabilityCache = null;
export async function isOcrAvailable() {
  if (_availabilityCache != null) return _availabilityCache;
  try {
    await getClient();
    _availabilityCache = true;
  } catch {
    _availabilityCache = false;
  }
  return _availabilityCache;
}
