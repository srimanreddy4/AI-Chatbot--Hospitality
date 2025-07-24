import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import { UserSession } from "../models/usersession.js";

const router = express.Router();

// Define the AI tools/functions available to the model
const tools = [
  {
    functionDeclarations: [
      {
        name: "create_booking",
        description:
          "Creates a hotel room booking. Must collect user name, check-in date, and number of nights before proceeding. Can ask for additional preferences.",
        parameters: {
          type: "object",
          properties: {
            userName: {
              type: "string",
              description: "The full name of the person booking the room.",
            },
            checkInDate: {
              type: "string",
              description:
                "The check-in date in YYYY-MM-DD format. The current date is July 23, 2025.",
            },
            numberOfNights: {
              type: "number",
              description: "The total number of nights for the stay.",
            },
            numberOfGuests: {
              type: "number",
              description: "The number of guests staying in the room.",
            },
            roomPreference: {
              type: "string",
              description:
                'Any user preference for the room, like "ocean view" or "near the elevator".',
            },
          },
          required: ["userName", "checkInDate", "numberOfNights"],
        },
      },
      {
        name: "create_service_request",
        description:
          "Creates a request for a hotel service like housekeeping or room service. Use this when a user asks for items to be sent to their room.",
        parameters: {
          type: "object",
          properties: {
            roomNumber: {
              type: "number",
              description: "The room number of the guest making the request.",
            },
            requestType: {
              type: "string",
              description:
                'The general category of the request, e.g., "Room Service", "Housekeeping", "Maintenance".',
            },
            details: {
              type: "string",
              description:
                'A specific description of what the user wants, e.g., "2 extra towels" or "1 club sandwich and a coke".',
            },
          },
          required: ["roomNumber", "requestType", "details"],
        },
      },
      {
        name: "search_hotel_faqs",
        description:
          "Searches the hotel's knowledge base for answers to general questions like 'What are the pool hours?' or 'Do you have free Wi-Fi?'. Use this for any question that isn't a booking or a service request.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The user's question, rephrased as a search query.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "request_human_assistance",
        description:
          "Use this function if the user is asking a question you cannot answer with your other tools, or if they are expressing significant frustration.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "A brief summary of why the user needs help.",
            },
          },
          required: ["reason"],
        },
      },
    ],
  },
];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools,
  systemInstruction:
    "You are a helpful hotel concierge AI. You have tools for booking, service requests, searching FAQs, and requesting a human. Use the user's CONTEXT and HISTORY to provide personalized responses. If you cannot help or the user is frustrated, use the 'request_human_assistance' tool. Always respond with a JSON object containing 'reply' and 'sentiment'.",
});

