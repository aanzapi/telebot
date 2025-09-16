const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const simpleGit = require("simple-git");
const axios = require("axios");
const { Octokit } = require("@octokit/rest");

// ==========================
// 🔑 Konfigurasi
// ==========================
const BOT_TOKEN = "8089493197:AAG2QNzfIB7Cc8l6fiFmokUV9N5df-oJabg";
const GITHUB_TOKEN = "GITHUB_PERSONAL_ACCESS_TOKEN";
const GITHUB_USER = "aanzapi"; // ganti dengan username GitHub kamu

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ==========================
// 📥 Command /upload
// ==========================
bot.onText(/\/upload (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const repoName = match[1];

  if (!msg.reply_to_message || !msg.reply_to_message.document) {
    return bot.sendMessage(
      chatId,
      "⚠️ Cara pakai:\n1. Upload file `.zip`\n2. Reply file itu dengan `/upload namarepo`",
      { parse_mode: "Markdown" }
    );
  }

  try {
    bot.sendMessage(chatId, `⏳ Sedang memproses upload ke repo *${repoName}*...`, { parse_mode: "Markdown" });

    // 1. 📥 Download file dari Telegram
    const fileId = msg.reply_to_message.document.file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const zipPath = path.join(__dirname, `${repoName}.zip`);

    const response = await axios({ url: fileUrl, responseType: "arraybuffer" });
    fs.writeFileSync(zipPath, response.data);

    // 2. 📦 Ekstrak zip
    const extractPath = path.join(__dirname, repoName);
    fs.rmSync(extractPath, { recursive: true, force: true });
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    // 3. 🔍 Cek repo sudah ada atau belum
    let repoExists = true;
    try {
      await octokit.repos.get({ owner: GITHUB_USER, repo: repoName });
    } catch (err) {
      repoExists = false;
    }

    // 4. 🆕 Kalau repo belum ada → buat baru
    if (!repoExists) {
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: false, // true kalau mau repo private
      });
      await bot.sendMessage(chatId, `📂 Repo baru dibuat: *${repoName}*`, { parse_mode: "Markdown" });
    }

    // 5. 🚀 Push ke GitHub
    const git = simpleGit(extractPath);
    await git.init();
    await git.addRemote(
      "origin",
      `https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${repoName}.git`
    );
    await git.add(".");
    await git.commit("Upload via Telegram Bot");
    await git.push("origin", "main", ["--force"]);

    bot.sendMessage(
      chatId,
      `✅ Berhasil upload & push ke GitHub!\n🔗 https://github.com/${GITHUB_USER}/${repoName}`
    );
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Gagal upload file ke GitHub");
  }
});

// ==========================
// 📋 Command /listrepo
// ==========================
bot.onText(/\/listrepo/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const repos = await octokit.repos.listForAuthenticatedUser({ per_page: 10 });
    const list = repos.data.map(r => `- [${r.name}](${r.html_url})`).join("\n");
    bot.sendMessage(chatId, `📂 Repo kamu:\n${list}`, { parse_mode: "Markdown" });
  } catch (err) {
    bot.sendMessage(chatId, "❌ Gagal ambil daftar repo");
  }
});

// ==========================
// 🗑️ Command /delete
// ==========================
bot.onText(/\/delete (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const repoName = match[1];
  try {
    await octokit.repos.delete({ owner: GITHUB_USER, repo: repoName });
    bot.sendMessage(chatId, `🗑️ Repo *${repoName}* berhasil dihapus`, { parse_mode: "Markdown" });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal hapus repo *${repoName}*`, { parse_mode: "Markdown" });
  }
});

console.log("🤖 Bot berjalan...");
