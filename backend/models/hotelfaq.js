import mongoose from "mongoose";

const hotelFAQSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  keywords: [{ type: String }], // Keywords for simple searching
});

export const HotelFAQ = mongoose.model("HotelFAQ", hotelFAQSchema);
