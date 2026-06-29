/**
 * Grand Strand Approval Flow - Cloudflare Worker
 * Handles secure signed URL generation for private R2 file storage.
 * AUTH_SECRET must be set via: npx wrangler secret put AUTH_SECRET
 * Never hardcode secrets here or in frontend code.
 */

import {
  buildCorsHeaders,
  fileKeyMatchesJob,
  isCorsAllowed,
  isSafeJobId,
  isSafeR2Key,
  sanitizeFileName,
} from "./security.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      if (!isCorsAllowed(request, env)) {
        return json({ error: "CORS origin is not allowed" }, corsHeaders, 403);
      }
      return new Response(null, { headers: corsHeaders });
    }

    if (!["GET", "POST", "PUT"].includes(request.method)) {
      return json({ error: "Method not allowed" }, corsHeaders, 405);
    }

    // Health check - no auth required
    if (request.method === "GET" && pathname === "/health") {
      return json({ status: "ok" }, corsHeaders);
    }

    // Public signing uploads use a signed, short-lived Worker URL instead of direct R2 presigned PUTs.
    if (request.method === "PUT" && pathname === "/files/public-signing-upload") {
      try {
        const uploadToken = url.searchParams.get("token");
        const uploadGrant = await verifyUploadToken(uploadToken, env.AUTH_SECRET);
        if (!uploadGrant) {
          return json({ error: "Unauthorized" }, corsHeaders, 401);
        }

        if (!isSafeR2Key(uploadGrant.fileKey, { publicSigning: true })) {
          return json({ error: "Unauthorized" }, corsHeaders, 401);
        }

        const contentLengthHeader = request.headers.get("Content-Length");
        if (!contentLengthHeader || !/^\d+$/.test(contentLengthHeader.trim())) {
          return json({ error: "Content-Length is required" }, corsHeaders, 411);
        }

        const contentLength = Number(contentLengthHeader);
        if (!Number.isFinite(contentLength) || contentLength < 0) {
          return json({ error: "Invalid Content-Length" }, corsHeaders, 400);
        }

        if (contentLength > uploadGrant.maxSize) {
          return json({ error: "Uploaded file exceeds the public signing size limit" }, corsHeaders, 413);
        }

        const contentType = request.headers.get("Content-Type") || "";
        if (contentType !== uploadGrant.fileType) {
          return json({ error: "Content-Type is not allowed for this upload" }, corsHeaders, 403);
        }

        const existing = await env.PRIVATE_FILES.head(uploadGrant.fileKey);
        if (existing) {
          return json({ error: "Upload URL has already been used" }, corsHeaders, 409);
        }

        await env.PRIVATE_FILES.put(uploadGrant.fileKey, request.body, {
          httpMetadata: {
            contentType,
          },
        });

        return json({
          ok: true,
          fileKey: uploadGrant.fileKey,
          size: contentLength,
        }, corsHeaders);
      } catch (err) {
        console.error("public-signing-upload error:", err);
        return json({ error: "Internal server error" }, corsHeaders, 500);
      }
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

        if (!isSafeJobId(jobId)) {
          return json({ error: "Invalid job id" }, corsHeaders, 400);
        }

        const safeFileName = sanitizeFileName(fileName);
        const uuid = crypto.randomUUID();
        const fileKey = `jobs/${jobId}/${uuid}-${safeFileName}`;
        if (!isSafeR2Key(fileKey)) {
          return json({ error: "Invalid upload key" }, corsHeaders, 400);
        }

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
        if (!isSafeR2Key(fileKey) || (body.jobId && !fileKeyMatchesJob(fileKey, body.jobId))) {
          return json({ error: "Invalid file key" }, corsHeaders, 400);
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

    // POST /files/public-signing-upload-url
    if (request.method === "POST" && pathname === "/files/public-signing-upload-url") {
      try {
        const body = await request.json();
        const { fileKey, fileType } = body;
        const maxSize = Number(body.maxSize);
        const expiresIn = Math.min(Number(body.expiresIn) || 300, 300);

        if (!fileKey || !fileType || !Number.isFinite(maxSize) || maxSize <= 0) {
          return json({ error: "Missing required fields: fileKey, fileType, maxSize" }, corsHeaders, 400);
        }

        if (!isSafeR2Key(fileKey, { publicSigning: true })) {
          return json({ error: "Invalid public signing upload key" }, corsHeaders, 400);
        }

        const tokenPayload = {
          fileKey,
          fileType,
          maxSize,
          exp: Math.floor(Date.now() / 1000) + expiresIn,
        };
        const token = await signUploadToken(tokenPayload, env.AUTH_SECRET);
        const uploadUrl = new URL("/files/public-signing-upload", request.url);
        uploadUrl.searchParams.set("token", token);

        return json({ uploadUrl: uploadUrl.toString(), fileKey, expiresIn }, corsHeaders);
      } catch (err) {
        console.error("public-signing-upload-url error:", err);
        return json({ error: "Internal server error" }, corsHeaders, 500);
      }
    }

    // POST /files/head
    if (request.method === "POST" && pathname === "/files/head") {
      try {
        const body = await request.json();
        const { fileKey } = body;

        if (!fileKey) {
          return json({ error: "Missing required field: fileKey" }, corsHeaders, 400);
        }
        if (!isSafeR2Key(fileKey) || (body.jobId && !fileKeyMatchesJob(fileKey, body.jobId))) {
          return json({ error: "Invalid file key" }, corsHeaders, 400);
        }

        const object = await env.PRIVATE_FILES.head(fileKey);
        if (!object) {
          return json({ error: "File not found" }, corsHeaders, 404);
        }

        return json({
          fileKey,
          size: object.size,
          uploaded: object.uploaded,
          httpMetadata: object.httpMetadata || {},
        }, corsHeaders);
      } catch (err) {
        console.error("head error:", err);
        return json({ error: "Internal server error" }, corsHeaders, 500);
      }
    }

    // POST /files/delete
    if (request.method === "POST" && pathname === "/files/delete") {
      try {
        const body = await request.json();
        const { fileKey } = body;

        if (!fileKey) {
          return json({ error: "Missing required field: fileKey" }, corsHeaders, 400);
        }
        if (!isSafeR2Key(fileKey) || (body.jobId && !fileKeyMatchesJob(fileKey, body.jobId))) {
          return json({ error: "Invalid file key" }, corsHeaders, 400);
        }

        await env.PRIVATE_FILES.delete(fileKey);
        return json({ ok: true, fileKey }, corsHeaders);
      } catch (err) {
        console.error("delete error:", err);
        return json({ error: "Internal server error" }, corsHeaders, 500);
      }
    }

    return json({ error: "Not found" }, corsHeaders, 404);
  },
};

async function signUploadToken(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmac(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifyUploadToken(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = await hmac(encodedPayload, secret);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload?.fileKey || !payload?.fileType || !Number.isFinite(Number(payload?.maxSize))) return null;
    if (Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return {
      fileKey: payload.fileKey,
      fileType: payload.fileType,
      maxSize: Number(payload.maxSize),
    };
  } catch {
    return null;
  }
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(signature);
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}

function json(data, extraHeaders = {}, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
