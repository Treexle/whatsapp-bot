const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const express = require("express");
const { Client, MessageMedia, LocalAuth } = require("whatsapp-web.js");
// temp directory by waweb.js
const authDir = path.join(__dirname, ".wwebjs_auth");
const cacheDir = path.join(__dirname, ".wwebjs_cache");
const cooldowns = new Map();
const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
app.get("/", (req, res) => {
  res.send("✅ WhatsApp bot is running. Visit /qr.png to scan QR.");
});
// Create client with LocalAuth (auto session saving)
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox"],
  },
  // ffmpeg: "./ffmpeg",
});

// Show QR code in terminal
client.on("qr", async (qr) => {
  //kalo pake yang qr terminal "async" dihapus
  const qrImagePath = "./qr.png";
  await QRCode.toFile(qrImagePath, qr);
  const domain = process.env.RAILWAY_STATIC_URL || `localhost:${PORT}`;
  console.log(`⚠️ Scan the QR at: https://${domain}/qr.png`);
  // qrcode.generate(qr, { small: true });
  // console.log("📱 Scan QR Code.");
});

app.use("/qr.png", express.static(path.join(__dirname, "qr.png")));
// Notify when authenticated
client.on("authenticated", () => {
  console.log("🔒 Authenticated!");
});

// Bot is ready
client.on("ready", () => {
  console.log("🤖 Bot is ready!");
});

// Handle messages
client.on("message", async (message) => {
  // console.log(
  //   "📩 Received message:",
  //   message.body,
  //   "| Has media:",
  //   message.hasMedia
  // );

  if (message.body === "~ping") {
    await message.reply("Nigger");
  }

  if (message.body === "~tagall" && message.from.endsWith("@g.us")) {
    const now = Date.now();
    const lastUsed = cooldowns.get(message.from) || 0;
    const cooldownTime = 10000; // 10 sec

    if (now - lastUsed < cooldownTime) {
      const wait = Math.ceil((cooldownTime - (now - lastUsed)) / 1000);
      return message.reply(
        `⏳ Tunggu ${wait} detik sebelum menggunakan perintah ini lagi.`
      );
    }

    cooldowns.set(message.from, now);

    const chat = await message.getChat();

    if (!chat.isGroup) return;

    let mentions = [];
    let text = "*👥 Ngetag Semua member :*\n\n";

    for (const participant of chat.participants) {
      const contact = await client.getContactById(participant.id._serialized);
      mentions.push(contact);
      text += `@${contact.number} `;
    }

    chat.sendMessage(text, {
      mentions: mentions,
    });
  }
  if (message.body === "~sticker") {
    if (message.hasMedia) {
      const media = await message.downloadMedia();
      if (media) {
        const mediaPath = "./downloaded-media/";
        if (!fs.existsSync(mediaPath)) {
          fs.mkdirSync(mediaPath);
        }

        const extension = mime.extension(media.mimetype);
        const filename = `${Date.now()}.${extension}`;
        const fullFilename = path.join(mediaPath, filename);

        try {
          fs.writeFileSync(fullFilename, media.data, { encoding: "base64" });

          await client.sendMessage(
            message.from,
            new MessageMedia(media.mimetype, media.data, filename),
            {
              sendMediaAsSticker: true,
              stickerAuthor: "Setelan bawaan pabrik",
              stickerName: "Awang Masa Aktif",
            }
          );

          fs.unlinkSync(fullFilename); // Clean up
        } catch (err) {
          console.error("❌ Gagal membuat sticker:", err);
          await message.reply("⚠️ Gagal membuat sticker.");
        }
      }
    } else {
      await message.reply(
        "📎 Kirim Chat nya pake gambar terus caption : *~sticker*"
      );
    }
  }
});

// removing temp directory by waweb.js
const removeDir = (dirPath) => {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`✅ Removed directory: ${dirPath}`);
  } else {
    console.log(`⚠️ Directory not found: ${dirPath}`);
  }
};

// Hook into process shutdown to clean up
process.on("exit", () => {
  console.log("👋 Shutting down bot, cleaning up...");
  removeDir(authDir);
  removeDir(cacheDir);
});

process.on("SIGINT", () => {
  console.log("👋 Bot interrupted (Ctrl+C), cleaning up...");
  removeDir(authDir);
  removeDir(cacheDir);
  process.exit(); // Exit after cleanup
});
client.initialize();
