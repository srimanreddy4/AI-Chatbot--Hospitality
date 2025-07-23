import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    roomNumber: { type: Number },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    // --- NEW FIELD ---
    numberOfGuests: { type: Number },
    // We will use specialRequests to store room preferences
    specialRequests: { type: String },
    status: { type: String, default: "Confirmed" },
  },
  { timestamps: true },
);

export const Booking = mongoose.model("Booking", bookingSchema);
