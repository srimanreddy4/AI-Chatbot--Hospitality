// Step 1: Import the tools we need
import express from "express"; // We need Express to create the router
import { Booking } from "../models/booking.js"; // Import the Booking model we created
import { ServiceRequest } from "../models/servicerequest.js"; // Import the ServiceRequest model
import { UserSession } from "../models/usersession.js"; // 1. Import UserSession model
import { GoogleGenerativeAI } from "@google/generative-ai"; // 2. Import Gemini AI
import { HotelFAQ } from "../models/hotelfaq.js";
import { Appointment } from "../models/appointement.js";
// Step 2: Create a new router
// A router is like a mini-app that can have its own routes.
// It helps group related API endpoints together.
const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

router.get("/faqs/search", async (req, res) => {
  try {
    const { query } = req.query; // e.g., "what time is the pool open?"
    if (!query) {
      return res.status(400).json({ message: "Query parameter is required." });
    }

    // Simple keyword extraction: split the query into words
    const keywords = query.toLowerCase().split(/\s+/);

    // Find the FAQ with the most matching keywords
    const faqs = await HotelFAQ.find({ keywords: { $in: keywords } });

    if (faqs.length === 0) {
      return res.status(404).json({ message: "No relevant FAQ found." });
    }

    // A simple relevance scoring: the one with the most matches wins.
    // This simulates a vector search's "nearest neighbor" result.
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

router.get("/history/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await UserSession.findOne({ sessionId });
    if (session) {
      res.status(200).json(session.history);
    } else {
      // If no session is found, it's a new user. Return an empty array.
      res.status(200).json([]);
    }
  } catch (error) {
    console.error("❌ Error fetching chat history:", error);
    res.status(500).json({ message: "Failed to fetch chat history" });
  }
});

router.post("/proactive-ping", async (req, res) => {
  try {
    const { sessionId, promptType } = req.body;
    const contextResponse = await fetch(
      `https://ai-chieftain-backend.onrender.com/api/context/${sessionId}`,
    );
    const contextData = await contextResponse.json();

    let prompt = "";
    // --- UPDATED, MORE DIRECT PROMPTS ---
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
      // Fallback if no specific context is found
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

// --- Existing Routes ---
router.get("/context/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    // --- FIXED QUERIES TO USE sessionId ---
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

// Step 3: Define the route for creating a booking
// This code will run whenever a POST request is made to '/api/bookings'
router.post("/bookings", async (req, res) => {
  try {
    // 'req.body' contains the JSON data sent from the frontend or our AI function
    const newBooking = new Booking(req.body);

    // Save the new booking document to the MongoDB database
    await newBooking.save();

    // Log a success message to your server console so you know it worked
    console.log("✅ Booking successful:", newBooking);

    // Send a success response back to the client
    // 201 means "Created", which is the correct code for a successful POST request
    res
      .status(201)
      .json({ message: "Booking created successfully!", data: newBooking });
  } catch (error) {
    // If anything goes wrong in the 'try' block, this 'catch' block will run
    console.error("❌ Error creating booking:", error);

    // Send an error response back to the client
    // 500 means "Internal Server Error"
    res
      .status(500)
      .json({ message: "Failed to create booking", error: error.message });
  }
});

// Step 4: Define the route for service requests (we can add logic later)
router.post("/services", async (req, res) => {
  try {
    const newServiceRequest = new ServiceRequest(req.body);
    await newServiceRequest.save();

    // Get the io instance from the app
    const io = req.app.get("socketio");
    // Emit an event named 'new_request' with the request data
    io.emit("new_request", newServiceRequest);

    console.log(
      "✅ Service Request successful, event emitted:",
      newServiceRequest,
    );
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
    // Find all documents in the ServiceRequest collection
    // Sort by creation date in descending order (newest first)
    const requests = await ServiceRequest.find({}).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    console.error("❌ Error fetching service requests:", error);
    res.status(500).json({ message: "Failed to fetch service requests" });
  }
});

// Step 5: Export the router
// We need to export our router so we can use it in our main index.js file.
export default router;
