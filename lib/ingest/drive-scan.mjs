/**
 * Drive folder watcher — Stage 2 of Item 8.
 *
 * Walks the per-contract Drive folder tree, identifies new spec files
 * that haven't been ingested yet, and records them as pending batches
 * in `unit_ingest_batches`. Stage 3+ parsers consume the pending queue.
 *
 * Architecture (option A from the kickoff):
 *
 *   For each active contract that has a Drive folder:
 *     1. Walk `Maps & Specs/` (recursively) — landowner-format spec PDFs
 *     2. Walk `Units/` (recursively) — per-unit subfolders with files
 *     3. For each file found:
 *        - Detect landowner from contract folder ancestry
 *        - Detect format from filename pattern
 *        - Check if unit_ingest_batches already has a row for this
 *          drive_file_id (idempotency — re-running the scan doesn't
 *          double-process)
 *        - If new: insert a 'pending' batch row
 *
 * Returns a summary: files scanned, batches created, files skipped
 * (already ingested), files unrecognized.
 *
 * No DB writes happen unless `commit: true` is passed. Default is
 * dry-run — print what WOULD happen without touching the DB.
 *
 * Designed to be called from:
 *   - scripts/ingest/run-scan.mjs (manual / cron)
 *   - app/api/cron/ingest-units (Vercel Cron in Stage 8)
 */

import {
  detectFormat,
  detectLandownerFromFolderName,
} from "./landowner-detect.mjs";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * @typedef {object} ScanOptions
 * @property {import("googleapis").drive_v3.Drive} drive  Service-account-authed Drive client
 * @property {import("@supabase/supabase-js").SupabaseClient} sb  Supabase admin client
 * @property {boolean} [commit]  When false (default), skip all DB writes — dry run
 * @property {string[]} [contractIds]  Limit to specific contract UUIDs
 * @property {number} [maxContracts]  Safety bound on contracts walked. Default 100
 * @property {(msg: string) => void} [log]  Optional logger; defaults to console.log
 */

/**
 * @param {ScanOptions} opts
 */
