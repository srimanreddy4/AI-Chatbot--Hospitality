import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import "dotenv/config";
import { Server } from "socket.io";
import http from "http";

// Import routers
import apiRoutes from "./routes/api.js";
import chatRoutes from "./routes/chat.js";
import voiceRoutes from "./routes/voice.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://ai-chatbot-hospitality.vercel.app", // Your Vercel URL
];

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH"],
  },
});

const mongoUri = process.env.MONGO_URL;

mongoose
  .connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log("✅ MongoDB connected..."))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

io.on("connection", (socket) => {
  console.log("🔌 A user connected to sockets:", socket.id);
  socket.on("join_room", (sessionId) => {
    socket.join(sessionId);
    console.log(`🤝 Socket ${socket.id} joined room: ${sessionId}`);
  });
  socket.on("disconnect", () => {
    console.log("👋 A user disconnected:", socket.id);
  });
});

app.set("socketio", io);

app.use("/api", apiRoutes);
app.use("/chat", chatRoutes);
app.use("/voice", voiceRoutes);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`✅ Server is listening on port ${PORT}`);
});
