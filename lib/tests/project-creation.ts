/**
 * Test: end-to-end project (contract) creation with Drive folders.
 *
 * Reproduces the April 16 Manulife/La Grande regression. Inserts a
 * throwaway contract, calls the folder-creation API, asserts folders
 * land at Contracts/<landowner>/<name>/ with both subfolders, then
 * tears everything down.
 */
import type { TestContext, TestModule } from "./_types";
import { getDriveClient, getItem, trash, FOLDER_MIME } from "./_drive";
import { serviceRoleClient } from "./_supabase";

const mod: TestModule = {
  name: "project-creation",
  description: "Creating a new project writes Drive folders in the right place",
  severity: "critical",

  async run(ctx: TestContext) {
    const supabase = serviceRoleClient();
    const drive = getDriveClient();
    const testName = `__CLAUDE_TEST_${ctx.runId}`;
    const landowner = "Bidding";

    let contractId: string | undefined;
    let everyoneFolderId: string | undefined;
    let adminFolderId: string | undefined;
    const cleanup: string[] = [];

    try {
      // 1. Insert contract row
      const { data: row, error: insErr } = await supabase
        .from("contracts")
        .insert({ name: testName, landowner, status: "active" })
        .select("id")
        .single();
      if (insErr) throw new Error(`DB insert: ${insErr.message}`);
      contractId = row.id;
      ctx.step("db.insert_contract", true, { contractId });

      // 2. Call folder-creation endpoint
      const res = await fetch(`${ctx.baseUrl}/api/drive/contract-folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, contractName: testName, landowner }),
      });
      const body = await res.json();
      ctx.step("api.contract_folders_status", res.ok, { status: res.status, body });
      if (!res.ok) throw new Error(`api ${res.status}: ${JSON.stringify(body)}`);

      everyoneFolderId = body.everyoneFolderId;
      adminFolderId = body.adminFolderId;
      if (!everyoneFolderId || !adminFolderId) throw new Error("missing folder IDs in response");
      ctx.step("api.returned_ids", true, { everyoneFolderId, adminFolderId });

      // 3. DB row got updated
      const { data: after } = await supabase
        .from("contracts")
        .select("drive_folder_everyone_id, drive_folder_admin_id")
        .eq("id", contractId)
        .single();
      const dbOk =
        after?.drive_folder_everyone_id === everyoneFolderId &&
        after?.drive_folder_admin_id === adminFolderId;
      ctx.step("db.row_updated_with_ids", dbOk, after);
      if (!dbOk) throw new Error("DB row missing folder IDs after API call");

      // 4. Everyone folder at Contracts/<landowner>/<name>/
      const ef = await getItem(drive, everyoneFolderId);
      const ep = await getItem(drive, ef.parents![0]);
      const ePP = await getItem(drive, ep.parents![0]);
      const eOk = ef.name === testName && ep.name === landowner && ePP.name === "Contracts";
      ctx.step("drive.everyone_path", eOk, { folder: ef.name, parent: ep.name, grandparent: ePP.name });
      if (!eOk) throw new Error("Everyone folder not at Contracts/<landowner>/<name>/");

      // 5. Everyone subfolders present
      const ek = await drive.files.list({
        q: `'${everyoneFolderId}' in parents and trashed = false and mimeType = '${FOLDER_MIME}'`,
        fields: "files(name)",
      });
      const ekNames = new Set((ek.data.files ?? []).map((k) => k.name));
      // Maps & Specs is no longer auto-created (May 8 call: empty
      // folder created friction; office adds one by hand when needed).
      // Only "Units" is mandatory now — the unit-ingest scanner uses it.
      const ekOk = ekNames.has("Units");
      ctx.step("drive.everyone_subfolders", ekOk, [...ekNames]);
      if (!ekOk) throw new Error("Everyone missing Units folder");

      // 6. Admin folder path + subfolder
      const af = await getItem(drive, adminFolderId);
      const ap = await getItem(drive, af.parents![0]);
      const aPP = await getItem(drive, ap.parents![0]);
      const aOk = af.name === testName && ap.name === landowner && aPP.name === "Contracts";
      ctx.step("drive.admin_path", aOk, { folder: af.name, parent: ap.name, grandparent: aPP.name });
      if (!aOk) throw new Error("Admin folder not at Contracts/<landowner>/<name>/");

      const ak = await drive.files.list({
        q: `'${adminFolderId}' in parents and trashed = false and mimeType = '${FOLDER_MIME}'`,
        fields: "files(name)",
      });
      const akNames = new Set((ak.data.files ?? []).map((k) => k.name));
      const akOk = akNames.has("Pricing & Originals");
      ctx.step("drive.admin_subfolder", akOk, [...akNames]);
      if (!akOk) throw new Error("Admin missing Pricing & Originals");

      return { ok: true, steps: [], cleanup_ok: true };
    } catch (err) {
      return await withCleanup(err, { contractId, everyoneFolderId, adminFolderId, supabase, drive }, cleanup);
    } finally {
      // Always attempt cleanup (no-op if already cleaned on error path)
      await doCleanup({ contractId, everyoneFolderId, adminFolderId, supabase, drive }, cleanup);
    }
  },
};

async function doCleanup(
  args: { contractId?: string; everyoneFolderId?: string; adminFolderId?: string; supabase: any; drive: any },
  log: string[],
) {
  const { contractId, everyoneFolderId, adminFolderId, supabase, drive } = args;
  if (everyoneFolderId) {
    try {
      await trash(drive, everyoneFolderId);
      log.push("trashed everyone folder");
    } catch (e: any) {
      log.push(`⚠ everyone trash: ${e.message}`);
    }
  }
  if (adminFolderId) {
    try {
      await trash(drive, adminFolderId);
      log.push("trashed admin folder");
    } catch (e: any) {
      log.push(`⚠ admin trash: ${e.message}`);
    }
  }
  if (contractId) {
    const { error } = await supabase.from("contracts").delete().eq("id", contractId);
    if (!error) log.push("deleted contract row");
    else log.push(`⚠ db delete: ${error.message}`);
  }
}

async function withCleanup(err: unknown, args: any, log: string[]) {
  await doCleanup(args, log);
  const cleanup_ok = !log.some((l) => l.startsWith("⚠"));
  return {
    ok: false,
    error: err instanceof Error ? err.message : String(err),
    steps: [],
    cleanup_ok,
    cleanup_note: log.join("; "),
  };
}

export default mod;
