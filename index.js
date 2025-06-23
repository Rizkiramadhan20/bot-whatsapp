const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");

// Create auth directory if it doesn't exist
const authDir = "./auth";
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir);
}

(async () => {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  let sock;

  const connect = async () => {
    sock = makeWASocket({
      auth: state,
      browser: ["Bot WhatsApp", "Chrome", "1.0.0"],
    });
    sock.ev.on("creds.update", saveCreds);

    // Simpan nomor user yang pernah chat ke file/DB
    const userFile = "./users.json";
    const saveUser = (jid) => {
      let users = [];
      if (fs.existsSync(userFile))
        users = JSON.parse(fs.readFileSync(userFile));
      if (!users.includes(jid)) {
        users.push(jid);
        fs.writeFileSync(userFile, JSON.stringify(users, null, 2));
      }
    };

    // Auto-reply saat user chat pertama kali
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (!msg.key.fromMe && msg.key.remoteJid.endsWith("@s.whatsapp.net")) {
          saveUser(msg.key.remoteJid);
          await sock.sendMessage(msg.key.remoteJid, {
            text: "Terima kasih sudah menghubungi admin! Anda sekarang bisa menerima notifikasi otomatis dari website.",
          });
        }
      }
    });

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log("\uD83D\uDCF1 Scan QR code ini dengan WhatsApp:");
        qrcode.generate(qr, { small: true });
      }
      if (connection === "open") {
        console.log("\u2705 Bot WhatsApp connected");
      } else if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          console.log(
            "\u274C Anda logout dari WhatsApp. Silakan scan QR ulang."
          );
          process.exit();
        } else {
          console.log(
            "\u274C Connection closed due to ",
            lastDisconnect?.error,
            ", reconnecting..."
          );
          setTimeout(connect, 3000);
        }
      }
    });
  };

  await connect();

  // Endpoint untuk kirim pesan ke user yang sudah pernah chat
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/send", async (req, res) => {
    const { to, message } = req.body;
    if (!to || !message)
      return res.status(400).json({ success: false, error: "Missing fields" });

    const jid = to.endsWith("@s.whatsapp.net")
      ? to
      : to.replace(/^\+/, "") + "@s.whatsapp.net";
    // Cek apakah user sudah pernah chat
    let users = [];
    if (fs.existsSync("./users.json"))
      users = JSON.parse(fs.readFileSync("./users.json"));
    if (!users.includes(jid)) {
      return res
        .status(400)
        .json({ success: false, error: "Nomor belum pernah chat ke bot." });
    }
    try {
      await sock.sendMessage(jid, { text: message });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/", (req, res) => {
    res.send("WhatsApp Bot is running!");
  });

  app.listen(3001, () => console.log("Bot WhatsApp running on port 3001"));
})();
