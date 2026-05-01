import {
  createContext,
  createSigningGrant,
  errorResponse,
  json,
  readJson,
  requireJobAccess,
  requireUser,
  resolveActor,
} from "../_shared/r2Proxy.js";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await readJson(req);
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
    if (!jobId) {
      return json({ error: "Missing required field: jobId" }, 400);
    }

    const base44 = createContext(req);
    const user = await requireUser(base44);
    const actor = await resolveActor(base44, user);
    const job = await requireJobAccess(base44, actor, jobId);
    if (job.locked || job.status === "approved") {
      return json({ error: "Job has already been signed" }, 403);
    }

    const token = await createSigningGrant(jobId);
    return json({
      token,
      expiresIn: 7 * 24 * 60 * 60,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
