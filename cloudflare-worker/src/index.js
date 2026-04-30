/**
 * Grand Strand Approval Flow - Cloudflare Worker
 *
 * Purpose: Secure file access API for private Cloudflare R2 storage.
 * The app (React/Vite/Base44) will call this Worker to get short-lived
 * signed URLs for uploads and reads. R2 credentials are NEVER exposed
 * to the frontend or stored in source code.
 *
 * Current state: Skeleton only. Not connected to R2 yet.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET" && pathname === "/health") {
      return json({ status: "ok" }, corsHeaders);
    }

    if (request.method === "POST" && pathname === "/files/upload-url") {
      // TODO: Parse request body for { fileName, fileType, jobId, uploadedBy }
      // TODO: Verify caller is authenticated and has upload permission for the job
      // TODO: Generate a private R2 key, e.g. jobs/{jobId}/documents/{uuid}-{fileName}
      // TODO: Call env.PRIVATE_FILES.createMultipartUpload() or use presigned URL pattern
      // TODO: Return { uploadUrl, fileKey } so the app can PUT directly to R2
      return json({ status: "not_implemented", message: "Upload URL generation not yet wired to R2." }, corsHeaders, 501);
    }

    if (request.method === "POST" && pathname === "/files/read-url") {
      // TODO: Parse request body for { fileKey, jobId }
      // TODO: Verify caller is authenticated and has read permission for the job
      // TODO: Call env.PRIVATE_FILES.createSignedUrl(fileKey, { expiresIn: 300 })
      // TODO: Return { signedUrl } so the app can render the file temporarily
      return json({ status: "not_implemented", message: "Read URL generation not yet wired to R2." }, corsHeaders, 501);
    }

    return json({ error: "Not found" }, corsHeaders, 404);
  },
};

function json(data, extraHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
