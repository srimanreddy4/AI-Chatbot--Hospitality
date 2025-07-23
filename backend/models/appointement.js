import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    // We link the appointment to a specific guest session
    sessionId: { type: String, required: true, index: true },
    serviceName: { type: String, required: true }, // e.g., 'Spa Treatment', 'Dinner Reservation'
    appointmentTime: { type: Date, required: true },
    details: { type: String },
  },
  { timestamps: true },
);

export const Appointment = mongoose.model("Appointment", appointmentSchema);
