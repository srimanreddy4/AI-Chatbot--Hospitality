import express from "express";
import { Booking } from "../models/booking.js";
import { ServiceRequest } from "../models/servicerequest.js";
import { UserSession } from "../models/usersession.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { HotelFAQ } from "../models/hotelfaq.js";

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Search FAQ knowledge base using keyword matching
router.get("/faqs/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Query parameter is required." });
    }

    // Extract keywords from the search query
    const keywords = query.toLowerCase().split(/\s+/);

    // Find FAQs that match the keywords
    const faqs = await HotelFAQ.find({ keywords: { $in: keywords } });

    if (faqs.length === 0) {
      return res.status(404).json({ message: "No relevant FAQ found." });
    }

    // Find the best matching FAQ based on keyword overlap
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
    console.error("Error searching FAQs:", error);
    res.status(500).json({ message: "Failed to search FAQs" });
  }
});

// Get chat history for a specific session
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
    console.error("Error fetching chat history:", error);
    res.status(500).json({ message: "Failed to fetch chat history" });
  }
});

// Send proactive messages to guests
router.post("/proactive-ping", async (req, res) => {
  try {
    const { sessionId, promptType } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required." });
    }

    // Fetch user context for personalized messages
    const contextResponse = await fetch(
      `http://localhost:3000/api/context/${sessionId}`,
    );
    const contextData = await contextResponse.json();

    // Generate appropriate prompt based on type
    let prompt = "";
    if (promptType === "checkout_reminder" && contextData.latestBooking) {
      prompt = `The user's name is ${contextData.latestBooking.userName} and they are checking out on ${new Date(contextData.latestBooking.checkOutDate).toDateString()}. Write a friendly, short, proactive message reminding them of their checkout and asking if they need help with luggage or a taxi.`;
    } else if (
      promptType === "appointment_reminder" &&
      contextData.upcomingAppointment
    ) {
      const appointment = contextData.upcomingAppointment;
      const time = new Date(appointment.appointmentTime).toLocaleTimeString(
        "en-US",
        { hour: "numeric", minute: "2-digit", hour12: true },
      );
      prompt = `The user has an upcoming '${appointment.serviceName}' appointment at ${time}. Write a friendly, short, proactive message to remind them about it.`;
    } else {
      prompt = `The user has been inactive for a while. Write a friendly, short, proactive message to check if they need anything.`;
    }

    // Generate AI message
    const result = await model.generateContent(prompt);
    const aiMessageText = result.response.text();

    // Save to session history and emit to user
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

      console.log(`Proactive message sent to room: ${sessionId}`);
      res.status(200).json({
        message: "Proactive message sent successfully!",
        data: aiMessage,
      });
    } else {
      throw new Error("Session not found");
    }
  } catch (error) {
    console.error("Error sending proactive ping:", error);
    res.status(500).json({ message: "Failed to send proactive ping" });
  }
});

// Get user context including bookings and recent requests
router.get("/context/:sessionId", async (req, res) => {
  try {
    const latestBooking = await Booking.findOne({}).sort({ createdAt: -1 });
    const recentRequests = await ServiceRequest.find({})
      .sort({ createdAt: -1 })
      .limit(3);
    const upcomingAppointment = await Appointment.findOne({
      sessionId: sessionId,
      appointmentTime: { $gte: new Date() },
    }).sort({ appointmentTime: 1 });

    const context = {
      latestBooking,
      recentRequests,
      upcomingAppointment,
    };
    res.status(200).json(context);
  } catch (error) {
    console.error("Error fetching user context:", error);
    res.status(500).json({ message: "Failed to fetch user context" });
  }
});

// Update service request status
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
    console.error("Error updating service request:", error);
    res.status(500).json({ message: "Failed to update service request" });
  }
});

// Create new booking
router.post("/bookings", async (req, res) => {
  try {
    const newBooking = new Booking(req.body);
    await newBooking.save();

    console.log("Booking successful:", newBooking);

    res
      .status(201)
      .json({ message: "Booking created successfully!", data: newBooking });
  } catch (error) {
    console.error("Error creating booking:", error);
    res
      .status(500)
      .json({ message: "Failed to create booking", error: error.message });
  }
});

// Create new service request
router.post("/services", async (req, res) => {
  try {
    const newServiceRequest = new ServiceRequest(req.body);
    await newServiceRequest.save();

    // Notify dashboard via socket
    const io = req.app.get("socketio");
    io.emit("new_request", newServiceRequest);

    console.log("Service Request successful, event emitted:", newServiceRequest);
    res
      .status(201)
      .json({ message: "Service request created!", data: newServiceRequest });
  } catch (error) {
    console.error("Error creating service request:", error);
    res.status(500).json({
      message: "Failed to create service request",
      error: error.message,
    });
  }
});

// Get all service requests
router.get("/services", async (req, res) => {
  try {
    const requests = await ServiceRequest.find({}).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error fetching service requests:", error);
    res.status(500).json({ message: "Failed to fetch service requests" });
  }
});

export default router;
