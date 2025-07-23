import express from "express";
import twilio from "twilio";

const router = express.Router();
const { VoiceResponse } = twilio.twiml;

// Handle incoming phone calls to the Twilio number
router.post("/", (req, res) => {
  const twiml = new VoiceResponse();

  const gather = twiml.gather({
    input: "speech",
    action: "/voice/gather",
    speechTimeout: 3,
    speechModel: "phone_call",
    finishOnKey: "#",
  });

  gather.say(
    "Welcome to the AI Concierge. Please state your request, then press the hash key.",
  );

  // Fallback if no input received
  twiml.say("We didn't receive any input. Goodbye!");
  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

// Process the speech input from the gather
router.post("/gather", async (req, res) => {
  const twiml = new VoiceResponse();
  const speechResult = req.body.SpeechResult;

  if (speechResult && speechResult.trim() !== "") {
    try {
      // Send the speech to our chat API for processing
      const response = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: speechResult,
          sessionId: req.body.CallSid,
        }),
      });
      const data = await response.json();

      twiml.say(data.reply);
    } catch (error) {
      console.error("Error processing voice request:", error);
      twiml.say("Sorry, I ran into an error. Please try again later.");
    }
  } else {
    twiml.say(
      "I'm sorry, I didn't hear anything. Please call back and try again.",
    );
  }

  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

export default router;
