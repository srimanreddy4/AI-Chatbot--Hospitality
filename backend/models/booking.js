import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    sessionId: { type: String, index: true }, // Add this line
    roomNumber: { type: Number },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    numberOfGuests: { type: Number },
    specialRequests: { type: String },
    status: { type: String, default: "Confirmed" },
  },
  { timestamps: true },
);

export const Booking = mongoose.model("Booking", bookingSchema);
