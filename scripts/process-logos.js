const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const brandDir = path.join(__dirname, "..", "public", "brand");
const SIZE = 512;

async function removeBg(inputPath, mode) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (mode === "white") {
      if (r > 240 && g > 240 && b > 240) data[i + 3] = 0;
    } else if (r < 28 && g < 28 && b < 28) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 10 })
    .png()
    .toBuffer();
}

async function fitSquare(buf, outPath) {
  await sharp(buf)
    .resize(SIZE, SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPath);
}

async function main() {
  const servicosSrc = path.join(brandDir, "daan-servicos-original.png");
  const imagemSrc = path.join(brandDir, "daan-imagem-original.png");
  const servicosOut = path.join(brandDir, "daan-servicos-transparent.png");
  const imagemOut = path.join(brandDir, "daan-imagem-transparent.png");

  const servicosBuf = await removeBg(servicosSrc, "white");
  const imagemBuf = await removeBg(imagemSrc, "black");

  await fitSquare(servicosBuf, servicosOut);
  await fitSquare(imagemBuf, imagemOut);

  // substitui os arquivos principais
  fs.copyFileSync(servicosOut, path.join(brandDir, "daan-servicos.png"));
  fs.copyFileSync(imagemOut, path.join(brandDir, "daan-imagem.png"));

  const s = await sharp(servicosOut).metadata();
  const i = await sharp(imagemOut).metadata();
  console.log("ok", {
    servicos: `${s.width}x${s.height}`,
    imagem: `${i.width}x${i.height}`,
    hasAlpha: s.hasAlpha && i.hasAlpha,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
