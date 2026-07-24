const { asyncHandler, ApiError } = require("../middleware/error.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  cloudinary,
  isConfigured: cloudinaryEnabled,
} = require("../config/cloudinary");
const r2 = require("../config/r2");
const bunny = require("../config/bunny");
const mimeTypes = require("mime-types");

// At least one cloud storage provider MUST be configured in production.
// Render's filesystem is ephemeral — local files are lost on every redeploy.
const storageEnabled = r2.isConfigured || bunny.isConfigured || cloudinaryEnabled;
if (process.env.NODE_ENV === "production" && !storageEnabled) {
  console.error(
    "\n🚨 CRITICAL: No cloud storage configured but NODE_ENV=production!",
  );
  console.error(
    "   Uploads will fail because the server filesystem is ephemeral.",
  );
  console.error(
    "   Set R2_* (files/images) and BUNNY_* (videos) env vars — see DEPLOYMENT.md.",
  );
}

// ── Helper: detect file type from extension ──────────────────────────────────
const detectFileType = (originalname) => {
  const ext = path.extname(originalname).toLowerCase().slice(1);
  if (/jpeg|jpg|png|gif|webp/.test(ext)) return "image";
  if (/mp4|webm|ogg|mov|avi/.test(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (/pptx?/.test(ext)) return "ppt";
  if (/docx?/.test(ext)) return "doc";
  return "file";
};

// ── Helper: Cloudinary resource_type from file type ──────────────────────────
const getCloudinaryResourceType = (fileType) => {
  if (fileType === "image") return "image";
  if (fileType === "video") return "video";
  return "raw"; // PDFs, docs, etc.
};

// ── Storage: local disk ────────────────────────────────────────────────────────
// Always use local disk storage temporarily to prevent Node.js Out of Memory
// crashes on large video uploads. We stream the file to disk first.
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: localStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => cb(null, true),
});

// Re-export a second multer instance for project uploads (same config)
const projectUpload = multer({
  storage: localStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => cb(null, true),
});

// ── Multer error handler wrapper ─────────────────────────────────────────────
// Turns multer-level errors (e.g. file too large) into clean JSON 400 responses
// instead of letting them propagate as unhandled 500s.
const handleMulterError = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({
          success: false,
          message: "File too large. Maximum allowed size is 500 MB.",
        });
    }
    return res
      .status(400)
      .json({ success: false, message: err.message || "File upload error" });
  });
};

// ── Upload a file to Cloudinary (returns { url, publicId }) ──────────────────
const uploadToCloudinary = async (filePath, originalname) => {
  const fileType = detectFileType(originalname);
  const resourceType = getCloudinaryResourceType(fileType);
  const folder = `cradema/${fileType === "image" ? "images" : fileType === "video" ? "videos" : "files"}`;

  console.log(`☁️  Uploading to Cloudinary: ${originalname} (${resourceType})`);

  const uploadOptions = {
    resource_type: resourceType,
    folder,
    // Keep original extension for raw files so download links work
    ...(resourceType === "raw"
      ? { use_filename: true, unique_filename: true }
      : {}),
  };

  // For videos, force transcoding to H.264/MP4 for universal mobile compatibility.
  // Also enable large file chunking logic natively supported by the Cloudinary SDK when passing a file path.
  if (resourceType === "video") {
    uploadOptions.format = "mp4";
    uploadOptions.chunk_size = 6000000; // Chunk threshold (6 MB) for streaming large files
  }

  try {
    // Upload from temp local path. The SDK handles large file chunks via upload_large automatically if over chunk_size
    const uploaderFn =
      resourceType === "video"
        ? cloudinary.uploader.upload_large
        : cloudinary.uploader.upload;
    const result = await uploaderFn(filePath, uploadOptions);

    let deliveryUrl = result.secure_url;
    // Just save unsigned URLs natively into the database. 
    // They will be dynamically signed by `signCloudinaryUrl()` upon retrieval.
    if (resourceType === "video" && !deliveryUrl.endsWith(".mp4")) {
      // Ensure the video URL ends with .mp4 for mobile compatibility
      deliveryUrl = deliveryUrl.replace(/\.[^/.]+$/, ".mp4");
    }
    console.log(`✅ Cloudinary upload success: ${deliveryUrl}`);
    return { url: deliveryUrl, publicId: result.public_id };
  } catch (error) {
    console.error("❌ Cloudinary upload failed:", error.message || error);
    throw new Error(
      `Cloudinary upload failed: ${error.message || "Unknown error"}`,
    );
  }
};

