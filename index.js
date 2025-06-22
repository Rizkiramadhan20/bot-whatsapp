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
  let sock;

  const connect = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["Bot WhatsApp", "Chrome", "1.0.0"],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 2000,
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log("📱 Scan QR code ini dengan WhatsApp:");
        qrcode.generate(qr, { small: true });
      }
      if (connection === "open") {
        console.log("✅ Bot WhatsApp connected");
      } else if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !==
          DisconnectReason.loggedOut;
        console.log(
          "❌ Connection closed due to ",
          lastDisconnect?.error,
          ", reconnecting ",
          shouldReconnect
        );
        if (shouldReconnect) {
          console.log("🔄 Reconnecting...");
          setTimeout(connect, 3000); // Reconnect after 3 seconds
        }
      }
    });
  };

  await connect();

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get("/", (req, res) => {
    res.json({
      status: "OK",
      message: "WhatsApp Bot is running",
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/send-message", async (req, res) => {
    const { to, name, amount } = req.body;

    if (!to || !name || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    try {
      await sock.sendMessage(`${to}@s.whatsapp.net`, {
        text: `Halo ${name}, terima kasih atas donasinya sebesar Rp${amount}. Semoga berkah selalu 🙏`,
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  });
})();
