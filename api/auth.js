
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
const COOKIE_AGE = 7 * 24 * 60 * 60;

function setCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_AGE}`
  );
}

function clearCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
}

function getCookie(req, name) {
  const cookies = req.headers.cookie || "";

  const item = cookies
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(name + "="));

  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  if (!ALLOWED_ORIGINS.includes(req.headers.origin)) {
    return res.status(403).json({
      error: "Origin tidak diizinkan."
    });
  }

  const authUrl = process.env.AUTH_API_URL;
  const authSecret = process.env.AUTH_API_SECRET;

console.log("AUTH CONFIG CHECK:", {
  urlExists: Boolean(authUrl),
  secretExists: Boolean(authSecret),
  nodeEnv: process.env.NODE_ENV
});
  if (!authUrl || !authSecret) {
    return res.status(500).json({
      error: "Konfigurasi autentikasi belum lengkap."
    });
  }

  const { action, email, password } = req.body || {};

  const allowedActions = [
    "register",
    "login",
    "session",
    "logout"
  ];

  if (!allowedActions.includes(action)) {
    return res.status(400).json({
      error: "Action tidak valid."
    });
  }

  const sessionToken = getCookie(req, COOKIE_NAME);

  if (
    (action === "session" || action === "logout") &&
    !sessionToken
  ) {
    return res.status(401).json({
      error: "Belum login."
    });
  }

  if (
    (action === "register" || action === "login") &&
    (typeof email !== "string" ||
     typeof password !== "string")
  ) {
    return res.status(400).json({
      error: "Email atau password tidak valid."
    });
  }

  const payload = {
    email,
    password,
    sessionToken
  };

  try {
    const response = await fetch(
      `${authUrl.replace(/\/+$/, "")}/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authSecret}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      }
    );

    const data = await response.json();
    console.log("AUTH WORKER RESPONSE:", {
  status: response.status,
  success: data.success,
  error: data.error || null
});

    if (!response.ok) {
      if (
        action === "session" &&
        response.status === 401
      ) {
        clearCookie(res);
      }

      return res.status(response.status).json({
        error: data.error || "Autentikasi gagal."
      });
    }

    if (
      action === "register" ||
      action === "login"
    ) {
      if (!data.sessionToken) {
        return res.status(502).json({
          error: "Session tidak berhasil dibuat."
        });
      }

      setCookie(res, data.sessionToken);

      return res.status(200).json({
        success: true,
        user: data.user,
        expiresAt: data.expiresAt
      });
    }

    if (action === "logout") {
      clearCookie(res);

      return res.status(200).json({
        success: true
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Auth proxy error:", error);

    return res.status(502).json({
      error: "Server autentikasi tidak dapat dihubungi."
    });
  }
}
