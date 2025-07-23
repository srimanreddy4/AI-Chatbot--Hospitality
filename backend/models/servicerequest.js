import mongoose from "mongoose";

const serviceRequestSchema = new mongoose.Schema(
  {
    roomNumber: { type: Number, required: true },
    requestType: { type: String, required: true }, // e.g., 'Room Service', 'Housekeeping'
    details: { type: String, required: true }, // e.g., '2x Club Sandwich', 'Extra Towels'
    status: { type: String, default: "Pending" }, // Pending -> In Progress -> Completed
  },
  { timestamps: true },
);

export const ServiceRequest = mongoose.model(
  "ServiceRequest",
  serviceRequestSchema,
);
