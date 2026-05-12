/**
 * Email formatter + sender for the test suite report.
 *
 * Uses Resend. Sender is onboarding@resend.dev during dry-run phase;
 * switch to a verified domain before adding Jaime to the recipient list.
 */
import { Resend } from "resend";
import type { SuiteReport, TestResult } from "./_types";
import { trimEnv } from "./_drive";

const FROM = "Cascadia Tests <onboarding@resend.dev>";

export async function sendReportEmail(report: SuiteReport): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = trimEnv("RESEND_API_KEY");
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY missing" };

  const recipientsRaw = trimEnv("TEST_SUITE_RECIPIENTS");
  if (!recipientsRaw) return { ok: false, error: "TEST_SUITE_RECIPIENTS missing" };
  const recipients = recipientsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const resend = new Resend(apiKey);
  const subject = buildSubject(report);
  const html = buildHtml(report);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: recipients,
      subject,
      html,
    });
    if (error) return { ok: false, error: typeof error === "string" ? error : JSON.stringify(error) };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function buildSubject(r: SuiteReport): string {
  const date = new Date(r.started_at).toISOString().slice(0, 10);
  if (r.critical_failures > 0) return `❌ ${r.critical_failures} critical failing — Cascadia/Ramos ${date}`;
  if (r.failed > 0) return `⚠️ ${r.failed}/${r.total} tests warning — Cascadia/Ramos ${date}`;
  return `✅ ${r.passed}/${r.total} tests pass — Cascadia/Ramos ${date}`;
}

function statusEmoji(r: TestResult): string {
  if (r.ok) return "✅";
  return r.severity === "critical" ? "❌" : "⚠️";
}

function rowStyle(r: TestResult): string {
  if (r.ok) return "";
  return r.severity === "critical" ? "background:#fee2e2;" : "background:#fef3c7;";
}

function buildHtml(r: SuiteReport): string {
  const date = new Date(r.started_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" });
  const durS = (r.duration_ms / 1000).toFixed(1);

  const rows = r.results
    .map(
      (t) => `
        <tr style="${rowStyle(t)}">
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${statusEmoji(t)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>${escape(t.name)}</strong><br><span style="color:#6b7280;font-size:12px">${escape(t.description)}</span></td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${t.duration_ms}ms</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#991b1b;">${t.ok ? "" : escape(t.error || "(no error message)")}</td>
        </tr>
      `,
    )
    .join("");

  const leaks =
    r.cleanup_leaks > 0
      ? `
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:16px 0;">
          <strong>⚠️ ${r.cleanup_leaks} test(s) left residue</strong> — cleanup didn't fully run. Check Drive trash + DB for test artifacts.
        </div>
      `
      : "";

  const summary =
    r.critical_failures > 0
      ? `<div style="background:#fee2e2;border-left:4px solid #dc2626;padding:12px;margin:16px 0;"><strong>${r.critical_failures} critical failure(s)</strong> — something client-visible is broken.</div>`
      : r.failed > 0
        ? `<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;margin:16px 0;"><strong>${r.failed} warning(s)</strong> — worth eyeballing, not client-blocking.</div>`
        : `<div style="background:#d1fae5;border-left:4px solid #10b981;padding:12px;margin:16px 0;"><strong>All green.</strong> ${r.passed}/${r.total} passed in ${durS}s.</div>`;

  const comingSoon = `
    <h3 style="color:#6b7280;margin-top:32px;">Coming to this report</h3>
    <ul style="color:#6b7280;font-size:14px;line-height:1.6;">
      <li>Timesheet full-lifecycle (create → submit → approve → hours aggregate → delete)</li>
      <li>RLS policy enforcement checks</li>
      <li>Expense ingest post-conditions (after weekly cron fires)</li>
      <li>Bid workflow health — once Bids page ships (Phase 2 Item 6)</li>
      <li>Payroll calculation integrity — once payroll engine lands</li>
      <li>Equipment + crew assignment checks</li>
      <li>Telegram bot reachability</li>
    </ul>
  `;

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;padding:20px;color:#111827;">
      <h2 style="margin:0 0 4px 0;">Cascadia / Ramos — Daily Test Report</h2>
      <div style="color:#6b7280;font-size:14px;">${date}</div>

      ${summary}
      ${leaks}

      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:left;width:32px;"></th>
            <th style="padding:8px;text-align:left;">Test</th>
            <th style="padding:8px;text-align:left;">Duration</th>
            <th style="padding:8px;text-align:left;">Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="color:#6b7280;font-size:12px;margin-top:16px;">
        Run ID: <code>${escape(r.run_id)}</code> • Total: ${durS}s
      </div>

      ${comingSoon}
    </div>
  `;
}

function escape(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
