# <img src="frontend/vite-project/public/logo3.png" alt="Vibeo Logo" width="48" height="48" valign="middle" style="margin-right: 10px;" /> Vibeo - Video Calling App

Vibeo is a premium, low-latency, end-to-end encrypted video calling platform styled with modern WhatsApp aesthetics and built on WebRTC and Socket.io. The application supports user authentication, optional 6-digit numeric passcode protections for room gating, dynamic chat overlays, meeting history, and advanced media optimizations.

![Vibeo Mobile Mockup](frontend/vite-project/public/mobile.png)

---

## 🚀 Key Features

*   **🛡️ Passcode Gating**: Enforce 6-digit optional numeric passwords on meeting rooms. Hosts specify them upon creation; joining participants are prompted at the gate (or joined automatically via encrypted URL query parameters).
*   **⚡ Ultra-Low Audio Latency**: Tuned Opus codec configurations override default buffering settings (`minptime=10`, `useinbandfec=1`, `usedtx=1`) to eliminate speech delays and deliver real-time voice streaming.
*   **🎬 Congestion-Optimized Video**: Video bitrate is capped at **1.2 Mbps (1200 kbps)** to guarantee stable, lag-free 720p 30fps feeds even on standard mobile or home internet connections.
*   **🌍 Dynamic ICE/TURN configuration**: An integrated backend API resolves browser TURN configurations on-the-fly, ensuring P2P call traffic traverses strict corporate firewalls and symmetric NATs.
*   **💬 Integrated Chat Drawer**: Active meeting rooms include a sidebar chat panel with scrolling messages and auto-updating participant indicators.
*   **📊 Meeting Activity History**: Authenticated users can view their past meetings, participants list, dates, and click to rejoin immediately.

---

## 🛠️ Installation & Setup

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18+)
*   A running [MongoDB](https://www.mongodb.com/) instance (local or Atlas cloud database)

### 1. Backend Server Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file in the `backend` folder and add your configuration details:
    ```env
    PORT=8000
    MONGO_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/vibeo
    
    # Optional TURN Server config for production traversal:
    TURN_SERVER_URL=turn:your-turn-server.com:3478
    TURN_USERNAME=your-username
    TURN_PASSWORD=your-password
    ```
4.  Start the backend server in development mode:
    ```bash
    npm run dev
    ```

### 2. Frontend Client Setup
1.  Navigate to the frontend folder:
    ```bash
    cd frontend/vite-project
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Vite developer server:
    ```bash
    npm run dev
    ```
4.  Open the application in your browser at `http://localhost:5173`.

---

## 📖 How to Use Vibeo

### Step 1: Sign Up / Sign In
*   Visit the landing page and click **Login** or **Register**.
*   Create a profile to manage your personal dashboard.

### Step 2: Create a Room
*   From your dashboard, click **Create New Meeting**.
*   Customize your Room ID or use the auto-generated one.
*   (Optional) Enter a **numeric passcode** of at least 6 digits to protect your call.
*   Click **Create & Join** to enter your meeting call room.

### Step 3: Share and Invite Friends
*   Inside the meeting room, click the **Copy Join Link** button on the bottom control panel.
*   Send this link to anyone. If the room is password-protected, the passcode is automatically included in the URL parameter (`?passcode=...`), letting your friends bypass the passcode gate automatically!

### Step 4: Join a Call
*   **From Dashboard**: Enter an existing meeting code in the input box. If protected, enter the 6-digit passcode when prompted.
*   **As a Guest (No Login Required)**: Click **Join as Guest** on the landing page, enter the room ID and passcode, and join the call directly.

### Step 5: Check Calling History
*   Click **View History** on the navigation bar to see a history of all meetings you have participated in, along with participant summaries. Click **Rejoin** to jump back into a meeting room.
