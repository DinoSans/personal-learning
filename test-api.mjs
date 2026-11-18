const promptId = "f124ed28-8d8e-482b-b662-ff3878aa9f53";

const response = await fetch(
  `http://127.0.0.1:3000/api/image-status?prompt_id=${promptId}`
);

const result = await response.json();

console.log("STATUS:", result.status);

if (result.status === "completed") {
  console.log("GAMBAR BERHASIL DIBUAT!");
  console.log("UKURAN DATA:", result.image.length);
} else {
  console.log("GAMBAR MASIH DIPROSES");
}