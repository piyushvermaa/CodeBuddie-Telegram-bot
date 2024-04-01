import { Telegraf } from "telegraf";
import userModel from "./src/models/Users.js";
import connectdb from "./src/config/db.js";
import eventModel from "./src/models/Events.js";
import request from "request";

const bot = new Telegraf(process.env.BOT_TOKEN);

try {
  connectdb();
  console.log("MongoDB connected");
} catch (err) {
  console.error(err);
  process.kill(process.pid, "SIGTERM");
}

bot.start(async (ctx) => {
  const from = ctx.update.message.from;
  console.log("from:", from);
  try {
    await userModel.findOneAndUpdate(
      { tgId: from.id },
      {
        $setOnInsert: {
          firstName: from.first_name,
          lastName: from.last_name,
          isBot: from.is_bot,
          username: from.username,
        },
      },
      { upsert: true, new: true },{maxTimeMS: 300000}
    );
    await ctx.reply(
      `Hello ${from.first_name} Bhai, kese ho? Me hu Code buddie koi dikkat aarhi ho coding me toh mujhe btao..`
    );
  } catch (err) {
    console.error(err);
    ctx.reply("Bhai kuch toh gadbad hai");
  }
});

bot.command("generate", async (ctx) => {
  const from = ctx.update.message.from;

  try {
    const lastEvent = await eventModel
      .findOne({ tgId: from.id })
      .sort({ createdAt: -1 })
      .limit(1);

    if (!lastEvent) {
      ctx.reply("Bhai kuch bta to kya nikalu");
      return;
    }

    console.log("Last event:", lastEvent);

    const options = {
      method: "POST",
      url: "https://chatgpt-42.p.rapidapi.com/conversationgpt4",
      headers: {
        "content-type": "application/json",
        "X-RapidAPI-Key": "1b1fbe41f4msh3c10fa85af3a199p15227fjsn9bbc8e83452d",
        "X-RapidAPI-Host": "chatgpt-42.p.rapidapi.com",
      },
      body: {
        messages: [
          {
            role: "user",
            content: `${lastEvent.text}`, // Use the text from the last event
          },
        ],
        web_access: false,
        system_prompt: "",
        temperature: 0.9,
        top_k: 5,
        top_p: 0.9,
        max_tokens: 256,
      },
      json: true,
    };

    request(options, async function (error, response, body) {
      if (error) {
        console.error("API request error:", error);
        ctx.reply("Bhai kuch to gadbad hai");
      } else {
        console.log("API response:", body.result);
        ctx.reply("ruk bhai dhund rha hu...");
        ctx.reply(body.result);
        ctx.reply("Bhai kuch aur chahiye to bta");
      }
    });
  } catch (err) {
    console.error("Generate command error:", err);
    ctx.reply("Bhai kuch to gadbad hai");
  }
});

bot.on("text", async (ctx) => {
  const from = ctx.message.from;
  const message = ctx.message.text;

  try {
    await eventModel.create({
      text: message,
      tgId: from.id,
    });
    await ctx.reply("Accha bhai\n jab result chahiye ho to /generate krdio!");
  } catch (err) {
    console.error("Text event error:", err);
    await ctx.reply("Bhai ruk ja kuch gadbad horhi h");
  }
});

bot
  .launch()
  .then(() => {
    console.log("Bot started");
  })
  .catch((err) => {
    console.error("Bot launch error:", err);
  });

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
