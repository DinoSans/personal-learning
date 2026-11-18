
export default async function handler(req, res) {
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
      })
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
