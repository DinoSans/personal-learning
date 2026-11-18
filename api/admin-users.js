const COOKIE_NAME = "itb_session";

const ALLOWED_ORIGINS = [
  "https://personal-learning-delta.vercel.app"
];

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
      error: "Method not allowed."
    });
  }

  const origin = req.headers.origin;

  if (
    origin &&
    !ALLOWED_ORIGINS.includes(origin)
  ) {
    return res.status(403).json({
      error: "Origin tidak diizinkan."
    });
  }

  const sessionToken = getSessionToken(req);

  if (!sessionToken) {
    return res.status(401).json({
      error: "Silakan login terlebih dahulu."
    });
  }

  try {
    const authUrl = process.env.AUTH_API_URL;
    const authSecret = process.env.AUTH_API_SECRET;

    if (!authUrl || !authSecret) {
      return res.status(500).json({
        error: "Konfigurasi autentikasi tidak ditemukan."
      });
    }

    const response = await fetch(
      `${authUrl.replace(/\/+$/, "")}/admin-users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authSecret}`
        },
        body: JSON.stringify({
          sessionToken
        }),
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await response.json();

    return res.status(response.status).json(data);

  } catch (error) {
    console.error("ADMIN API ERROR:", error);

    return res.status(503).json({
      error: "Layanan admin sedang tidak tersedia."
    });
  }
}