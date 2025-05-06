import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const prompt = formData.get("prompt");
    const files = formData.getAll("media");

    const fileIds = [];
    const fileMetas = [];

    // Загружаем каждый файл
    for (const file of files) {
      const uploaded = await openai.files.create({
        file,
        purpose: "assistants"
      });
      fileIds.push(uploaded.id);
      fileMetas.push({
        id: uploaded.id,
        name: file.name,
        type: file.type
      });
    }

    // Создаём thread
    const thread = await openai.beta.threads.create();

    // Формируем content
    const content = [
      { type: "text", text: prompt }
    ];

    for (const meta of fileMetas) {
      if (meta.type.startsWith("image/")) {
        content.push({
          type: "image_file",
          image_file: { file_id: meta.id }
        });
      } else {
        content.push({
          type: "text",
          text: `📎 Пользователь прикрепил файл: ${meta.name} (ID: ${meta.id})`
        });
      }
    }

    // Создаём сообщение в thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content
    });

    // Запускаем ассистента
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.ASSISTANT_ID
    });

    // Ждём завершения
    while (run.status !== "completed" && run.status !== "failed") {
      await new Promise((r) => setTimeout(r, 1000));
      const updated = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      run.status = updated.status;
    }

    // Получаем ответ
    const messages = await openai.beta.threads.messages.list(thread.id);
    const reply = messages.data[0].content[0].text.value;

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error("❌ Ошибка:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Error" }), {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });
  }
}
