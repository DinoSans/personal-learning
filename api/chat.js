
import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "JARVIS belum dikonfigurasi."
    });
  }

  const { message } = req.body ?? {};

  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 4000
  ) {
    return res.status(400).json({
      error: "Pesan tidak valid atau terlalu panjang."
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message.trim(),
      config: {
        systemInstruction: `
          Kamu adalah JARVIS, tutor pribadi di aplikasi ITB QUEST.

          Karaktermu:
          - Ramah, sabar, dan suportif.
          - Gunakan bahasa Indonesia yang natural.
          - Jelaskan materi secara bertahap dan mudah dipahami.
          - Bantu siswa memahami Matematika, Fisika,
            Informatika, dan persiapan masuk STEI ITB.
          - Jangan langsung memberikan jawaban tanpa
            penjelasan jika siswa sedang belajar.
          - Jika siswa bingung, berikan contoh sederhana.
          - Jangan mengarang fakta.
        `,
        maxOutputTokens: 500
      }
    });

    return res.status(200).json({
      reply: response.text || "Maaf, JARVIS belum bisa menjawab."
    });

  } catch (error) {
    console.error("JARVIS API error:", error);

    return res.status(500).json({
      error: "Maaf, JARVIS sedang mengalami gangguan."
    });
  }
}