// ── Provider resolution ───────────────────────────────────────────────────────
// Videos:      Bunny Stream (transcoding + adaptive HLS) → R2 → Cloudinary → local
// Everything else: R2 (zero egress) → Cloudinary → local
const resolveProvider = (fileType) => {
  if (fileType === "video") {
    if (bunny.isConfigured) return "bunny";
    if (r2.isConfigured) return "r2";
    if (cloudinaryEnabled) return "cloudinary";
    return "local";
  }
  if (r2.isConfigured) return "r2";
  if (cloudinaryEnabled) return "cloudinary";
  return "local";
};

const r2Folder = (fileType) =>
  fileType === "image" ? "images" : fileType === "video" ? "videos" : "files";

// ── Upload a local temp file to whichever provider is configured ─────────────
// Returns { url, publicId? }. Used by the backend-proxy upload route and by
// projects / practice-submissions controllers.
const uploadToStorage = async (filePath, originalname) => {
  const fileType = detectFileType(originalname);
  const provider = resolveProvider(fileType);

  if (provider === "bunny") {
    console.log(`🎬 Uploading to Bunny Stream: ${originalname}`);
    const videoId = await bunny.createVideo(originalname);
    const url = await bunny.uploadLocalFile(videoId, filePath);
    console.log(`✅ Bunny upload success: ${url}`);
    return { url, publicId: videoId };
  }

  if (provider === "r2") {
    const key = r2.makeKey(r2Folder(fileType), originalname);
    const contentType = mimeTypes.lookup(originalname) || "application/octet-stream";
    console.log(`📦 Uploading to R2: ${originalname} → ${key}`);
    const url = await r2.uploadLocalFile(filePath, key, contentType);
    console.log(`✅ R2 upload success: ${url}`);
    return { url, publicId: key };
  }

  if (provider === "cloudinary") {
    return uploadToCloudinary(filePath, originalname);
  }

  throw new Error("No cloud storage provider configured");
};

// ── Helper: sign a Cloudinary URL so restricted raw resources are accessible ─
// Cloudinary accounts with "Restrict unsigned raw resource delivery" return 401
// for unsigned /raw/upload/ URLs. This function re-generates the URL using the
// SDK with `sign_url: true` so a valid signature is appended.
const signCloudinaryUrl = (url) => {
  if (!url || !cloudinaryEnabled) return url;

  // Only handle res.cloudinary.com URLs
  if (!url.includes('res.cloudinary.com')) return url;

  // Strip any existing signature (s--...--) before re-signing
  // This handles both unsigned URLs and previously-signed (now expired) URLs
  const strippedUrl = url.replace(/\/s--[A-Za-z0-9_-]+--/, '');

  const match = strippedUrl.match(
    /res\.cloudinary\.com\/([^/]+)\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)/
  );
  if (!match) return url;

  const [, , resourceType, publicIdWithExt] = match;

  // Extract version if present (just the digits, avoiding 'vv123' bug)
  const versionMatch = strippedUrl.match(/\/upload\/v(\d+)\//);
  const version = versionMatch ? versionMatch[1] : undefined;

  try {
    // For raw resources blocked by "Restrict unsigned access", res.cloudinary.com CDN URLs 
    // strictly return 401 even with an `s--` signature unless they were uploaded explicitly as
    // `type: "authenticated"`. To download an existing "upload" raw asset, we MUST use the
    // Cloudinary Management API via private_download_url.
    if (resourceType === 'raw') {
      const signed = cloudinary.utils.private_download_url(publicIdWithExt, '', {
        resource_type: resourceType,
        type: 'upload',
        attachment: true,  // tells Cloudinary to set Content-Disposition: attachment
        expires_at: Math.floor(Date.now() / 1000) + 3153600
      });
      return signed;
    }

    // For images/videos, standard URL signing works perfectly.
    const signed = cloudinary.url(publicIdWithExt, {
      resource_type: resourceType,
      sign_url: true,
      type: 'upload',
      secure: true,
      ...(version ? { version } : {}),
      expires_at: Math.floor(Date.now() / 1000) + 31536000 // 1 year expiry
    });
    return signed;
  } catch (err) {
    console.error('signCloudinaryUrl failed:', err.message);
    return url;
  }
};

