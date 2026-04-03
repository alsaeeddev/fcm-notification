const express = require("express");
const admin = require("firebase-admin");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const cors = require("cors");

const app = express();

/* =========================
   🌐 CORS (FIXED)
========================= */
app.use(cors({
  origin: "*", // for testing
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));


app.use(express.json());

/* =========================
   🔐 LOGGING
========================= */
app.use(morgan("combined")); // logs every request

/* =========================
   🚦 RATE LIMITING
========================= */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // max 100 requests per IP
  message: { error: "Too many requests, try again later." },
});
app.use(limiter);

/* =========================
   🔐 FIREBASE INIT
========================= */
if (!process.env.FIREBASE_KEY) {
  throw new Error("FIREBASE_KEY is not set");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* =========================
   🔐 AUTH MIDDLEWARE
========================= */
const authenticate = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  next();
};

/* =========================
   🔥 API ROUTE
========================= */
app.post("/send-notification", authenticate, async (req, res) => {
  try {
    const { noteId } = req.body;

    if (!noteId) {
      return res.status(400).json({ error: "noteId is required" });
    }

    const snapshot = await db.collection("notifications").doc(noteId).get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: "Document not found" });
    }

    const data = snapshot.data();
    const fcmToken = data?.fcmToken;

    if (!fcmToken) {
      return res.status(400).json({ error: "No FCM token found" });
    }

    const message = {
      token: fcmToken,
      notification: {
        title: data.title,
        body: data.body,
      },
      data: {
        route: `/${data.route}/${data.orderId}` || "",
        orderId: data.orderId || "",
      },
    };
	
	

	

    const response = await admin.messaging().send(message);

    console.log("✅ Notification sent:", response);

    return res.json({
      success: true,
      fcmResponse: response,
    });

  } catch (error) {
    console.error("❌ Error:", error);

    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
});

/* =========================
   🚀 SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});