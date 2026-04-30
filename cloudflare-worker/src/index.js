/**
 * Grand Strand Approval Flow - Cloudflare Worker
 * Handles secure signed URL generation for private R2 file storage.
 * AUTH_SECRET must be set via: npx wrangler secret put AUTH_SECRET
 * Never hardcode secrets here or in frontend code.
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

    // Health check - no auth required
    if (request.method === "GET" && pathname === "/health") {
      return json({ status: "ok" }, corsHeaders);
    }

    // Auth check for all other routes
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token || token !== env.AUTH_SECRET) {
      return json({ error: "Unauthorized" }, corsHeaders, 401);
    }

    // POST /files/upload-url
    if (request.method === "POST" && pathname === "/files/upload-url") {
      try {
        const body = await request.json();
        const { fileName, fileType, jobId, uploadedBy } = body;

        if (!fileName || !fileType || !jobId || !uploadedBy) {
          return json({ error: "Missing required fields: fileName, fileType, jobId, uploadedBy" }, corsHeaders, 400);
        }

        const uuid = crypto.randomUUID();
        const fileKey = `jobs/${jobId}/${uuid}-${fileName}`;

        const uploadUrl = await env.PRIVATE_FILES.createPresignedUrl(fileKey, {
          method: "PUT",
          expiresIn: 300,
        });

        return json({ uploadUrl, fileKey }, corsHeaders);
      } catch (err) {
        console.error("upload-url error:", err);
        return json({ error: "Internal server error" }, corsHeaders, 500);
      }
    }

    // POST /files/read-url
    if (request.method === "POST" && pathname === "/files/read-url") {
      try {
        const body = await request.json();
        const { fileKey } = body;

        if (!fileKey) {
          return json({ error: "Missing required field: fileKey" }, corsHeaders, 400);
        }

        const signedUrl = await env.PRIVATE_FILES.createPresignedUrl(fileKey, {
          method: "GET",
          expiresIn: 300,
        });

        return json({ signedUrl }, corsHeaders);
      } catch (err) {
        console.error("read-url error:", err);
        return json({ error: "Internal server error" }, corsHeaders, 500);
      }
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
