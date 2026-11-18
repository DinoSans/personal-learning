
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const cookie = req.headers.cookie || "";
    const sessionToken = cookie
      .split(";")
      .map(item => item.trim())
      .find(item => item.startsWith("itb_session="))
      ?.slice("itb_session=".length);

    if (!sessionToken) {
      return res.status(401).json({ error: "Silakan login kembali." });
    }

    const { image } = req.body || {};

    if (typeof image !== "string") {
      return res.status(400).json({ error: "Foto tidak valid." });
    }

    const match = image.match(
      /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
    );

    if (!match) {
      return res.status(400).json({ error: "Format foto harus JPG, PNG, atau WEBP." });
    }

    const imageBuffer = Buffer.from(match[2], "base64");

    if (
      imageBuffer.length === 0 ||
      imageBuffer.length > 3 * 1024 * 1024
    ) {
      return res.status(400).json({ error: "Ukuran foto maksimal 3 MB." });
    }

    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AUTH_API_SECRET}`
    };

    // Validasi session pengguna
    const sessionResponse = await fetch(
      `${process.env.AUTH_API_URL}/session`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ sessionToken })
      }
    );

    const sessionData = await sessionResponse.json();

    if (!sessionResponse.ok || !sessionData.user?.id) {
      return res.status(401).json({ error: "Session tidak valid." });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: "Cloudinary belum dikonfigurasi." });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "itb-quest/profiles";
    const publicId = sessionData.user.id;

    const params = {
      folder,
      overwrite: "true",
      public_id: publicId,
      timestamp: String(timestamp)
    };

    const signatureString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join("&") + apiSecret;

    const signature = crypto
      .createHash("sha1")
      .update(signatureString)
      .digest("hex");

    const form = new URLSearchParams({
      file: image,
      api_key: apiKey,
      timestamp: String(timestamp),
      folder,
      public_id: publicId,
      overwrite: "true",
      signature
    });

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form
      }
    );

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok || !uploadData.secure_url) {
      console.error("Cloudinary upload failed:", uploadData.error?.message);
      return res.status(502).json({ error: "Upload foto ke Cloudinary gagal." });
    }

    // Simpan URL ke akun pengguna
    const saveResponse = await fetch(
      `${process.env.AUTH_API_URL}/profile-photo-save`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          sessionToken,
          photoUrl: uploadData.secure_url
        })
      }
    );

    const saveData = await saveResponse.json();

    if (!saveResponse.ok || !saveData.success) {
      return res.status(502).json({ error: "Foto terunggah, tetapi gagal disimpan ke akun." });
    }

    return res.status(200).json({
      success: true,
      url: uploadData.secure_url
    });

  } catch (error) {
    console.error("Profile photo error:", error);
    return res.status(500).json({ error: "Terjadi kesalahan saat upload foto." });
  }
}
