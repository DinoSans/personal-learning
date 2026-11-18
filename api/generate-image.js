
const COOKIE_NAME = "itb_session";

function getSessionToken(req) {
  const cookies = req.headers.cookie || "";
  const item = cookies
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(COOKIE_NAME + "="));

  return item
    ? decodeURIComponent(item.slice(COOKIE_NAME.length + 1))
    : "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const prompt = req.body?.prompt;

    if (
      typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > 2000
    ) {
      return res.status(400).json({
        error: "Deskripsi gambar tidak valid."
      });
    }

    // CEK SESSION
    const sessionToken = getSessionToken(req);

    if (!sessionToken) {
      return res.status(401).json({
        error: "Silakan login terlebih dahulu."
      });
    }

    // CEK KUOTA GAMBAR HARIAN
    const authUrl = process.env.AUTH_API_URL;
    const authSecret = process.env.AUTH_API_SECRET;

    if (!authUrl || !authSecret) {
      return res.status(500).json({
        error: "Konfigurasi autentikasi tidak ditemukan."
      });
    }

    const quotaResponse = await fetch(
      `${authUrl.replace(/\/+$/, "")}/consume-image`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authSecret}`
        },
        body: JSON.stringify({ sessionToken }),
        signal: AbortSignal.timeout(10000)
      }
    );

    const quotaData = await quotaResponse.json();

    if (!quotaResponse.ok) {
      return res.status(quotaResponse.status).json(quotaData);
    }

    // GENERATE GAMBAR MELALUI CLOUDFLARE
    const workerUrl = process.env.CLOUDFLARE_IMAGE_URL;
    const secret = process.env.IMAGE_API_SECRET;

    if (!workerUrl || !secret) {
      return res.status(500).json({
        error: "Konfigurasi Cloudflare belum lengkap."
      });
    }

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`
      },
      body: JSON.stringify({
        prompt: prompt.trim()
      }),
      signal: AbortSignal.timeout(60000)
    });

    const result = await response.json();

    if (!response.ok || !result.success || !result.image) {
      console.error("CLOUDFLARE ERROR:", result);

      return res.status(response.status || 502).json({
        error: result.error || "Cloudflare gagal membuat gambar."
      });
    }

    return res.status(200).json({
      success: true,
      image: result.image,
      message: "Gambar berhasil dibuat!"
    });

  } catch (error) {
    console.error("IMAGE API ERROR:", error);

    return res.status(500).json({
      error: "JARVIS gagal menghubungi layanan gambar."
    });
  }
}
