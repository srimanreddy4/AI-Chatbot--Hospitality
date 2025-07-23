import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

// Service icons for different request types
const ServiceIcon = ({ requestType }) => {
  let icon;
  switch (requestType) {
    case "Room Service":
      icon = "🍽️";
      break;
    case "Housekeeping":
      icon = "🧹";
      break;
    case "Maintenance":
      icon = "🔧";
      break;
    default:
      icon = "🛎️";
  }
  return <span className="mr-2 text-xl">{icon}</span>;
};

// Component for displaying critical assistance requests
function AssistanceCard({ request }) {
  return (
    <div className="bg-red-100 p-4 rounded-lg shadow-md border-l-4 border-red-500 mb-4">
      <p className="font-bold text-lg text-red-800">Assistance Needed!</p>
      <p className="text-sm text-slate-600 font-mono mb-2">
        Guest: {request.sessionId.substring(0, 8)}...
      </p>
      <p className="text-slate-700 font-semibold mb-2">
        Reason: <span className="font-normal">{request.reason}</span>
      </p>
      <div className="mt-2 border-t border-red-200 pt-2">
        <p className="text-xs font-bold text-slate-600 mb-1">Recent History:</p>
        <div className="text-xs text-slate-500 space-y-1">
          {request.history.map((msg, index) => (
            <p key={index}>
              <span className="font-semibold">
                {msg.role === "user" ? "Guest" : "AI"}:
              </span>{" "}
              {msg.parts[0].text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// Proactive messaging section for guest engagement
function GuestSessions() {
  const sessions = [
    { sessionId: "guest_room_101", name: "Guest (Room 101)" },
    { sessionId: "guest_room_205", name: "Guest (Room 205)" },
    { sessionId: "guest_vip_suite", name: "Guest (VIP Suite)" },
  ];

  const handlePing = async (sessionId, promptType) => {
    try {
      await fetch("http://localhost:3000/api/proactive-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, promptType }),
      });
      alert(
        `Ping ('${promptType}') sent to session: ${sessionId.substring(0, 8)}...`,
      );
    } catch (error) {
      console.error("Failed to send ping:", error);
      alert("Failed to send ping.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md col-span-1 md:col-span-3">
      <h2 className="text-xl font-bold mb-4 text-slate-800">
        Proactive Guest Reminders
      </h2>
      <div className="space-y-4">
        {sessions.map((session) => (
          <div
            key={session.sessionId}
            className="flex justify-between items-center bg-slate-50 p-3 rounded-lg"
          >
            <p className="text-slate-600 font-mono text-sm">
              <span className="font-bold text-slate-800">{session.name}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  handlePing(session.sessionId, "checkout_reminder")
                }
                className="bg-sky-500 text-white px-4 py-2 text-sm font-semibold rounded-lg shadow-sm hover:bg-sky-600 transition-colors"
              >
                Send Checkout Reminder
              </button>
              <button
                onClick={() =>
                  handlePing(session.sessionId, "appointment_reminder")
                }
                className="bg-indigo-500 text-white px-4 py-2 text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-600 transition-colors"
              >
                Send Spa Reminder
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Individual request card component
function RequestCard({ request, onUpdateStatus }) {
  let statusStyles = {
    Pending: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      border: "border-orange-400",
    },
    "In Progress": {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-400",
    },
    Completed: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-400",
    },
  };
  const currentStyle = statusStyles[request.status] || {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-400",
  };

  return (
    <div
      className={`p-4 mb-4 rounded-lg shadow-md border-l-4 ${currentStyle.bg} ${currentStyle.border} transition-colors`}
    >
      <div className="flex items-center mb-2">
        <ServiceIcon requestType={request.requestType} />
        <p className="font-bold text-lg text-slate-800">
          Room: {request.roomNumber}
        </p>
      </div>
      <p className="text-slate-700 ml-8">{request.details}</p>
      <div className="flex justify-between items-center mt-4">
        <span
          className={`text-xs font-bold px-2 py-1 rounded-full ${currentStyle.bg} ${currentStyle.text}`}
        >
          {request.status}
        </span>
        <div className="flex gap-2">
          {request.status === "Pending" && (
            <button
              onClick={() => onUpdateStatus(request._id, "In Progress")}
              className="bg-blue-500 text-white px-3 py-1 text-sm font-semibold rounded-md shadow-sm hover:bg-blue-600 transition-colors"
            >
              Acknowledge
            </button>
          )}
          {request.status === "In Progress" && (
            <button
              onClick={() => onUpdateStatus(request._id, "Completed")}
              className="bg-green-500 text-white px-3 py-1 text-sm font-semibold rounded-md shadow-sm hover:bg-green-600 transition-colors"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [requests, setRequests] = useState([]);
  const [assistanceRequests, setAssistanceRequests] = useState([]);
  
  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await fetch(`http://localhost:3000/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  useEffect(() => {
    // Load initial requests when dashboard opens
    const fetchInitialRequests = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/services");
        const data = await response.json();
        setRequests(data);
      } catch (error) {
        console.error("Failed to fetch initial requests:", error);
      }
    };
    fetchInitialRequests();

    // Set up real-time socket connection
    const socket = io("http://localhost:3000");
    socket.on("connect", () =>
      console.log("Socket connected successfully!", socket.id),
    );
    socket.on("new_request", (newRequest) => {
      setRequests((prevRequests) => [newRequest, ...prevRequests]);
    });
    socket.on("request_updated", (updatedRequest) => {
      setRequests((prevRequests) =>
        prevRequests.map((req) =>
          String(req._id) === String(updatedRequest._id) ? updatedRequest : req,
        ),
      );
    });
    socket.on("human_assistance_needed", (assistanceRequest) => {
      console.log("Received human assistance request:", assistanceRequest);
      setAssistanceRequests((prev) => [assistanceRequest, ...prev]);
    });
    socket.on("connect_error", (err) =>
      console.error("Socket connection error:", err.message),
    );
    return () => {
      socket.disconnect();
    };
  }, []);

  // Filter requests by status for organized display
  const pendingRequests = requests.filter((r) => r.status === "Pending");
  const inProgressRequests = requests.filter((r) => r.status === "In Progress");
  const completedRequests = requests.filter((r) => r.status === "Completed");

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <header className="bg-white border-b border-slate-200 p-4 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-800 text-center">
          Staff Dashboard
        </h1>
      </header>
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Priority alert section */}
        {assistanceRequests.length > 0 && (
          <div className="lg:col-span-3 bg-red-50 p-4 rounded-xl border border-red-200">
            <h2 className="text-2xl font-bold mb-4 text-red-700">
              Human Assistance Required ({assistanceRequests.length})
            </h2>
            {assistanceRequests.map((req, index) => (
              <AssistanceCard key={index} request={req} />
            ))}
          </div>
        )}
        
        <GuestSessions />

        {/* Request columns organized by status */}
        <div className="bg-slate-100 p-4 rounded-xl">
          <h2 className="text-xl font-bold mb-4 text-slate-700">
            Pending ({pendingRequests.length})
          </h2>
          {pendingRequests.map((req) => (
            <RequestCard
              key={req._id}
              request={req}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>

        <div className="bg-slate-100 p-4 rounded-xl">
          <h2 className="text-xl font-bold mb-4 text-slate-700">
            In Progress ({inProgressRequests.length})
          </h2>
          {inProgressRequests.map((req) => (
            <RequestCard
              key={req._id}
              request={req}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>

        <div className="bg-slate-100 p-4 rounded-xl">
          <h2 className="text-xl font-bold mb-4 text-slate-700">
            Completed ({completedRequests.length})
          </h2>
          {completedRequests.map((req) => (
            <RequestCard
              key={req._id}
              request={req}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
