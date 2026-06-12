import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/knowledge/mentor-chat
 *
 * Stub endpoint for mentor chat.
 * Currently returns a placeholder response.
 * Will be connected to Bitrix24 webhook for real mentor responses.
 *
 * Future integration plan:
 * 1. Receive user message from frontend
 * 2. Forward to Bitrix24 webhook (incoming webhook to create/reply to chat)
 * 3. Optionally use AI as fallback when Bitrix24 is unavailable
 * 4. Store conversation history in DB for mentor review
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // ─── Stub response ───────────────────────────────────────
    // TODO: Replace with Bitrix24 webhook integration
    //
    // Example Bitrix24 integration flow:
    // 1. Send message to Bitrix24 open line / live chat:
    //    const bxResponse = await fetch(`${BITRIX24_WEBHOOK_URL}/im.message.add`, {
    //      method: "POST",
    //      headers: { "Content-Type": "application/json" },
    //      body: JSON.stringify({
    //        DIALOG_ID: process.env.BITRIX24_DIALOG_ID,
    //        MESSAGE: message,
    //      }),
    //    });
    //
    // 2. Return acknowledgment to user
    // 3. Mentor replies via Bitrix24 → webhook callback → stored in DB → polled by frontend

    const reply = generateStubReply(message);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[MentorChat] Error:", error);
    return NextResponse.json(
      { reply: "Спасибо за вопрос! Сейчас я не могу ответить, но ваш вопрос сохранён. Ментор ответит в ближайшее время." },
      { status: 200 }
    );
  }
}

/**
 * Generate a contextual stub reply based on the user's message.
 * This will be replaced by real Bitrix24 integration.
 */
function generateStubReply(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("привет") || lower.includes("здравствуй") || lower.includes("добр")) {
    return "Привет! Рад тебя видеть. Задавай вопросы по материалу — я помогу разобраться!";
  }

  if (lower.includes("не понят") || lower.includes("не понятн") || lower.includes("запутал")) {
    return "Ничего страшного, если что-то непонятно! Попробуй описать, какой именно момент вызывает затруднения, и я постараюсь объяснить проще.";
  }

  if (lower.includes("спасибо") || lower.includes("благодар")) {
    return "Пожалуйста! Если появятся ещё вопросы — обращайся. Удачи в обучении!";
  }

  if (lower.includes("как") || lower.includes("зачем") || lower.includes("почему")) {
    return "Хороший вопрос! Давай разберёмся вместе. Ментор подготовит подробный ответ и вернётся к тебе.";
  }

  return "Спасибо за вопрос! Я передам его ментору, и ты получишь ответ в ближайшее время. А пока можешь продолжить изучение материала.";
}
