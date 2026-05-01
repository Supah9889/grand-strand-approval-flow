import {
  callWorker,
  createContext,
  errorResponse,
  json,
  normalizeReadPayload,
  optionalUser,
  readJson,
  requireJobAccess,
  requirePublicSignatureReadAccess,
  requireReadPermission,
  requireScopedFileKey,
  resolveActor,
} from "../_shared/r2Proxy.js";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const base44 = createContext(req);
    const payload = normalizeReadPayload(await readJson(req));

    if (payload.publicSigning) {
      await requirePublicSignatureReadAccess(base44, payload);
    } else {
      const user = await optionalUser(base44);
      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }
      const actor = await resolveActor(base44, user);
      await requireJobAccess(base44, actor, payload.jobId);
      requireReadPermission(actor);
      requireScopedFileKey(payload.jobId, payload.fileKey);
    }

    const workerResult = await callWorker("/files/read-url", {
      fileKey: payload.fileKey,
      jobId: payload.jobId,
      category: payload.category,
      purpose: payload.purpose,
    });

    return json({
      readUrl: workerResult.signedUrl,
      signedUrl: workerResult.signedUrl,
      fileKey: payload.fileKey,
      r2Key: payload.fileKey,
      expiresIn: workerResult.expiresIn || 300,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
