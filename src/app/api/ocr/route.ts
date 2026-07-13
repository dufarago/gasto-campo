import { NextResponse } from "next/server";
import { parseExpenseFields } from "@/lib/ocr-parsers";

export const runtime = "nodejs";

type VisionResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    textAnnotations?: Array<{ description?: string }>;
    error?: { message?: string };
  }>;
  error?: { message?: string };
};

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Vision não configurado", code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { imageBase64?: string };
    const imageBase64 = body.imageBase64?.replace(/^data:image\/\w+;base64,/, "");

    if (!imageBase64 || imageBase64.length < 100) {
      return NextResponse.json(
        { error: "Imagem inválida" },
        { status: 400 },
      );
    }

    // Limite prático (~4MB base64) para evitar timeout
    if (imageBase64.length > 5_500_000) {
      return NextResponse.json(
        { error: "Imagem muito grande. Tire outra foto mais leve." },
        { status: 413 },
      );
    }

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              imageContext: { languageHints: ["pt", "en"] },
            },
          ],
        }),
      },
    );

    const visionJson = (await visionRes.json()) as VisionResponse;

    if (!visionRes.ok || visionJson.error) {
      return NextResponse.json(
        {
          error:
            visionJson.error?.message ||
            "Falha na API do Google Vision",
        },
        { status: 502 },
      );
    }

    const first = visionJson.responses?.[0];
    if (first?.error?.message) {
      return NextResponse.json(
        { error: first.error.message },
        { status: 502 },
      );
    }

    const rawText =
      first?.fullTextAnnotation?.text ||
      first?.textAnnotations?.[0]?.description ||
      "";

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Nenhum texto encontrado na imagem", code: "NO_TEXT" },
        { status: 422 },
      );
    }

    const fields = parseExpenseFields(rawText);
    return NextResponse.json({
      ...fields,
      provider: "google-vision",
      confidence: Math.max(fields.confidence, 0.85),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro inesperado no OCR",
      },
      { status: 500 },
    );
  }
}
