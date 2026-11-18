const ALLOWED_ORIGINS = [
  "https://personal-learning-delta.vercel.app",
  ...(process.env.NODE_ENV !== "production"
    ? [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
      ]
    : [])
];

const COOKIE_NAME = "itb_session";

function getCookie(req, name) {
  const cookies = req.headers.cookie || "";

  const item = cookies
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(name + "="));

  return item
    ? decodeURIComponent(item.slice(name.length + 1))
    : "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  if (
  req.headers.origin &&
  !ALLOWED_ORIGINS.includes(req.headers.origin)
) {
    return res.status(403).json({
      error: "Origin tidak diizinkan."
    });
  }

  const authUrl = process.env.AUTH_API_URL;
  const authSecret = process.env.AUTH_API_SECRET;
  const sessionToken = getCookie(req, COOKIE_NAME);

  if (!authUrl || !authSecret) {
    return res.status(500).json({
      error: "Konfigurasi server belum lengkap."
    });
  }

  if (!sessionToken) {
    return res.status(401).json({
      error: "Silakan login terlebih dahulu."
    });
  }

  try {
    const action = req.method === "GET" ? "progress-get" : "progress-save";

    const response = await fetch(
      `${authUrl.replace(/\/+$/, "")}/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authSecret}`
        },
        body: JSON.stringify({
  ...(req.method === "POST" ? req.body : {}),
  sessionToken
}),
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await response.json();

    return res.status(response.status).json(data);

  } catch (error) {
    console.error("Progress API error:", error);

    return res.status(502).json({
      error: "Server progress tidak dapat dihubungi."
    });
  }
}