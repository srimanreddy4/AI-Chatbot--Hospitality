# AI Chieftain - Next-Generation AI Concierge

AI Chieftain is a full-stack, real-time conversational AI platform I built to serve as a next-generation concierge for the hospitality industry. It moves beyond simple chatbots to create a truly intelligent agentic system that understands, remembers, and acts to enhance the guest experience and streamline hotel operations.

> [Link to Live Demo / Video Presentation]

## ✨ Core Features

This project was designed to be a feature-complete, real-world-ready platform.

### 1. The Intelligent AI Agent
The core of the application is a powerful AI agent, not just a chatbot.

- **Robust Function Calling**: The AI connects to real databases to perform actions like creating bookings, filing service requests, and searching the hotel's knowledge base.
- **Retrieval Augmented Generation (RAG)**: The AI has a memory! It can access a guest's booking details and past service requests to provide personalized, context-aware answers. It also has a knowledge base of Hotel FAQs to answer general questions accurately.
- **Sentiment Analysis**: The AI analyzes the guest's mood in every message, allowing it to respond with greater empathy.

### 2. Real-Time Operations Dashboard
A comprehensive dashboard for hotel staff, built for efficiency.

- **Zero-Latency Updates**: Powered by Socket.IO, any request made by a guest appears on the dashboard instantly.
- **Interactive Workflow**: Staff can update the status of a request (Pending → In Progress → Completed) with a single click, and the change is broadcast to all other staff members in real-time.

### 3. Proactive & Agentic AI
The most innovative feature of the platform. The AI doesn't just react; it acts.

- **Proactive Reminders**: Staff can trigger the AI to send personalized reminders to guests for upcoming checkouts or spa appointments. This is a proof-of-concept for a fully autonomous, event-driven system.
- **Intelligent Human Handoff**: The AI knows its limits. It detects user frustration or unanswerable questions and automatically escalates the conversation to the staff dashboard, complete with recent chat history.

### 4. Multi-Channel Accessibility
Guests can connect from anywhere, seamlessly.

- **QR Code Access**: Guests can scan a QR code to instantly launch the chat on their mobile device with no app installation required.
- **Voice-Enabled Chat**: The interface supports full voice-to-text and text-to-speech, allowing for natural, hands-free interaction.
- **Full Telephony Pipeline**: The entire backend infrastructure is built to support a real phone number via Twilio, allowing guests to call in and speak with the AI.

### 5. Multi-User Architecture

- **Persistent, Unique Sessions**: Each guest has their own unique and persistent chat session, ensuring privacy and true personalization.
- **Simulated Guest Environment**: The UI includes a "Guest Switcher" to demonstrate how the system handles multiple, independent user conversations simultaneously, proving its readiness for a production environment.

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO
- **AI & Orchestration**: Google Gemini 1.5 Flash (via API)
- **Database**: MongoDB (with Mongoose)
- **Telephony**: Twilio, ngrok (for development)

## 🚀 Setup and Installation

To run this project locally, you'll need to set up the backend and frontend separately.

### Prerequisites

- Node.js (v18 or later)
- npm / yarn
- A MongoDB Atlas account (or a local MongoDB instance)
- A Google Gemini API Key
- A Twilio account (for the bonus telephony feature)

### Backend Setup

Clone the repository:

```bash
git clone [your-repo-url]
cd [your-repo-name]/backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the backend directory and add the following variables:

```env
MONGO_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
PORT=3000

# Optional for Twilio
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

Seed the database with initial FAQ and Appointment data:

```bash
node seed.js
```

Start the server:

```bash
npm start 
# Or use 'nodemon index.js' for auto-reloading
```

The backend server should now be running on `http://localhost:3000`.

### Frontend Setup

Navigate to the frontend directory:

```bash
cd ../frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The application should now be accessible at `http://localhost:5173`.

### Telephony (Twilio) Setup

Get a Twilio Phone Number: Purchase a voice-enabled number from your Twilio console.

Run ngrok: Expose your local backend server to the internet:

```bash
./ngrok http 3000
```

Configure Twilio Webhook: In your Twilio phone number's configuration, under the "A CALL COMES IN" section, set the webhook to your ngrok URL with the `/voice` path (e.g., `https://your-ngrok-url.ngrok-free.app/voice`) and set the method to HTTP POST.