router.post("/", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res
        .status(400)
        .json({ error: "Message and sessionId are required" });
    }

    // Get user context for personalized responses
    const contextResponse = await fetch(
      `http://localhost:3000/api/context/${sessionId}`,
    );
    const contextData = await contextResponse.json();

    let contextString =
      "No current booking or recent requests found for this user.";
    if (contextData.latestBooking || contextData.recentRequests?.length) {
      contextString = `
        Current Booking: ${contextData.latestBooking ? `User ${contextData.latestBooking.userName} is staying until ${new Date(contextData.latestBooking.checkOutDate).toDateString()}.` : "None."}
        Recent Service Requests: ${contextData.recentRequests.map((r) => r.details).join(", ") || "None."}
        `;
    }

    // Load or create user session
    let session = await UserSession.findOne({ sessionId });
    if (!session) {
      session = new UserSession({ sessionId, history: [] });
    }

    const cleanHistory = session.history.map((item) => ({
      role: item.role,
      parts: item.parts.map((part) => ({ text: part.text })),
    }));

    const chat = model.startChat({
      history: cleanHistory,
    });

    const augmentedMessage = `CONTEXT: ${contextString}\n\nUSER QUESTION: ${message}`;

    const result = await chat.sendMessage(augmentedMessage);
    const call = result.response.functionCalls()?.[0];
    let jsonResponse;

    if (call) {
      const { name, args } = call;
      if (name === "create_booking" || name === "create_service_request") {
        let apiEndpoint = name === "create_booking" ? "bookings" : "services";
        let body = {};
        if (name === "create_booking") {
          const checkIn = new Date(args.checkInDate);
          const checkOut = new Date(checkIn);
          checkOut.setDate(checkIn.getDate() + args.numberOfNights);
          body = {
            userName: args.userName,
            checkInDate: args.checkInDate,
            checkOutDate: checkOut.toISOString().split("T")[0],
            numberOfGuests: args.numberOfGuests,
            specialRequests: args.roomPreference,
            sessionId: sessionId,
          };
        } else {
          body = {
            roomNumber: args.roomNumber,
            requestType: args.requestType,
            details: args.details,
            sessionId: sessionId,
          };
        }
        const apiResponse = await fetch(
          `http://localhost:3000/api/${apiEndpoint}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!apiResponse.ok)
          throw new Error(`API call failed with status: ${apiResponse.status}`);
        const apiData = await apiResponse.json();
        const finalResult = await chat.sendMessage([
          {
            functionResponse: {
              name,
              response: { success: true, details: apiData.data },
            },
          },
        ]);
        const textResponse = finalResult.response.text();
        const cleanedText = textResponse.replace(/```json\n|```/g, "").trim();
        jsonResponse = JSON.parse(cleanedText);
      } else if (name === "search_hotel_faqs") {
        console.log("Searching knowledge base for:", args.query);

        const faqResponse = await fetch(
          `http://localhost:3000/api/faqs/search?query=${encodeURIComponent(args.query)}`,
        );

        let toolResult;
        if (faqResponse.ok) {
          const faqData = await faqResponse.json();
          toolResult = { success: true, answer: faqData.answer };
        } else {
          toolResult = {
            success: false,
            error: "No relevant information found.",
          };
        }

        const finalResult = await chat.sendMessage([
          {
            functionResponse: {
              name: "search_hotel_faqs",
              response: toolResult,
            },
          },
        ]);

        const textResponse = finalResult.response.text();
        const cleanedText = textResponse.replace(/```json\n|```/g, "").trim();
        jsonResponse = JSON.parse(cleanedText);
      } else if (name === "request_human_assistance") {
        console.log("Requesting human assistance for:", args.reason);

        // Get recent conversation history for context
        const sessionForHistory = await UserSession.findOne({ sessionId });
        const recentHistory = sessionForHistory
          ? sessionForHistory.history.slice(-5)
          : [];

        // Notify dashboard of assistance request
        const io = req.app.get("socketio");
        io.emit("human_assistance_needed", {
          sessionId,
          reason: args.reason,
          history: recentHistory,
        });

        const toolResult = {
          success: true,
          message: "A human agent has been notified.",
        };

        const finalResult = await chat.sendMessage([
          {
            functionResponse: {
              name: "request_human_assistance",
              response: toolResult,
            },
          },
        ]);

        const textResponse = finalResult.response.text();
        const cleanedText = textResponse.replace(/```json\n|```/g, "").trim();
        jsonResponse = JSON.parse(cleanedText);
      }
    } else {
      const textResponse = result.response.text();
      const cleanedText = textResponse.replace(/```json\n|```/g, "").trim();
      jsonResponse = JSON.parse(cleanedText);
    }

    // Save the conversation to session history
    session.history.push({ role: "user", parts: [{ text: message }] });
    session.history.push({
      role: "model",
      parts: [{ text: jsonResponse.reply }],
      sentiment: jsonResponse.sentiment,
    });
    await session.save();

    console.log(
      `Sentiment for session ${sessionId}: ${jsonResponse.sentiment}`,
    );
    console.log(
      `Session ${sessionId} history now has ${session.history.length} messages.`,
    );
    res.json({ reply: jsonResponse.reply });
  } catch (error) {
    console.error("Error in chat logic:", error);
    res.status(500).json({ error: "Something went wrong with the AI chat." });
  }
});

export default router;
