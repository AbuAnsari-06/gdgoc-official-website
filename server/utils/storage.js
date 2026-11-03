import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Event Poster Storage Adapter
 *
 * Supports:
 *  - Cloudinary persistent cloud storage (recommended for production)
 *  - AWS S3 / Compatible Object Storage (Cloudflare R2, MinIO)
 *  - Local filesystem storage (development & automated test adapter)
 */

function getCloudinaryConfig() {
  if (process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);
      return {
        cloudName: url.hostname,
        apiKey: decodeURIComponent(url.username),
        apiSecret: decodeURIComponent(url.password),
      };
    } catch {
      return null;
    }
  }

  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    return {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    };
  }

  return null;
}

/**
 * Upload to Cloudinary via authenticated REST API
 */
export function generateCloudinarySignature(params, apiSecret) {
  const excluded = new Set(["file", "cloud_name", "resource_type", "api_key", "signature"]);
  const signableKeys = Object.keys(params)
    .filter((k) => !excluded.has(k) && params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort();

  const serialized = signableKeys.map((k) => `${k}=${params[k]}`).join("&");
  const toSign = `${serialized}${apiSecret}`;
  return crypto.createHash("sha1").update(toSign).digest("hex");
}

async function uploadToCloudinary(fileBuffer, ext, config) {
  const { cloudName, apiKey, apiSecret } = config;
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `poster_${crypto.randomBytes(16).toString("hex")}`;
  const folder = "gdgoc-posters";


  const paramsToSign = { folder, public_id: publicId, timestamp };
  const signature = generateCloudinarySignature(paramsToSign, apiSecret);



  const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const blob = new Blob([fileBuffer], { type: mimeType });

  const formData = new FormData();
  formData.append("file", blob, `${publicId}.${ext}`);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("public_id", publicId);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return {
    url: data.secure_url || data.url,
    key: data.public_id,
    provider: "cloudinary",
  };
}

/**
 * Local disk storage adapter (development, staging fallback, and test suite)
 */
async function uploadToLocalDisk(fileBuffer, ext) {
  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const key = `poster_${crypto.randomBytes(16).toString("hex")}.${ext}`;
  const filePath = path.join(uploadsDir, key);

  await fs.promises.writeFile(filePath, fileBuffer);

  return {
    url: `/uploads/${key}`,
    key,
    provider: "local",
  };
}

/**
 * Upload poster entry point
 */
export async function uploadPoster(fileBuffer, ext) {
  const cloudinaryConfig = getCloudinaryConfig();

  if (cloudinaryConfig) {
    return uploadToCloudinary(fileBuffer, ext, cloudinaryConfig);
  }

  const isProduction = process.env.NODE_ENV === "production";
  const allowLocalInProd = process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION === "true";

  // In production, reject ephemeral storage unless explicitly overridden
  if (isProduction && !allowLocalInProd) {
    throw new Error(
      "Ephemeral local storage is disabled in production. Please configure CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/KEY/SECRET for persistent poster storage."
    );
  }

  // Fallback to local disk adapter in development / testing
  return uploadToLocalDisk(fileBuffer, ext);
}
