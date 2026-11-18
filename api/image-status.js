
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const { prompt_id } = req.query;

  if (
    typeof prompt_id !== "string" ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(prompt_id)
  ) {
    return res.status(400).json({
      error: "Prompt ID tidak valid."
    });
  }

  try {
    // Periksa status generate ComfyUI
    const historyResponse = await fetch(
      `http://127.0.0.1:8188/history/${encodeURIComponent(prompt_id)}`
    );

    if (!historyResponse.ok) {
      throw new Error("Gagal mengambil riwayat ComfyUI.");
    }

    const history = await historyResponse.json();
    const job = history[prompt_id];

    if (!job) {
      return res.status(200).json({
        status: "processing"
      });
    }

    if (job.status?.status_str === "error") {
      return res.status(500).json({
        error: "ComfyUI gagal menghasilkan gambar."
      });
    }

    // Ambil gambar dari output workflow
    const outputs = job.outputs ?? {};

    const images = Object.values(outputs)
      .flatMap(output => output.images ?? []);

    if (images.length === 0) {
      return res.status(200).json({
        status: "processing"
      });
    }

    const imageInfo = images[0];

    const params = new URLSearchParams({
      filename: imageInfo.filename,
      subfolder: imageInfo.subfolder ?? "",
      type: imageInfo.type ?? "output"
    });

    // Download gambar dari ComfyUI
    const imageResponse = await fetch(
      `http://127.0.0.1:8188/view?${params.toString()}`
    );

    if (!imageResponse.ok) {
      throw new Error("Gagal mengambil file gambar.");
    }

    const buffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    return res.status(200).json({
      status: "completed",
      image: `data:image/png;base64,${buffer.toString("base64")}`
    });

  } catch (error) {
    console.error("IMAGE STATUS ERROR:", error);

    return res.status(500).json({
      error: "Gagal mengambil hasil gambar JARVIS."
    });
  }
}
