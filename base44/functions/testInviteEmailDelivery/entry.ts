import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const RESEND_FROM = "onboarding@gscustompainting.com";
const TEST_SUBJECT = "Grand Strand Operations — Invite Email Test";

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizeRole(value) {
  const role = clean(value).toLowerCase();
  if (["owner", "admin", "manager", "office", "field", "staff"].includes(role)) return role;
  return "field";
}

function getEntities(base44) {
  return base44.asServiceRole?.entities || base44.entities;
}

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const entities = getEntities(base44);
  const email = normalizeEmail(user.email || user.email_address || user.username);
  const employees = email ? await entities.Employee.filter({ email }).catch(() => []) : [];
  const employee = employees.find((record) => record.active !== false) || null;
  const role = normalizeRole(employee?.role || user.role || user.app_role);
  if (role !== "owner" && role !== "admin") {
    throw Object.assign(new Error("Forbidden: admin access is required"), { status: 403 });
  }
  return { name: employee?.name || user.full_name || user.name || email || "Admin", email };
}

function safeProviderError(result) {
  if (!result) return "Unknown provider error";
  if (typeof result.message === "string") return result.message.slice(0, 200);
  if (typeof result.error === "string") return result.error.slice(0, 200);
  return "Provider returned an error";
}

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { attempted: false, delivered: false, provider: "none", id: "", error: "RESEND_API_KEY not configured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html, text }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.id) {
      console.log(`[invite-email-test] resend ok to=${to} id=${result.id}`);
      return { attempted: true, delivered: true, provider: "resend", id: result.id, error: "" };
    }
    const safeError = safeProviderError(result);
    console.log(`[invite-email-test] resend failed to=${to} error=${safeError}`);
    return { attempted: true, delivered: false, provider: "resend", id: "", error: safeError };
  } catch (error) {
    console.log(`[invite-email-test] resend exception to=${to} error=${error.message || "network error"}`);
    return { attempted: true, delivered: false, provider: "resend", id: "", error: "Email delivery error" };
  }
}

function errorResponse(error) {
  const status = Number(error?.status) || 500;
  const message = status >= 500 ? "Internal server error" : error.message;
  if (status >= 500) console.error(error);
  return json({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson(req);
    const to = normalizeEmail(body.to);
    if (!to) return json({ error: "Recipient email (to) is required." }, 400);

    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);

    const html = [
      `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">`,
      `<h2 style="color: #0f766e;">Invite Email Test</h2>`,
      `<p>This is a test email from Grand Strand Operations to verify that invite email delivery is working.</p>`,
      `<p style="font-size: 13px; color: #64748b;">If you received this, Resend is configured correctly.</p>`,
      `</div>`,
    ].join("");
    const text = [
      `Invite Email Test`,
      ``,
      `This is a test email from Grand Strand Operations to verify that invite email delivery is working.`,
      ``,
      `If you received this, Resend is configured correctly.`,
    ].join("\n");

    const emailResult = await sendViaResend({ to, subject: TEST_SUBJECT, html, text });

    return json({
      ok: true,
      createdEmployee: false,
      createdInvite: false,
      email: emailResult,
    });
  } catch (error) {
    return errorResponse(error);
  }
});