// ── Route handler: POST /api/v1/upload ───────────────────────────────────────
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No file uploaded");
  }

  const fileType = detectFileType(req.file.originalname);
  let fileUrl;

  if (storageEnabled) {
    // Upload temporary disk file to the configured provider (Bunny/R2/Cloudinary)
    try {
      const result = await uploadToStorage(
        req.file.path,
        req.file.originalname,
      );
      fileUrl = result.url;

      // Clean up the temporary local file on success
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Tidying local file failed:", err.message);
      });
    } catch (err) {
      console.error(
        "❌ Cloud upload failed for",
        req.file.originalname,
        err.message,
      );
      // Clean up the temporary local file on failure
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr)
          console.error("Tidying local file failed:", unlinkErr.message);
      });
      throw new ApiError(500, "File upload failed. Please try again later.");
    }
  } else if (process.env.NODE_ENV === "production") {
    // In production without cloud storage, reject the upload because the local disk erases on deploy
    fs.unlink(req.file.path, () => { });
    console.error(
      "❌ Upload rejected: no cloud storage configured in production",
    );
    throw new ApiError(
      503,
      "File uploads are temporarily unavailable. Cloud storage is not configured.",
    );
  } else {
    // Local disk — file was kept saved by multer diskStorage (dev only fallback)
    // Return a fully qualified URL so the frontend doesn't depend on a proxy
    const origin = `${req.protocol}://${req.get('host')}`;
    fileUrl = `${origin}/uploads/${req.file.filename}`;
  }

  res.json({
    success: true,
    data: {
      url: fileUrl,
      filename: req.file.filename || path.basename(fileUrl),
      originalName: req.file.originalname,
      fileType,
    },
  });
});

