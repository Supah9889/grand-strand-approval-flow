import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireEnv(name) {
  const value = Deno.env.get(name);
  if (!value) throw Object.assign(new Error(`Missing env: ${name}`), { status: 500 });
  return value;
}

function getSigningGrantSecret() {
  return Deno.env.get("SIGNING_GRANT_SECRET") || requireEnv("R2_WORKER_AUTH_SECRET");
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(signature);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

async function verifySigningGrant(token) {
  if (!token || !token.includes(".")) throw Object.assign(new Error("Unauthorized: signing token is required"), { status: 401 });
  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = await hmac(encodedPayload, getSigningGrantSecret());
  if (!constantTimeEqual(signature, expectedSignature)) throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload?.jobId || Number(payload.exp) < Math.floor(Date.now() / 1000)) throw new Error("Invalid grant payload");
    if (payload.scope && payload.scope !== "job-signature") throw new Error("Invalid grant scope");
    return payload;
  } catch {
    throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  }
}

function getJobCompanyIds(job) {
  return [job?.company_id, job?.origin_company_id, job?.assigned_company_id, job?.performing_company_id].filter(Boolean);
}

function signingContext(job, grant) {
  const companyId = getJobCompanyIds(job)[0] || grant.companyId || "";
  return {
    job,
    customer: {
      name: job.customer_name || "",
      email: job.customer_email || job.email || "",
      phone: job.customer_phone || job.phone || "",
    },
    signingPurpose: "job-signature",
    companyId,
    expiresAt: new Date(Number(grant.exp) * 1000).toISOString(),
    canSign: !(job.locked || job.status === "approved"),
  };
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
    const token = cleanString(body.token || body.signingToken || body.signatureToken || body.approvalToken);
    const grant = await verifySigningGrant(token);

    const base44 = createClientFromRequest(req);
    const entities = base44.asServiceRole?.entities || base44.entities;
    const jobs = await entities.Job.filter({ id: grant.jobId }).catch(() => []);
    const job = jobs?.[0];
    if (!job) throw Object.assign(new Error("Job not found"), { status: 404 });

    const companyIds = getJobCompanyIds(job);
    if (grant.companyId && companyIds.length && !companyIds.includes(grant.companyId)) {
      throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
    }

    return json(signingContext(job, grant));
  } catch (error) {
    return errorResponse(error);
  }
});
