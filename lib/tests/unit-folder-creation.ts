/**
 * Test: unit folder creation.
 *
 * Exercises /api/drive/unit-folder/route.ts — a separate code path from
 * project-creation. Creates a throwaway contract + throwaway unit, asserts
 * the unit folder lands at Everyone/.../Units/<unit-name>/, tears down.
 */
import type { TestContext, TestModule } from "./_types";
import { getDriveClient, getItem, trash } from "./_drive";
import { serviceRoleClient } from "./_supabase";

const mod: TestModule = {
  name: "unit-folder-creation",
  description: "Creating a unit writes a Drive folder under the project's Units/ folder",
  severity: "critical",

  async run(ctx: TestContext) {
    const supabase = serviceRoleClient();
    const drive = getDriveClient();
    const contractName = `__CLAUDE_TEST_${ctx.runId}`;
    const unitName = `TEST_UNIT_${ctx.runId}`;

    let contractId: string | undefined;
    let unitId: string | undefined;
    let everyoneFolderId: string | undefined;
    let adminFolderId: string | undefined;
    let unitFolderId: string | undefined;
    const cleanup: string[] = [];

    try {
      // Setup: contract + its Drive folders
      const { data: cRow, error: cErr } = await supabase
        .from("contracts")
        .insert({ name: contractName, landowner: "Bidding", status: "active" })
        .select("id")
        .single();
      if (cErr) throw new Error(`DB insert contract: ${cErr.message}`);
      contractId = cRow.id;

      const fRes = await fetch(`${ctx.baseUrl}/api/drive/contract-folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, contractName, landowner: "Bidding" }),
      });
      const fBody = await fRes.json();
      if (!fRes.ok) throw new Error(`contract-folders api ${fRes.status}: ${JSON.stringify(fBody)}`);
      everyoneFolderId = fBody.everyoneFolderId;
      adminFolderId = fBody.adminFolderId;
      ctx.step("setup.contract_folders_ok", true);

      // Insert unit row
      const { data: uRow, error: uErr } = await supabase
        .from("units")
        .insert({ name: unitName, contract_id: contractId })
        .select("id")
        .single();
      if (uErr) throw new Error(`DB insert unit: ${uErr.message}`);
      unitId = uRow.id;
      ctx.step("db.insert_unit", true, { unitId });

      // Call unit-folder endpoint
      const res = await fetch(`${ctx.baseUrl}/api/drive/unit-folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, unitName, contractId }),
      });
      const body = await res.json();
      ctx.step("api.unit_folder_status", res.ok, { status: res.status, body });
      if (!res.ok) throw new Error(`unit-folder api ${res.status}: ${JSON.stringify(body)}`);

      unitFolderId = body.folderId || body.unitFolderId;
      if (!unitFolderId) throw new Error(`no folder ID in response: ${JSON.stringify(body)}`);

      // Walk Drive: unit folder → parent should be named "Units" → grandparent = contract
      const uf = await getItem(drive, unitFolderId);
      const up = await getItem(drive, uf.parents![0]);
      const uPP = await getItem(drive, up.parents![0]);
      const pathOk = uf.name === unitName && up.name === "Units" && uPP.name === contractName;
      ctx.step("drive.unit_path", pathOk, { folder: uf.name, parent: up.name, grandparent: uPP.name });
      if (!pathOk) throw new Error("Unit folder not at contract/Units/<unit>/");

      // DB row stored the folder ID
      const { data: after } = await supabase
        .from("units")
        .select("drive_folder_id")
        .eq("id", unitId)
        .single();
      const dbOk = after?.drive_folder_id === unitFolderId;
      ctx.step("db.unit_row_updated", dbOk, after);
      if (!dbOk) throw new Error("Unit DB row missing drive_folder_id");

      return { ok: true, steps: [], cleanup_ok: true };
    } catch (err) {
      await doCleanup({ supabase, drive, contractId, unitId, everyoneFolderId, adminFolderId, unitFolderId }, cleanup);
      const cleanup_ok = !cleanup.some((l) => l.startsWith("⚠"));
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        steps: [],
        cleanup_ok,
        cleanup_note: cleanup.join("; "),
      };
    } finally {
      await doCleanup({ supabase, drive, contractId, unitId, everyoneFolderId, adminFolderId, unitFolderId }, cleanup);
    }
  },
};

async function doCleanup(args: any, log: string[]) {
  const { supabase, drive, contractId, unitId, everyoneFolderId, adminFolderId, unitFolderId } = args;
  // unit first, then contract
  for (const [id, label] of [
    [unitFolderId, "unit folder"],
    [everyoneFolderId, "everyone folder"],
    [adminFolderId, "admin folder"],
  ] as const) {
    if (id) {
      try {
        await trash(drive, id);
        log.push(`trashed ${label}`);
      } catch (e: any) {
        log.push(`⚠ ${label} trash: ${e.message}`);
      }
    }
  }
  if (unitId) {
    const { error } = await supabase.from("units").delete().eq("id", unitId);
    if (!error) log.push("deleted unit row");
    else log.push(`⚠ unit delete: ${error.message}`);
  }
  if (contractId) {
    const { error } = await supabase.from("contracts").delete().eq("id", contractId);
    if (!error) log.push("deleted contract row");
    else log.push(`⚠ contract delete: ${error.message}`);
  }
}

export default mod;
