# 🎮 Real-Time Multiplayer Number Guessing Game

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

## 📖 Overview
This is a full-stack web application that features a classic "High/Low" number guessing game with two distinct architectures: a **Single Player** mode powered by a REST API and a **Multiplayer** mode powered by WebSockets (Socket.io).

The project demonstrates the ability to manage complex state, handle real-time events, and create an engaging user experience with sound effects, animations, and live chat.

## ✨ Key Features

### ⚔️ Multiplayer Mode (Real-Time)
* **Live Matchmaking:** Users enter a lobby and are paired instantly.
* **Real-Time Gameplay:** Opponents guess on the same target number; updates are pushed instantly via WebSockets.
* **Live Chat:** In-game chat with "typing..." indicators.
* **Rematch System:** Synchronized "Play Again" logic requiring consent from both players.
* **Disconnection Handling:** robust handling of opponents leaving mid-game.

### 👤 Single Player Mode
* **Difficulty Levels:** Dynamic difficulty settings (Easy, Medium, Hard).
* **Leaderboard:** High scores are saved to the backend and displayed on request.
* **RESTful Architecture:** Uses `fetch` requests to communicate with the server.

### 🎨 UI/UX Experience
* **Interactive Feedback:** Shake animations for wrong guesses, confetti for wins.
* **Sound Engine:** Distinct audio cues for winning, losing, and chatting.
* **Responsive Design:** Clean, approachable interface for all devices.

## 🛠️ Tech Stack
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (DOM manipulation).
* **Backend:** Node.js, Express.js.
* **Communication:**
    * **Socket.io:** For bidirectional, low-latency communication in Multiplayer.
    * **REST API:** For game logic in Single Player.
* **External Libraries:** `canvas-confetti` (Visual effects).

## 💡 Technical Highlights & Challenges

### Hybrid Architecture
One of the main challenges was managing two different data flows within the same application:
1.  **Single Player** relies on a stateless HTTP request/response cycle.
2.  **Multiplayer** relies on a stateful, persistent Socket.io connection.
*I implemented a state toggle (`isMultiplayer`) on the frontend to dynamically switch between API calls and Socket emissions without reloading the page.*

### Synchronization
Handling race conditions in multiplayer (e.g., what happens if both players guess the winning number at the exact same millisecond?) required careful server-side validation to declare the true winner.

## 🚀 How to Run Locally

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/your-username/number-guessing-game.git](https://github.com/your-username/number-guessing-game.git)
    cd number-guessing-game
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the server**
    ```bash
    node server.js
    ```
    *(Or `nodemon server.js` if you have nodemon installed)*

4.  **Play**
    Open your browser and navigate to `http://localhost:3000`. To test multiplayer locally, open the game in two separate browser tabs (or an Incognito window).

## 🔮 Future Improvements
* Add user authentication (Login/Sign up).
* Create private rooms to play with specific friends.
* Migrate Frontend to React.js for better component management.

---
*Created by Liran Cordova*
