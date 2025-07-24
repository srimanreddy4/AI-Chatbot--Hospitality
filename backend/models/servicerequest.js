import mongoose from "mongoose";

const serviceRequestSchema = new mongoose.Schema(
  {
    sessionId: { type: String, index: true }, // Add this line
    roomNumber: { type: Number, required: true },
    requestType: { type: String, required: true },
    details: { type: String, required: true },
    status: { type: String, default: "Pending" },
  },
  { timestamps: true },
);

export const ServiceRequest = mongoose.model(
  "ServiceRequest",
  serviceRequestSchema,
);