// ── Proxy download: stream a remote file to the client with correct filename ─
const downloadFile = asyncHandler(async (req, res) => {
  const { url, filename } = req.query;

  if (!url) {
    throw new ApiError(400, 'Missing "url" query parameter');
  }

  // Determine the best filename. `filename` query param is authoritative.
  // Fall back to extracting from the URL path if not provided.
  let downloadName = filename || '';
  if (!downloadName) {
    try {
      downloadName = decodeURIComponent(path.basename(new URL(url).pathname));
    } catch {
      downloadName = 'download';
    }
  }

  // If downloadName has no extension, try to extract one from the raw URL path
  // BEFORE the URL gets signed (private_download_url loses the CDN path extension).
  if (!path.extname(downloadName)) {
    try {
      const urlPath = new URL(url).pathname.replace(/\/s--[A-Za-z0-9_-]+--/, '');
      const ext = path.extname(urlPath);
      if (ext && ext !== '.') downloadName = downloadName + ext;
    } catch { /* ignore */ }
  }

  // ── Cloudinary Admin API fallback ──────────────────────────────────────────
  // If we STILL have no extension (old files uploaded without use_filename:true
  // have a random public_id with no extension in the URL), call the Cloudinary
  // Admin API to get the format stored at upload time (e.g. 'xlsx', 'pdf').
  // A simple Map cache prevents repeated API calls for the same public_id.
  if (!path.extname(downloadName) && cloudinaryEnabled && url.includes('res.cloudinary.com')) {
    try {
      const strippedPath = new URL(url).pathname.replace(/\/s--[A-Za-z0-9_-]+--/, '');
      const rawMatch = strippedPath.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/);
      if (rawMatch && rawMatch[1] === 'raw' && !path.extname(rawMatch[2])) {
        const publicId = rawMatch[2];
        // Check simple LRU cache first
        if (!downloadFile._formatCache) downloadFile._formatCache = new Map();
        let fmt = downloadFile._formatCache.get(publicId);
        if (!fmt) {
          const info = await cloudinary.api.resource(publicId, { resource_type: 'raw' }).catch(() => null);
          fmt = info && info.format ? info.format : '';
          if (fmt) {
            // Cap cache at 500 entries
            if (downloadFile._formatCache.size >= 500) {
              const firstKey = downloadFile._formatCache.keys().next().value;
              downloadFile._formatCache.delete(firstKey);
            }
            downloadFile._formatCache.set(publicId, fmt);
          }
        }
        if (fmt) {
          downloadName = downloadName + '.' + fmt;
          console.log(`ℹ️  Admin API format lookup: ${publicId} → .${fmt}`);
        }
      }
    } catch { /* Admin API failed — keep going without extension */ }
  }

  // --- Local uploads (served from /uploads/) ---
  if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
    const safePath = path.normalize(url.replace(/^\//, ""));
    const filePath = path.join(__dirname, "../../", safePath);

    // Prevent directory traversal
    const uploadsDir = path.resolve(__dirname, "../../uploads");
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(uploadsDir)) {
      throw new ApiError(403, "Access denied");
    }

    if (!fs.existsSync(resolved)) {
      throw new ApiError(404, "File not found");
    }

    // Ensure the filename has the correct extension
    const ext = path.extname(downloadName) || path.extname(resolved);
    const finalName = path.extname(downloadName) ? downloadName : downloadName + ext;
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(finalName)}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    return fs.createReadStream(resolved).pipe(res);
  }

  // --- Remote URL (Cloudinary, etc.) ---
  // Sign Cloudinary URLs that are NOT already signed to bypass access restrictions.
  // Already-signed URLs (containing s--...--) must NOT be re-signed: double-signing
  // corrupts the public_id extraction and produces a 404 from Cloudinary.
  const fetchUrl = signCloudinaryUrl(url);

  console.log(`📥 Download proxy → ${fetchUrl.substring(0, 100)}...`);

  const https = require("https");
  const http = require("http");

  // Follow up to 3 redirects (Cloudinary management API can chain through multiple hops)
  function followRedirects(targetUrl, hopsLeft, callback) {
    const protocol = targetUrl.startsWith("https") ? https : http;
    protocol
      .get(targetUrl, (resp) => {
        if (
          hopsLeft > 0 &&
          resp.statusCode >= 300 && resp.statusCode < 400 &&
          resp.headers.location
        ) {
          resp.resume(); // drain the redirect body before following
          followRedirects(resp.headers.location, hopsLeft - 1, callback);
        } else {
          callback(resp);
        }
      })
      .on("error", (err) => {
        console.error(`Download proxy fetch error: ${err.message} | url=${targetUrl.substring(0, 120)}`);
        res.status(502).json({ success: false, message: "Failed to download file" });
      });
  }

  followRedirects(fetchUrl, 3, (finalRes) => {
    if (finalRes.statusCode !== 200) {
      console.error(`Download proxy ${finalRes.statusCode}: fetchUrl=${fetchUrl.substring(0, 120)} | originalUrl=${url.substring(0, 120)}`);
    }
    streamResponse(finalRes, res, downloadName, url);
  });
});

// ── Magic-bytes file type detection ──────────────────────────────────────────
// Detects file format by reading the first bytes of the actual binary content.
// This is the definitive fallback for old extensionless Cloudinary uploads.
function detectExtFromMagicBytes(buf) {
  if (!buf || buf.length < 4) return '';

  // PDF: starts with %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return '.pdf';
  }

  // ZIP-based (PK\x03\x04) — could be .xlsx, .pptx, .docx, or plain .zip
  if (buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04) {
    // Peek at internal filenames in the ZIP local file headers to distinguish Office formats.
    // ZIP local header: offset 26 = filename length (2 bytes LE), offset 30+ = filename
    const str = buf.toString('ascii', 0, Math.min(buf.length, 4096));
    if (str.includes('xl/')) return '.xlsx';
    if (str.includes('ppt/')) return '.pptx';
    if (str.includes('word/')) return '.docx';
    if (str.includes('[Content_Types].xml')) return '.xlsx'; // generic Office fallback
    return '.zip';
  }

  // OLE Compound (D0 CF 11 E0) — .xls, .doc, .ppt (legacy Office)
  if (buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0) {
    // Heuristic: check for Excel-specific strings in first 4KB
    const str = buf.toString('ascii', 0, Math.min(buf.length, 4096));
    if (str.includes('Workbook') || str.includes('Book')) return '.xls';
    if (str.includes('PowerPoint')) return '.ppt';
    if (str.includes('Word')) return '.doc';
    return '.xls'; // most common legacy Office file
  }

  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return '.png';
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return '.jpg';
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return '.gif';

  return ''; // unknown
}

