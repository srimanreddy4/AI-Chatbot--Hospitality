import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, enum: ["user", "model"] }, // 'user' for guest, 'model' for AI
    parts: [
      {
        text: { type: String, required: true },
      },
    ],
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative", null],
      default: null,
    },
  },
  { _id: false, timestamps: true },
);

const userSessionSchema = new mongoose.Schema(
  {
    // In a real app, this would be a unique ID from login or a cookie.
    // For the hackathon, I am using a single, hardcoded ID.
    sessionId: { type: String, required: true, unique: true, index: true },
    history: [messageSchema], // Stores the entire conversation
  },
  { timestamps: true },
);

export const UserSession = mongoose.model("UserSession", userSessionSchema);
