/**
 * Test: Drive env vars are well-formed and service account can reach each root.
 *
 * Explicitly catches the April 16 failure mode: trailing whitespace in
 * GOOGLE_DRIVE_*_FOLDER_ID env vars on Vercel. Would have fired long before
 * Jaime noticed.
 */
import type { TestContext, TestModule } from "./_types";
import { getDriveClient, canRead, trimEnv } from "./_drive";

const DRIVE_ID_LEN_RANGE: [number, number] = [20, 60]; // Drive IDs are ~33 chars; allow some flex

const ENV_VARS_TO_CHECK = [
  { key: "GOOGLE_DRIVE_EVERYONE_FOLDER_ID", testRead: true },
  { key: "GOOGLE_DRIVE_ADMIN_FOLDER_ID", testRead: true },
  { key: "GOOGLE_DRIVE_EVERYONE_CONTRACTS_ID", testRead: true },
  { key: "GOOGLE_DRIVE_ADMIN_CONTRACTS_ID", testRead: true },
  { key: "GOOGLE_DRIVE_FOLDER_ID", testRead: true },
];

const mod: TestModule = {
  name: "drive-env-health",
  description: "Drive env vars are clean (no trailing whitespace) and service account can read each root",
  severity: "critical",

  async run(ctx: TestContext) {
    const drive = getDriveClient();
    const failures: string[] = [];

    for (const { key, testRead } of ENV_VARS_TO_CHECK) {
      const raw = process.env[key];
      const trimmed = trimEnv(key);

      // Presence
      if (!raw) {
        ctx.step(`${key}.present`, false, "missing");
        failures.push(`${key} missing`);
        continue;
      }
      ctx.step(`${key}.present`, true);

      // Shape: no trailing/leading whitespace
      const cleanShape = raw === trimmed;
      ctx.step(`${key}.no_whitespace`, cleanShape, cleanShape ? undefined : { rawLen: raw.length, trimmedLen: trimmed?.length });
      if (!cleanShape) failures.push(`${key} has leading/trailing whitespace (raw=${raw.length} vs trimmed=${trimmed?.length})`);

      // Length in expected range
      const lenOk = !!trimmed && trimmed.length >= DRIVE_ID_LEN_RANGE[0] && trimmed.length <= DRIVE_ID_LEN_RANGE[1];
      ctx.step(`${key}.length_ok`, lenOk, { length: trimmed?.length });
      if (!lenOk) failures.push(`${key} length ${trimmed?.length} outside ${DRIVE_ID_LEN_RANGE[0]}–${DRIVE_ID_LEN_RANGE[1]}`);

      // Service account can actually read it
      if (testRead && trimmed) {
        const ok = await canRead(drive, trimmed);
        ctx.step(`${key}.service_account_read`, ok);
        if (!ok) failures.push(`${key}: service account cannot read (${trimmed})`);
      }
    }

    if (failures.length === 0) return { ok: true, steps: [], cleanup_ok: true };
    return {
      ok: false,
      error: `${failures.length} check(s) failed: ${failures.join("; ")}`,
      steps: [],
      cleanup_ok: true, // no mutations — nothing to clean
    };
  },
};

export default mod;
