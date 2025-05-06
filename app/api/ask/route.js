import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req) {
  try {
    const formData = await req.formData();
    const prompt = formData.get("prompt") || "";
    const files = formData.getAll("media");

    const fileMetas = [];

    for (const file of files) {
      const uploaded = await openai.files.create({
        file,
        purpose: "assistants"
      });
      fileMetas.push({
        id: uploaded.id,
        name: file.name || "без имени",
        type: file.type || "application/octet-stream"
      });
    }

    const thread = await openai.beta.threads.create();

    const content = [];

    if (prompt.trim() !== "") {
      content.push({
        type: "text",
        text: prompt.trim()
      });
    }

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

    // Если вообще ничего нет — ошибка
    if (content.length === 0) {
      return new Response(
        JSON.stringify({ error: "Заполните сообщение или прикрепите файл." }),
        { status: 400 }
      );
    }

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.ASSISTANT_ID
    });

    while (run.status !== "completed" && run.status !== "failed") {
      await new Promise(r => setTimeout(r, 1000));
      const updated = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      run.status = updated.status;
    }

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