export async function scanContractFoldersForUnitSpecs(opts) {
  const { drive, sb, commit = false, contractIds, maxContracts = 100 } = opts;
  const log = opts.log ?? ((m) => console.log(m));

  const result = {
    contractsWalked: 0,
    filesFound: 0,
    batchesCreated: 0,
    filesSkipped: 0,        // already had a batch row
    filesUnrecognized: 0,
    findings: /** @type {Array<{contractId:string,contractName:string,landowner:string,driveFileId:string,driveFileName:string,mimeType:string|null,formatTag:string,parserMode:"A"|"B"|"unknown",relativePath:string}>} */ ([]),
    errors: /** @type {Array<{contractId?:string,message:string}>} */ ([]),
  };

  // Pull active contracts with Drive folders
  let contractsQuery = sb
    .from("contracts")
    .select("id, name, drive_folder_admin_id, drive_folder_everyone_id, status")
    .eq("status", "active")
    .limit(maxContracts);
  if (contractIds && contractIds.length > 0) {
    contractsQuery = contractsQuery.in("id", contractIds);
  }
  const { data: contracts, error: contractsErr } = await contractsQuery;
  if (contractsErr) {
    result.errors.push({ message: `contracts query failed: ${contractsErr.message}` });
    return result;
  }
  if (!contracts) {
    return result;
  }

  // Pre-load already-ingested drive_file_ids into a Set so we don't insert
  // duplicates. Cheaper than per-file lookups against the DB inside the loop.
  const { data: existingBatches } = await sb
    .from("unit_ingest_batches")
    .select("drive_file_id")
    .limit(100000);
  const seenDriveFileIds = new Set((existingBatches ?? []).map((b) => b.drive_file_id));

  for (const contract of contracts) {
    result.contractsWalked += 1;

    // Use the Everyone folder — that's where Maps & Specs / Units live.
    // Admin folder is internal-ops only (per Item 1 / Drive design).
    const folderId = contract.drive_folder_everyone_id;
    if (!folderId) {
      log(`  ${contract.name}: no everyone folder, skipping`);
      continue;
    }

    // Resolve landowner from the contract's folder path. We walk up from
    // the contract folder to find its parent, which is the landowner-named
    // folder under Contracts/. One Drive metadata call per contract.
    let landowner = "unknown";
    try {
      const meta = await drive.files.get({
        fileId: folderId,
        fields: "id, name, parents",
        supportsAllDrives: true,
      });
      const parentId = meta.data.parents?.[0];
      if (parentId) {
        const parentMeta = await drive.files.get({
          fileId: parentId,
          fields: "id, name",
          supportsAllDrives: true,
        });
        landowner = detectLandownerFromFolderName(parentMeta.data.name ?? "");
      }
    } catch (e) {
      result.errors.push({
        contractId: contract.id,
        message: `landowner-detect failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    log(`▶ ${contract.name} (${landowner})`);

    // Walk the contract folder recursively, gathering candidate files.
    const candidates = [];
    try {
      await walkFolder(drive, folderId, "", candidates);
    } catch (e) {
      result.errors.push({
        contractId: contract.id,
        message: `walk failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }

    for (const file of candidates) {
      result.filesFound += 1;

      // Already ingested? skip.
      if (seenDriveFileIds.has(file.id)) {
        result.filesSkipped += 1;
        continue;
      }

      const detected = detectFormat(file.name, file.mimeType, landowner);
      const isKnown = detected.formatTag !== "unknown";
      if (!isKnown) {
        result.filesUnrecognized += 1;
      }

      result.findings.push({
        contractId: contract.id,
        contractName: contract.name,
        landowner,
        driveFileId: file.id,
        driveFileName: file.name,
        mimeType: file.mimeType,
        formatTag: detected.formatTag,
        parserMode: detected.parserMode,
        relativePath: file.path,
      });

      log(`  ${isKnown ? "+" : "·"} ${detected.formatTag} (${detected.parserMode}) :: ${file.path}`);

      // Only enqueue batches for KNOWN formats. Unknown files (maps,
      // certificates, photos, etc.) get logged in the scan output for
      // visibility but don't pollute unit_ingest_batches — there's
      // nothing for the parser to do with them. Office sees them only
      // if we ever decide to extend Stage 5 with an "unrecognized files"
      // tab; right now they're dev-loop diagnostics only.
      if (commit && isKnown) {
        const { error: insertErr } = await sb.from("unit_ingest_batches").insert({
          contract_id: contract.id,
          drive_file_id: file.id,
          drive_file_name: file.name,
          // Track the file's actual containing folder + its slash-
          // separated path inside the contract folder so the Pending
          // Units UI can deep-link straight to the right folder
          // (otherwise the office only had a link to the contract
          // root, which is misleading for files nested under
          // "Maps & Specs/" or similar).
          drive_parent_folder_id: file.parentFolderId ?? null,
          drive_relative_path: file.path ?? null,
          landowner,
          format_tag: detected.formatTag,
          parser_mode: detected.parserMode === "unknown" ? null : detected.parserMode,
          status: "pending",
        });
        if (insertErr) {
          result.errors.push({
            contractId: contract.id,
            message: `insert batch failed for ${file.id}: ${insertErr.message}`,
          });
        } else {
          result.batchesCreated += 1;
          seenDriveFileIds.add(file.id);
        }
      }
    }
  }

  return result;
}

/**
 * Recursively walk a folder, collecting files. Uses Drive `files.list`
 * with parent filtering. Skips trashed entries automatically. Mutates
 * the `out` array — adds entries with { id, name, mimeType, path }.
 *
 * Path tracking lets the watcher record where each file lived inside
 * the contract folder for office-review context.
 *
 * @param {import("googleapis").drive_v3.Drive} drive
 * @param {string} folderId
 * @param {string} pathPrefix
 * @param {Array<{id:string,name:string,mimeType:string|null,path:string}>} out
 */
async function walkFolder(drive, folderId, pathPrefix, out) {
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      const subPath = pathPrefix ? `${pathPrefix}/${f.name}` : (f.name ?? "");
      if (f.mimeType === FOLDER_MIME) {
        await walkFolder(drive, f.id, subPath, out);
      } else {
        out.push({
          id: f.id,
          name: f.name ?? "",
          mimeType: f.mimeType ?? null,
          path: subPath,
          // The folder this file actually lives in. Different from the
          // contract root for files nested under "Maps & Specs/" or
          // similar — the Pending Units UI links the office straight
          // to this folder so they can see siblings + visually verify
          // the source before approving a parsed row.
          parentFolderId: folderId,
        });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
}
