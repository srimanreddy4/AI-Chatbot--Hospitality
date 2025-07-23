import React from "react";
import { Link } from "react-router-dom";

function LandingPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-100 font-sans">
      <div className="text-center p-12 bg-white rounded-xl shadow-2xl max-w-lg">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">
          Welcome to AI Concierge
        </h1>
        <p className="text-slate-600 mb-8">
          Your next-generation hospitality assistant. Please select your role to
          continue.
        </p>
        {/* Main navigation buttons for different user types */}
        <div className="flex justify-center gap-6">
          <Link
            to="/chat"
            className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transform hover:-translate-y-1 transition-all duration-300"
          >
            I am a Guest
          </Link>
          <Link
            to="/dashboard"
            className="px-8 py-4 bg-slate-700 text-white font-semibold rounded-lg shadow-lg hover:bg-slate-800 transform hover:-translate-y-1 transition-all duration-300"
          >
            I am a Staff Member
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
