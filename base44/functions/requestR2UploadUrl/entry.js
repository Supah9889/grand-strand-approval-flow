import {
  callWorker,
  createContext,
  errorResponse,
  json,
  normalizeUploadPayload,
  readJson,
  requireJobAccess,
  requireUploadPermission,
  requireUser,
  resolveActor,
} from "../_shared/r2Proxy.js";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const base44 = createContext(req);
    const user = await requireUser(base44);
    const actor = await resolveActor(base44, user);
    const payload = normalizeUploadPayload(await readJson(req));

    await requireJobAccess(base44, actor, payload.jobId);
    requireUploadPermission(actor, payload.category);

    const workerResult = await callWorker("/files/upload-url", {
      fileName: payload.fileName,
      fileType: payload.fileType,
      jobId: payload.jobId,
      uploadedBy: actor.name,
      category: payload.category,
      purpose: payload.purpose,
      fileSize: payload.fileSize,
    });

    return json({
      uploadUrl: workerResult.uploadUrl,
      fileKey: workerResult.fileKey,
      r2Key: workerResult.fileKey,
      expiresIn: workerResult.expiresIn || 300,
      metadata: {
        job_id: payload.jobId,
        file_name: payload.fileName,
        file_type: payload.fileType,
        file_size: payload.fileSize,
        category: payload.category,
        storage_provider: "r2",
        r2_key: workerResult.fileKey,
        uploaded_by_name: actor.name,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
