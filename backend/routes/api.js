import express from "express";
import { Booking } from "../models/booking.js";
import { ServiceRequest } from "../models/servicerequest.js";
import { UserSession } from "../models/usersession.js";
import { HotelFAQ } from "../models/hotelfaq.js";
import { Appointment } from "../models/appointement.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

router.post("/proactive-ping", async (req, res) => {
  try {
    const { sessionId, promptType } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required." });
    }

    const contextResponse = await fetch(
      `${BACKEND_URL}/api/context/${sessionId}`,
    );
    const contextData = await contextResponse.json();

    let prompt = "";
    if (promptType === "checkout_reminder" && contextData.latestBooking) {
      prompt = `You are an AI Hotel Concierge. A user named ${contextData.latestBooking.userName} is checking out on ${new Date(contextData.latestBooking.checkOutDate).toDateString()}. Generate the exact, single message to send them as a friendly reminder. Ask if they need help with luggage or a taxi. Do not offer options or variations.`;
    } else if (
      promptType === "appointment_reminder" &&
      contextData.upcomingAppointment
    ) {
      const appointment = contextData.upcomingAppointment;
      const time = new Date(appointment.appointmentTime).toLocaleTimeString(
        "en-US",
        { hour: "numeric", minute: "2-digit", hour12: true },
      );
      prompt = `You are an AI Hotel Concierge. A user has an upcoming '${appointment.serviceName}' appointment at ${time}. Generate the exact, single message to send them as a friendly reminder. Do not offer options or variations.`;
    } else {
      return res.status(404).json({
        message: `No relevant data found to send a '${promptType}' reminder for this guest.`,
      });
    }

    const result = await model.generateContent(prompt);
    const aiMessageText = result.response.text();

    const session = await UserSession.findOne({ sessionId });
    if (session) {
      const aiMessage = {
        role: "model",
        parts: [{ text: aiMessageText }],
        sentiment: "neutral",
      };
      session.history.push(aiMessage);
      await session.save();
      const io = req.app.get("socketio");
      io.to(sessionId).emit("proactive_message", aiMessage);
      res.status(200).json({
        message: "Proactive message sent successfully!",
        data: aiMessage,
      });
    } else {
      throw new Error("Session not found");
    }
  } catch (error) {
    console.error("❌ Error sending proactive ping:", error);
    res.status(500).json({ message: "Failed to send proactive ping" });
  }
});

router.get("/context/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const latestBooking = await Booking.findOne({ sessionId }).sort({
      createdAt: -1,
    });
    const recentRequests = await ServiceRequest.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(3);
    const upcomingAppointment = await Appointment.findOne({
      sessionId: sessionId,
      appointmentTime: { $gte: new Date() },
    }).sort({ appointmentTime: 1 });

    const context = { latestBooking, recentRequests, upcomingAppointment };
    res.status(200).json(context);
  } catch (error) {
    console.error("❌ Error fetching user context:", error);
    res.status(500).json({ message: "Failed to fetch user context" });
  }
});

router.get("/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await UserSession.findOne({ sessionId });
    if (session) {
      res.status(200).json(session.history);
    } else {
      res.status(200).json([]);
    }
  } catch (error) {
    console.error("❌ Error fetching chat history:", error);
    res.status(500).json({ message: "Failed to fetch chat history" });
  }
});

router.get("/faqs/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Query parameter is required." });
    }

    const keywords = query.toLowerCase().split(/\s+/);
    const faqs = await HotelFAQ.find({ keywords: { $in: keywords } });

    if (faqs.length === 0) {
      return res.status(404).json({ message: "No relevant FAQ found." });
    }

    let bestMatch = faqs[0];
    let maxScore = 0;

    faqs.forEach((faq) => {
      const score = faq.keywords.filter((kw) => keywords.includes(kw)).length;
      if (score > maxScore) {
        maxScore = score;
        bestMatch = faq;
      }
    });

    res.status(200).json(bestMatch);
  } catch (error) {
    console.error("❌ Error searching FAQs:", error);
    res.status(500).json({ message: "Failed to search FAQs" });
  }
});

router.patch("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedRequest = await ServiceRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!updatedRequest)
      return res.status(404).json({ message: "Service request not found." });
    const io = req.app.get("socketio");
    io.emit("request_updated", updatedRequest);
    res.status(200).json(updatedRequest);
  } catch (error) {
    console.error("❌ Error updating service request:", error);
    res.status(500).json({ message: "Failed to update service request" });
  }
});

router.post("/bookings", async (req, res) => {
  try {
    const newBooking = new Booking(req.body);
    await newBooking.save();
    res
      .status(201)
      .json({ message: "Booking created successfully!", data: newBooking });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create booking", error: error.message });
  }
});

router.post("/services", async (req, res) => {
  try {
    const newServiceRequest = new ServiceRequest(req.body);
    await newServiceRequest.save();
    const io = req.app.get("socketio");
    io.emit("new_request", newServiceRequest);
    res
      .status(201)
      .json({ message: "Service request created!", data: newServiceRequest });
  } catch (error) {
    console.error("❌ Error creating service request:", error);
    res.status(500).json({
      message: "Failed to create service request",
      error: error.message,
    });
  }
});

router.get("/services", async (req, res) => {
  try {
    const requests = await ServiceRequest.find({}).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error("❌ Error fetching service requests:", error);
    res.status(500).json({ message: "Failed to fetch service requests" });
  }
});

export default router;
