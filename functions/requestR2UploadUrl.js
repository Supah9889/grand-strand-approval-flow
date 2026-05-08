import {
  callWorker,
  createPublicSignatureUpload,
  createContext,
  errorResponse,
  json,
  normalizeUploadPayload,
  normalizeUploadVerificationPayload,
  optionalUser,
  readJson,
  requireJobAccess,
  requireUploadPermission,
  resolveActor,
  verifyPublicSignatureUploadedObject,
} from "./_shared/r2Proxy.js";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const base44 = createContext(req);
    const body = await readJson(req);
    if (body.action === "verify_public_signature_upload") {
      const payload = normalizeUploadVerificationPayload(body);
      const result = await verifyPublicSignatureUploadedObject(base44, payload);
      return json({
        ok: true,
        fileKey: result.fileKey,
        r2Key: result.fileKey,
        size: result.size,
        maxSize: result.maxSize,
      });
    }

    const payload = normalizeUploadPayload(body);
    let uploadedBy = "Public signer";

    if (payload.publicSigning) {
      const publicUpload = await createPublicSignatureUpload(base44, payload);
      return json({
        uploadUrl: publicUpload.uploadUrl,
        fileKey: publicUpload.fileKey,
        r2Key: publicUpload.fileKey,
        uploadSessionId: publicUpload.uploadSessionId,
        expiresIn: publicUpload.expiresIn,
        metadata: {
          job_id: payload.jobId,
          file_name: payload.fileName,
          file_type: payload.fileType,
          category: payload.category,
          storage_provider: "r2",
          r2_key: publicUpload.fileKey,
          uploaded_by_name: uploadedBy,
        },
      });
    } else {
      const user = await optionalUser(base44);
      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }
      const actor = await resolveActor(base44, user);

      await requireJobAccess(base44, actor, payload.jobId);
      requireUploadPermission(actor, payload.category);
      uploadedBy = actor.name;
    }

    const workerResult = await callWorker("/files/upload-url", {
      fileName: payload.fileName,
      fileType: payload.fileType,
      jobId: payload.jobId,
      uploadedBy,
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
        uploaded_by_name: uploadedBy,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
