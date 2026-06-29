const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOrigins(value = "") {
  return String(value)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function isSafeJobId(jobId) {
  return SAFE_SEGMENT.test(cleanString(jobId));
}

export function sanitizeFileName(fileName) {
  const raw = cleanString(fileName).split(/[\\/]/).pop() || "";
  const withoutControls = raw.replace(/[\u0000-\u001f\u007f]/g, "");
  const safe = withoutControls.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/\s+/g, " ").trim();
  if (!safe || safe === "." || safe === "..") return "file";
  return safe.slice(0, 180);
}

export function isSafeR2Key(fileKey, { publicSigning = false } = {}) {
  const key = cleanString(fileKey);
  if (!key || key.length > 1024) return false;
  if (key.startsWith("/") || key.includes("\\") || key.includes("//")) return false;
  if (/[\u0000-\u001f\u007f]/.test(key)) return false;

  const decoded = safeDecodeURIComponent(key);
  if (decoded !== key && !isSafeR2Key(decoded, { publicSigning })) return false;

  const segments = key.split("/");
  if (segments.length < 3 || segments[0] !== "jobs") return false;
  if (!isSafeJobId(segments[1])) return false;
  if (segments.some(segment => !segment || segment === "." || segment === "..")) return false;

  if (publicSigning) {
    return segments.length === 5
      && segments[2] === "public-signing"
      && SAFE_SEGMENT.test(segments[3])
      && SAFE_SEGMENT.test(segments[4]);
  }

  return true;
}

export function fileKeyMatchesJob(fileKey, jobId) {
  return isSafeJobId(jobId) && isSafeR2Key(fileKey) && fileKey.startsWith(`jobs/${jobId}/`);
}

export function buildCorsHeaders(request, env = {}) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = parseOrigins(env.ALLOWED_ORIGINS || env.CORS_ALLOWED_ORIGINS || "");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Content-Length, Authorization",
    "Vary": "Origin",
  };

  if (!origin) return headers;
  if (allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function isCorsAllowed(request, env = {}) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return parseOrigins(env.ALLOWED_ORIGINS || env.CORS_ALLOWED_ORIGINS || "").includes(origin);
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
