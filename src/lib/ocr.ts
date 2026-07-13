import type { ExpenseCategory } from "./types";
import {
  normalizeOcrText,
  parseBrazilianAmount,
  parseExpenseDate,
  parseInvoiceNumber,
  parseMerchantName,
  suggestCategory,
  type OcrExpenseResult,
} from "./ocr-parsers";

export type { OcrExpenseResult };
export {
  normalizeOcrText,
  parseBrazilianAmount,
  parseExpenseDate,
  parseInvoiceNumber,
  parseMerchantName,
  suggestCategory,
} from "./ocr-parsers";

type WorkerLike = {
  setParameters: (p: Record<string, unknown>) => Promise<void>;
  recognize: (
    img: unknown,
  ) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<void>;
};

let sharedWorker: WorkerLike | null = null;
let workerPromise: Promise<WorkerLike> | null = null;

async function getWorker(): Promise<WorkerLike> {
  if (sharedWorker) return sharedWorker;
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = (await createWorker("por")) as unknown as WorkerLike;
      sharedWorker = worker;
      return worker;
    })();
  }
  return workerPromise;
}

/** Pré-carrega o OCR (chamar ao abrir "Nova despesa"). */
export async function warmupOcr(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await getWorker();
  } catch {
    // ignore
  }
}

type PreprocessMode = "binary" | "contrast" | "soft";

async function loadBitmap(
  imageSource: File | Blob | string,
): Promise<ImageBitmap> {
  if (typeof imageSource === "string") {
    return createImageBitmap(await (await fetch(imageSource)).blob());
  }
  return createImageBitmap(imageSource);
}

async function preprocessVariant(
  imageSource: File | Blob | string,
  mode: PreprocessMode,
): Promise<Blob> {
  const bitmap = await loadBitmap(imageSource);
  const maxWidth = 2000;
  const scale =
    bitmap.width > maxWidth
      ? maxWidth / bitmap.width
      : Math.max(1.4, 1400 / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return imageSource instanceof Blob
      ? imageSource
      : await (await fetch(imageSource as string)).blob();
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const mean = sum / (data.length / 4);
  const threshold = mode === "soft" ? mean * 0.95 : mean * 0.9;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (mode === "contrast") {
      const c = Math.max(0, Math.min(255, (gray - mean) * 1.8 + 128));
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
    } else {
      const v = gray < threshold ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }

  ctx.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  return blob ?? (imageSource instanceof Blob ? imageSource : new Blob());
}

function voteValue<T extends string | number>(
  values: Array<T | null | undefined>,
): T | null {
  const counts = new Map<T, number>();
  for (const value of values) {
    if (value == null || value === "") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || String(b[0]).length - String(a[0]).length,
  )[0][0];
}

function parseFromText(text: string) {
  const normalized = normalizeOcrText(text);
  return {
    raw: normalized || text,
    amount: parseBrazilianAmount(normalized) ?? parseBrazilianAmount(text),
    invoiceNumber:
      parseInvoiceNumber(normalized) ?? parseInvoiceNumber(text),
    date: parseExpenseDate(normalized) ?? parseExpenseDate(text),
    merchant: parseMerchantName(normalized) ?? parseMerchantName(text),
    category: suggestCategory(normalized) ?? suggestCategory(text),
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function extractWithGoogleVision(
  imageSource: File | Blob | string,
): Promise<OcrExpenseResult | null> {
  if (typeof window === "undefined" || !navigator.onLine) return null;

  try {
    const blob =
      typeof imageSource === "string"
        ? await (await fetch(imageSource)).blob()
        : imageSource;
    const imageBase64 = await blobToBase64(blob);

    const res = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
    });

    if (res.status === 503) return null;
    if (!res.ok) return null;

    const data = (await res.json()) as OcrExpenseResult;

    return {
      amount: data.amount ?? null,
      invoiceNumber: data.invoiceNumber ?? null,
      date: data.date ?? null,
      merchant: data.merchant ?? null,
      category: data.category ?? null,
      rawText: data.rawText || "",
      confidence: data.confidence ?? 0.85,
      provider: "google-vision",
    };
  } catch {
    return null;
  }
}

async function extractWithTesseract(
  imageSource: File | Blob | string,
): Promise<OcrExpenseResult> {
  const { PSM } = await import("tesseract.js");
  const worker = await getWorker();

  const variants = await Promise.all([
    preprocessVariant(imageSource, "binary"),
    preprocessVariant(imageSource, "contrast"),
    preprocessVariant(imageSource, "soft"),
  ]);

  const originalUrl =
    typeof imageSource === "string"
      ? imageSource
      : URL.createObjectURL(imageSource);

  const jobs: Array<{ img: Blob | string; psm: unknown }> = [
    { img: variants[0], psm: PSM.SINGLE_BLOCK },
    { img: variants[0], psm: PSM.AUTO },
    { img: variants[1], psm: PSM.AUTO },
    { img: variants[2], psm: PSM.SINGLE_COLUMN },
    { img: originalUrl, psm: PSM.AUTO },
  ];

  const texts: string[] = [];
  const confidences: number[] = [];
  const parsedPasses: ReturnType<typeof parseFromText>[] = [];

  try {
    for (const job of jobs) {
      await worker.setParameters({
        tessedit_pageseg_mode: job.psm,
        preserve_interword_spaces: "1",
      });
      const result = await worker.recognize(job.img);
      const text = result.data.text || "";
      texts.push(text);
      confidences.push((result.data.confidence || 0) / 100);
      parsedPasses.push(parseFromText(text));
    }
  } finally {
    if (typeof imageSource !== "string") URL.revokeObjectURL(originalUrl);
  }

  const merged = normalizeOcrText(texts.join("\n"));
  parsedPasses.push(parseFromText(merged));

  const amount = voteValue(parsedPasses.map((p) => p.amount));
  const invoiceNumber = voteValue(
    parsedPasses.map((p) => p.invoiceNumber as string | null),
  );
  const date = voteValue(parsedPasses.map((p) => p.date));
  const merchant = voteValue(parsedPasses.map((p) => p.merchant));
  const category = voteValue(
    parsedPasses.map((p) => p.category as ExpenseCategory | null),
  );

  const confidence =
    confidences.reduce((a, b) => a + b, 0) / Math.max(confidences.length, 1);
  const filled =
    Number(amount != null) +
    Number(Boolean(invoiceNumber)) +
    Number(Boolean(date));

  return {
    amount,
    invoiceNumber,
    date,
    merchant,
    category,
    rawText: merged,
    confidence: Math.min(1, confidence + filled * 0.05),
    provider: "tesseract",
  };
}

export async function extractExpenseFromImage(
  imageSource: File | Blob | string,
): Promise<OcrExpenseResult> {
  const google = await extractWithGoogleVision(imageSource);
  if (
    google &&
    (google.amount != null || google.invoiceNumber || google.rawText)
  ) {
    return google;
  }
  return extractWithTesseract(imageSource);
}
