# AI Hotel Concierge - IIT Hackathon 2025

**Submission for Challenge 1: AI Chieftain – LLM Chatbot for Hospitality**

This project is a next-generation, AI-powered concierge chatbot designed to enhance the guest experience in the hospitality industry. It features a seamless voice and chat interface for guests and a powerful, real-time dashboard for hotel staff, creating a complete and interactive operational loop.

---

## 🎥 Live Demo & Walkthrough

Watch a complete video demonstration of the application, showcasing the user chat interface and the real-time staff dashboard in action.

**[Click here to watch the full demo on Loom](https://www.loom.com/share/841d9660906e4d549a54938f323ba204?sid=491d3b88-4877-4ede-b32b-172481caa29c)**

[![Project Demo Thumbnail](https://cdn.loom.com/sessions/thumbnails/841d9660906e4d549a54938f323ba204-with-play.gif)](https://www.loom.com/share/841d9660906e4d549a54938f323ba204?sid=491d3b88-4877-4ede-b32b-172481caa29c)

---

## ✨ Core Features

* **Conversational AI:** Utilizes Google's Gemini 2.0 Flash model to understand user intent and provide intelligent, human-like responses to a wide range of queries.
* **Voice & Chat Interface:** Guests can interact with the chatbot using either text-based chat or voice commands for a hands-free experience.
* **Real-time Staff Dashboard:** A dedicated dashboard for hotel staff that displays incoming booking and room service requests instantly, powered by WebSockets.
* **Interactive Request Management:** Staff can approve or decline guest requests directly from the dashboard. This action sends a real-time confirmation message back to the guest in their chat window, closing the communication loop.
* **Context-Aware Personalization:** The AI maintains a memory of the current conversation, allowing it to provide smart, personalized suggestions based on previous interactions.
* **Smart Intent Recognition:** The system accurately distinguishes between general queries, booking requests, room service orders, and requests to see the menu, routing each to the appropriate action.
* **QR Code Accessibility:** Designed to be accessed instantly by scanning a QR code, launching the web application without requiring any app installation.

---

## 🛠️ Tech Stack

* **Frontend:** React.js, Axios, Socket.IO Client
* **Backend:** Node.js, Express.js
* **Database:** MongoDB with Mongoose
* **AI & NLP:** Google Gemini 2.0 Flash API
* **Real-time Communication:** Socket.IO
* **Voice Recognition:** Web Speech API (built into modern browsers)

---

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

* Node.js and npm installed
* A MongoDB Atlas account (or a local MongoDB instance)
* A Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone the Repository

```bash
git clone [https://github.com/Alok2580/ai-chieftain-chatbot.git](https://github.com/Alok2580/ai-chieftain-chatbot.git)
cd ai-chieftain-chatbot
````

### 2\. Backend Setup

```bash
# Navigate to the backend folder
cd backend

# Install dependencies
npm install
```

Create a `.env` file in the `/backend` folder with the following contents:

````
MONGO_URI=YOUR_MONGODB_CONNECTION_STRING
PORT=5001
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```bash
# Start the backend server
npm start
````

The backend will be running on `http://localhost:5001`.

### 3\. Frontend Setup

```bash
# Open a new terminal and navigate to the frontend folder
cd frontend

# Install dependencies
npm install

# Start the frontend development server
npm start
```

The frontend will open automatically in your browser at `http://localhost:3000`.

### 4\. How to Use

  * **Chatbot:** Open `http://localhost:3000` in your browser.
  * **Staff Dashboard:** Open `http://localhost:3000/dashboard` in a separate browser tab to see requests in real-time.

-----

## 🔮 Future Improvements

  * **Twilio Integration:** Implement the bonus functionality to allow guests to interact with the concierge via SMS or phone calls for greater accessibility.
  * **Expanded Management:** Add "Completed" and "In Progress" statuses to the dashboard for more granular control over guest requests.
  * **User Profiles:** Store guest history to provide even deeper personalization across multiple sessions (e.g., remembering a guest's favorite room service order).

<!-- end list -->
