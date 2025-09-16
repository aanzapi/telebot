const TelegramBot = require("node-telegram-bot-api");
const { Octokit } = require("@octokit/rest");
const simpleGit = require("simple-git");
const fs = require("fs");
const path = require("path");
const extract = require("extract-zip");
const fetch = require("node-fetch");

// =========================
// 🔧 SETTING
// =========================
const BOT_TOKEN = "ISI_TOKEN_TELEGRAM";
const GITHUB_TOKEN = "ISI_TOKEN_GITHUB_PAT";
const GITHUB_USER = "username_github";

// =========================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// =========================
// 📌 Menu
// =========================
bot.onText(/\/menu/, (msg) => {
  const menu = `
📌 *Menu Bot GitHub Uploader*

1️⃣ /upload <namarepo>  + kirim file .zip  
   ➝ Ekstrak zip & upload ke GitHub

2️⃣ /listrepo  
   ➝ Daftar semua repo GitHub kamu

3️⃣ /delete <namarepo>  
   ➝ Hapus repo (atau /delete owner/repo)

4️⃣ /menu  
   ➝ Lihat menu ini lagi
`;
  bot.sendMessage(msg.chat.id, menu, { parse_mode: "Markdown" });
});

// =========================
// 📌 UPLOAD ZIP
// =========================
bot.onText(/\/upload (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const repoName = match[1].trim();

  bot.sendMessage(chatId, `📦 Kirim file .zip untuk repo *${repoName}*`, {
    parse_mode: "Markdown",
  });

  bot.once("document", async (docMsg) => {
    try {
      const fileId = docMsg.document.file_id;
      const file = await bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
      const zipPath = path.join(__dirname, `${repoName}.zip`);
      const extractPath = path.join(__dirname, repoName);

      // Download ZIP
      const res = await fetch(fileUrl);
      const buffer = await res.buffer();
      fs.writeFileSync(zipPath, buffer);

      // Ekstrak
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true, force: true });
      }
      await extract(zipPath, { dir: extractPath });

      // Buat repo di GitHub
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: false,
      });

      // Push ke GitHub
      const git = simpleGit(extractPath);
      await git.init();
      await git.addRemote(
        "origin",
        `https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${repoName}.git`
      );
      await git.addConfig("user.name", "Aanz Bot");
      await git.addConfig("user.email", "aanz@example.com");
      await git.add(".");
      await git.commit("Upload via Telegram Bot");
      await git.push("origin", "main", ["--force"]);

      bot.sendMessage(chatId, `✅ Repo *${repoName}* berhasil diupload!`, {
        parse_mode: "Markdown",
      });

      // Bersihkan
      fs.unlinkSync(zipPath);
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      bot.sendMessage(
        chatId,
        `❌ Upload gagal: ${err.response?.data?.message || err.message}`
      );
    }
  });
});

// =========================
// 📌 LIST REPO
// =========================
bot.onText(/\/listrepo/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const repos = await octokit.repos.listForAuthenticatedUser();
    if (repos.data.length === 0) {
      return bot.sendMessage(chatId, "⚠️ Tidak ada repo.");
    }
    let text = "📂 *Daftar Repo:*\n\n";
    repos.data.forEach((r, i) => {
      text += `${i + 1}. [${r.name}](${r.html_url})\n`;
    });
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("LIST ERROR:", err);
    bot.sendMessage(
      chatId,
      `❌ Gagal ambil daftar repo: ${err.response?.data?.message || err.message}`
    );
  }
});

// =========================
// 📌 DELETE REPO
// =========================
bot.onText(/\/delete (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const arg = match[1].trim();

  try {
    // Ambil user dari token
    const authRes = await octokit.request("GET /user");
    const authUser = authRes.data.login;

    // Parse arg
    let owner, repo;
    if (arg.includes("/")) {
      [owner, repo] = arg.split("/");
    } else {
      owner = authUser;
      repo = arg;
    }

    // Cek repo dulu
    try {
      await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
    } catch (err) {
      if ((err.status || err.response?.status) === 404) {
        return bot.sendMessage(
          chatId,
          `❌ Repo *${owner}/${repo}* tidak ditemukan.`,
          { parse_mode: "Markdown" }
        );
      }
      throw err;
    }

    // Hapus repo
    await octokit.request("DELETE /repos/{owner}/{repo}", { owner, repo });

    bot.sendMessage(chatId, `🗑️ Repo *${owner}/${repo}* berhasil dihapus.`, {
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    const status = err.status || err.response?.status || "unknown";
    const ghMsg = err.response?.data?.message || err.message || "";
    let msgErr = `❌ Gagal hapus repo (status: ${status})`;
    if (ghMsg) msgErr += `\nGitHub: ${ghMsg}`;
    if (status === 403) {
      msgErr += `\n\n⚠️ Token tidak punya izin atau bukan owner repo. Cek scope PAT dan owner repo.`;
    }
    bot.sendMessage(chatId, msgErr);
  }
});

// =========================
// ✅ Bot Jalan
// =========================
console.log("🤖 Bot berjalan...");