// MIME lookup table
const EXT_TO_MIME = {
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

function streamResponse(proxyRes, res, downloadName, originalUrl) {
  if (proxyRes.statusCode !== 200) {
    console.error(`Download proxy: upstream returned ${proxyRes.statusCode} for ${originalUrl}`);
    res.status(proxyRes.statusCode || 502).json({ success: false, message: "File not available" });
    return;
  }

  // ── Determine extension from metadata (fast, no buffering) ──────────────────
  let ext = path.extname(downloadName);

  if (!ext) {
    try {
      const parsed = new URL(originalUrl);
      const cleanPath = parsed.pathname.replace(/\/s--[A-Za-z0-9_-]+--/, '');
      ext = path.extname(cleanPath);
      if (!ext) {
        const publicId = parsed.searchParams.get('public_id');
        if (publicId) ext = path.extname(decodeURIComponent(publicId));
      }
    } catch { /* ignore */ }
  }

  if (!ext) {
    const upstreamDisp = proxyRes.headers['content-disposition'];
    if (upstreamDisp) {
      const m = upstreamDisp.match(/filename[^;=\n]*=["']?([^"';\n]+)/i);
      if (m) ext = path.extname(m[1].trim());
    }
  }

  // If we already know the extension, send headers immediately and stream
  if (ext && ext !== '.') {
    sendWithExtension(ext);
    proxyRes.pipe(res);
    return;
  }

  // ── Extension still unknown — buffer first 4KB and detect via magic bytes ───
  const chunks = [];
  let buffered = 0;
  const PEEK_SIZE = 4096;

  proxyRes.on('data', onData);
  proxyRes.on('end', onEnd);
  proxyRes.on('error', onError);

  function onData(chunk) {
    chunks.push(chunk);
    buffered += chunk.length;

    if (buffered >= PEEK_SIZE) {
      // We have enough data to detect the file type
      proxyRes.removeListener('data', onData);
      proxyRes.removeListener('end', onEnd);
      proxyRes.removeListener('error', onError);

      const head = Buffer.concat(chunks);
      const detected = detectExtFromMagicBytes(head);
      if (detected) {
        console.log(`🔍 Magic bytes detected: ${downloadName} → ${detected}`);
      }
      sendWithExtension(detected);
      res.write(head);
      proxyRes.pipe(res);
    }
  }

  function onEnd() {
    // File was smaller than PEEK_SIZE — still try to detect
    const head = Buffer.concat(chunks);
    const detected = detectExtFromMagicBytes(head);
    if (detected) {
      console.log(`🔍 Magic bytes detected (small file): ${downloadName} → ${detected}`);
    }
    sendWithExtension(detected);
    res.end(head);
  }

  function onError(err) {
    console.error(`Download proxy stream error: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ success: false, message: "Failed to download file" });
    }
  }

  function sendWithExtension(detectedExt) {
    let finalName = downloadName;
    if (detectedExt && !path.extname(finalName)) {
      finalName = finalName + detectedExt;
    }

    const fileExt = path.extname(finalName).toLowerCase();
    const contentType = (fileExt && EXT_TO_MIME[fileExt])
      ? EXT_TO_MIME[fileExt]
      : 'application/octet-stream';

    res.setHeader("Content-Type", contentType);
    if (proxyRes.headers["content-length"]) {
      res.setHeader("Content-Length", proxyRes.headers["content-length"]);
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(finalName)}"; filename*=UTF-8''${encodeURIComponent(finalName)}`
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  }
}

// ── Signed upload params for direct browser-to-storage uploads ───────────────
// The response is tagged with `provider` so the frontend knows which upload
// protocol to use:
//   bunny      → TUS resumable upload to video.bunnycdn.com (videos)
//   r2         → presigned PUT to Cloudflare R2 (images, docs, everything else)
//   cloudinary → legacy signed form upload (fallback while migrating)
const getUploadSignature = asyncHandler(async (req, res) => {
  if (!storageEnabled) {
    throw new ApiError(503, "Cloud storage is not configured");
  }

  const { fileType, filename } = req.query; // 'image', 'video', 'pdf', etc.
  const detectedType = fileType || "file";
  const provider = resolveProvider(detectedType);

  // ── Bunny Stream (videos) ──────────────────────────────────────────────────
  if (provider === "bunny") {
    const videoId = await bunny.createVideo(filename || "lesson-video");
    const { signature, expiration, tusEndpoint } = bunny.getTusSignature(videoId);
    return res.json({
      success: true,
      data: {
        provider: "bunny",
        libraryId: bunny.LIBRARY_ID,
        videoId,
        signature,
        expiration,
        tusEndpoint,
        playbackUrl: bunny.hlsUrl(videoId),
        thumbnailUrl: bunny.thumbnailUrl(videoId),
      },
    });
  }

  // ── Cloudflare R2 (presigned PUT) ──────────────────────────────────────────
  if (provider === "r2") {
    const name = filename || `upload.${detectedType === "image" ? "png" : "bin"}`;
    const key = r2.makeKey(r2Folder(detectedType), name);
    const contentType = mimeTypes.lookup(name) || "application/octet-stream";
    const uploadUrl = await r2.getPresignedPutUrl(key, contentType);
    return res.json({
      success: true,
      data: {
        provider: "r2",
        uploadUrl,
        publicUrl: r2.publicUrl(key),
        key,
        contentType,
      },
    });
  }

  // ── Cloudinary (legacy fallback) ───────────────────────────────────────────
  const resourceType = getCloudinaryResourceType(detectedType);
  const folder = `cradema/${detectedType === "image" ? "images" : detectedType === "video" ? "videos" : "files"}`;

  const timestamp = Math.round(Date.now() / 1000);
  // NOTE: resource_type must NOT be included in the signed params — it is part
  // of the upload URL, not the form body.  Including it causes an "Invalid
  // Signature" 401 because Cloudinary's server-side verification never sees it
  // as a form field and therefore excludes it from its own string-to-sign.
  const params = {
    timestamp,
    folder,
    ...(resourceType === "video" ? { format: "mp4" } : {}),
    ...(resourceType === "raw"
      ? { use_filename: true, unique_filename: true }
      : {}),
  };

  // Generate the signature
  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET,
  );

  res.json({
    success: true,
    data: {
      provider: "cloudinary",
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      folder,
      resourceType,
      ...(resourceType === "video" ? { format: "mp4" } : {}),
      ...(resourceType === "raw"
        ? { use_filename: "true", unique_filename: "true" }
        : {}),
    },
  });
});

// ── Bunny encoding status ────────────────────────────────────────────────────
// Bunny returns HTTP 403 on a video's playlist.m3u8 until transcoding is
// finished (and permanently if it failed). The player uses this endpoint to
// tell "still processing" apart from "genuinely broken", show a real progress
// %, and auto-retry once the video becomes playable — instead of the misleading
// "hosted externally" error.
//   ready   — playlist should now play
//   failed  — encoding failed / upload failed (needs re-upload)
//   unknown — not a Bunny video, or status could not be determined (assume ready)
const getVideoEncodingStatus = asyncHandler(async (req, res) => {
  const { url, videoId } = req.query;

  if (!bunny.isConfigured) {
    return res.json({ success: true, data: { ready: true, unknown: true } });
  }

  const id = videoId || bunny.videoIdFromUrl(url || "");
  if (!id) {
    // Not a Bunny-hosted video (e.g. Cloudinary/MP4/external) — nothing to wait on.
    return res.json({ success: true, data: { ready: true, unknown: true } });
  }

  try {
    const info = await bunny.getVideoStatus(id);
    const status = Number(info.status);
    const encodeProgress = Number(info.encodeProgress) || 0;
    // Bunny status: 5 = Error, 6 = UploadFailed
    const failed = status === 5 || status === 6;
    // Playable once transcoding reports finished. encodeProgress is the reliable
    // cross-check regardless of the library's exact status numbering.
    const ready = !failed && (status >= 4 || encodeProgress >= 100);
    return res.json({
      success: true,
      data: { ready, failed, status, encodeProgress },
    });
  } catch (err) {
    // If the Bunny API is unreachable, don't block playback — let the player try.
    console.warn("Bunny status lookup failed:", err.message);
    return res.json({ success: true, data: { ready: true, unknown: true } });
  }
});

module.exports = {
  upload,
  projectUpload,
  uploadFile,
  downloadFile,
  uploadToCloudinary,
  uploadToStorage,
  detectFileType,
  cloudinaryEnabled,
  storageEnabled,
  handleMulterError,
  getUploadSignature,
  getVideoEncodingStatus,
  signCloudinaryUrl,
};
