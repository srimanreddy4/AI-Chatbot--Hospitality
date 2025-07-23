import mongoose from "mongoose";
import "dotenv/config";
import { HotelFAQ } from "./models/hotelfaq.js";
import { Appointment } from "./models/appointement.js";

const faqs = [
  {
    question: "What are the pool hours?",
    answer: "Our swimming pool is open from 8 AM to 10 PM daily.",
    keywords: ["pool", "swimming", "hours", "open", "close"],
  },
  {
    question: "Do you offer free Wi-Fi?",
    answer:
      "Yes, we offer complimentary high-speed Wi-Fi for all our guests. You can connect to the 'HotelGuest' network with the password 'welcome123'.",
    keywords: ["wifi", "wi-fi", "internet", "network", "password", "free"],
  },
  {
    question: "What time is check-out?",
    answer:
      "Check-out time is 11 AM. If you need a late check-out, please contact the front desk.",
    keywords: ["checkout", "check-out", "time", "late"],
  },
  {
    question: "Is breakfast included?",
    answer:
      "Our breakfast buffet is available from 7 AM to 10 AM. It is included for guests who booked a 'Bed & Breakfast' package. Otherwise, it is available for an additional charge.",
    keywords: ["breakfast", "food", "buffet", "included", "charge"],
  },
  {
    question: "Do you have a gym or fitness center?",
    answer:
      "Yes, our state-of-the-art fitness center is located on the second floor and is open 24/7 for all guests.",
    keywords: ["gym", "fitness", "center", "workout", "exercise"],
  },
];
const appointments = [
  {
    sessionId: "guest_room_101",
    serviceName: "Spa Massage",
    // Let's set it for a specific time today for easy testing
    appointmentTime: new Date(new Date().setHours(16, 0, 0, 0)), // 4:00 PM today
    details: "Deep tissue massage.",
  },
];

const seedDB = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  await HotelFAQ.deleteMany({});
  await HotelFAQ.insertMany(faqs);

  // 3. Add the new appointments to the database
  await Appointment.deleteMany({});
  await Appointment.insertMany(appointments);

  console.log("Database has been seeded with FAQs and a sample Appointment!");
};

seedDB().then(() => {
  mongoose.connection.close();
});
