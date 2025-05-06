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

    for (const file of files) {
      const uploaded = await openai.files.create({
        file,
        purpose: "assistants"
      });
      fileIds.push(uploaded.id);
    }

    const thread = await openai.beta.threads.create();

    const content = [
      { type: "text", text: prompt },
      ...fileIds.map(id => ({
        type: "file_id",
        file_id: id
      }))
    ];

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
