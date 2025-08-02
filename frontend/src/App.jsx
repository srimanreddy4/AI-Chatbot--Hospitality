import { useState, useEffect, useRef, useCallback } from "react"; // 1. Import useCallback
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./dashboard.jsx";
import LandingPage from "./landingpage.jsx";
import { io } from "socket.io-client";

// --- Helper Icons and ChatMessage component (unchanged) ---
const MicIcon = ({ isListening }) => (
  <svg
    className={`w-6 h-6 transition-colors ${isListening ? "text-red-500 animate-pulse" : "text-gray-500 hover:text-blue-600"}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
    />
  </svg>
);
const SpeakerIcon = ({ isMuted }) => (
  <svg
    className="w-6 h-6 text-slate-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    {isMuted ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l-5-5m0 5l5-5"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    )}
  </svg>
);
const SendIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
    ></path>
  </svg>
);
function ChatMessage({ message }) {
  const messageClass =
    message.sender === "ai"
      ? "bg-slate-200 text-slate-800 self-start"
      : "bg-blue-600 text-white self-end";
  return (
    <div
      className={`p-3 rounded-xl max-w-lg mx-4 my-2 shadow-sm ${messageClass}`}
    >
      {message.text}
    </div>
  );
}

function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    let currentSessionId = localStorage.getItem("sessionId");
    if (!currentSessionId) {
      currentSessionId = crypto.randomUUID();
      localStorage.setItem("sessionId", currentSessionId);
    }
    setSessionId(currentSessionId);
  }, []);

  // 2. Wrap the 'speak' function in useCallback
  const speak = useCallback(
    (text) => {
      if (isMuted || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    },
    [isMuted],
  ); // It only needs to be recreated if 'isMuted' changes

  useEffect(() => {
    if (!sessionId) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://ai-chatbot-hospitality-backend.onrender.com/api/history/${sessionId}`,
        );
        const historyData = await response.json();
        const formattedMessages = historyData.map((item) => ({
          sender: item.role === "user" ? "user" : "ai",
          text: item.parts[0].text,
        }));

        if (formattedMessages.length === 0) {
          setMessages([
            {
              sender: "ai",
              text: `Hello! Welcome to your personal AI concierge. How can I help?`,
            },
          ]);
        } else {
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
        setMessages([
          { sender: "ai", text: "Sorry, I could not load your chat history." },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const socket = io("https://ai-chatbot-hospitality-backend.onrender.com");
    socketRef.current = socket;
    socket.on("connect", () => {
      console.log("✅ Chat socket connected:", socket.id);
      socket.emit("join_room", sessionId);
    });
    socket.on("proactive_message", (proactiveMessage) => {
      const aiMessage = { sender: "ai", text: proactiveMessage.parts[0].text };
      setMessages((prev) => [...prev, aiMessage]);
      speak(aiMessage.text);
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, speak]); // 3. Add 'speak' to the dependency array

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) =>
      console.error("Speech recognition error:", event.error);
    recognition.onresult = (event) => {
      setInput(event.results[0][0].transcript);
    };
    recognitionRef.current = recognition;
  }, []);

  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setInput("");
      recognitionRef.current?.start();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;
    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = input;
    setInput("");
    setIsLoading(true);
    try {
      const response = await fetch(
        "https://ai-chatbot-hospitality-backend.onrender.com/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: messageToSend,
            sessionId: sessionId,
          }),
        },
      );
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      const aiMessage = { sender: "ai", text: data.reply };
      setMessages((prev) => [...prev, aiMessage]);
      speak(data.reply);
    } catch (error) {
      console.error("Error fetching AI response:", error);
      const errorMessage = {
        sender: "ai",
        text: "Sorry, I ran into an error.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      speak(errorMessage.text);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans">
      <header className="bg-white border-b border-slate-200 p-4 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-500 hover:text-slate-800">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800">AI Concierge</h1>
            <p className="text-xs text-slate-500 font-mono">
              Session: {sessionId?.substring(0, 8)}...
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <SpeakerIcon isMuted={isMuted} />
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col">
          {messages.map((msg, index) => (
            <ChatMessage key={index} message={msg} />
          ))}
          {isLoading && <ChatMessage message={{ sender: "ai", text: "..." }} />}
          <div ref={messagesEndRef} />
        </div>
      </main>
      <footer className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMicClick}
            className="p-3 rounded-full hover:bg-slate-100"
            disabled={!recognitionRef.current || isLoading}
          >
            <MicIcon isListening={isListening} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 p-3 border-slate-300 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ask a question..."
            disabled={isLoading || !sessionId}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
            disabled={isLoading || !sessionId}
          >
            <SendIcon />
          </button>
        </form>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
