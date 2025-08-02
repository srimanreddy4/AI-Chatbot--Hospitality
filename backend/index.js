import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';
import { Server } from 'socket.io';
import http from 'http';

// Import routers
import apiRoutes from './routes/api.js';
import chatRoutes from './routes/chat.js';
import voiceRoutes from './routes/voice.js';

const app = express();

console.log("===================================");
console.log("🚀 SERVER INITIALIZING...");
console.log("===================================");


const allowedOrigins = [
    'http://localhost:5173',
    'https://ai-chatbot-hospitality-sriman.vercel.app' // Your Vercel URL
];

const corsOptions = {
  origin: (origin, callback) => {
    console.log(`➡️  CORS Check: Origin [${origin}]`);
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      console.log(`✅ CORS Allowed`);
      callback(null, true);
    } else {
      console.error(`❌ CORS Blocked`);
      callback(new Error('Not allowed by CORS'));
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
    methods: ["GET", "POST", "PATCH"]
  }
});

// --- Mongoose Connection with Debugging ---
const mongoUri = process.env.MONGO_URL;
if (mongoUri) {
    // Mask password for security
    const maskedUri = mongoUri.replace(/:([^:]+)@/, ':*****@');
    console.log(`Attempting to connect to MongoDB: ${maskedUri}`);
} else {
    console.error("❌ MONGO_URI environment variable not found!");
}

mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => console.log('✅ MongoDB connected...'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));


io.on('connection', (socket) => {
  console.log('🔌 A user connected to sockets:', socket.id);
  socket.on('join_room', (sessionId) => {
    socket.join(sessionId);
    console.log(`🤝 Socket ${socket.id} joined room: ${sessionId}`);
  });
  socket.on('disconnect', () => {
    console.log('� A user disconnected:', socket.id);
  });
});

app.set('socketio', io);

// --- Middleware to log all incoming requests ---
app.use((req, res, next) => {
    console.log(`\nIncoming Request: ${req.method} ${req.originalUrl}`);
    next();
});

app.use('/api', apiRoutes);
app.use('/chat', chatRoutes);
app.use('/voice', voiceRoutes);

const PORT = process.env.PORT || 10000; // Render uses port 10000
server.listen(PORT, () => {
  console.log(`✅ Server is listening on port ${PORT}`);
});
�
