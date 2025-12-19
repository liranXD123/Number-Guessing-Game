// --- 1. INITIAL SETUP ---
const socket = io(); // Connect to server

// --- SOUND ENGINE ---
const winSound = new Audio("https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3");
const loseSound = new Audio("https://www.soundjay.com/misc/sounds/fail-trombone-01.mp3");
const chatSound = new Audio("https://www.soundjay.com/button/sounds/button-16.mp3");

function playSound(type) {
    if (type === 'win') { winSound.currentTime = 0; winSound.play(); }
    if (type === 'lose') { loseSound.currentTime = 0; loseSound.play(); }
    if (type === 'chat') { chatSound.currentTime = 0; chatSound.play(); }
}

// Elements
const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const messageTag = document.getElementById("message");
const guessInput = document.getElementById("userGuess");
const guessButton = document.getElementById("guessButton");
const gameOverSinglePlayer = document.getElementById("game-over-screen-singleplayer");
const gameOverMultiplayer = document.getElementById("game-over-screen-multiplayer");
const yesButtonSinglePlayer = document.getElementById("yesButtonSinglePlayer");
const yesButtonMultiPlayer = document.getElementById("yesButtonMultiplayer");
const gameScoreArea = document.getElementById("game-score-area");
const chatContainer = document.getElementById("chat-container");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

// Variables
let isMultiplayer = false;

// --- 2. SINGLE PLAYER BUTTONS ---
document.getElementById("easyButton").addEventListener("click", () => startGame("easy"));
document.getElementById("mediumButton").addEventListener("click", () => startGame("medium"));
document.getElementById("hardButton").addEventListener("click", () => startGame("hard"));

function startGame(diff) {
    isMultiplayer = false;
    setupScreen.style.display = "none";
    gameScreen.style.display = "block";

    // Ensure inputs are visible (in case they were hidden by a previous game over)
    guessInput.style.display = "inline-block";
    guessButton.style.display = "inline-block";
    guessButton.disabled = false;
    messageTag.innerText = "Game Started! Guess a number.";
    messageTag.style.color = "black";

    fetch(`/start?difficulty=${diff}`);
}

// --- 3. GUESS BUTTON LOGIC (THE BRAIN) ---
guessButton.addEventListener("click", function() {
    let userNumber = guessInput.value;
    if(userNumber === "") return;

    if (isMultiplayer) {
        // MULTIPLAYER MODE: Send to Socket
        socket.emit('make_guess', { guess: userNumber });
        guessInput.value = "";
    } else {
        // SINGLE PLAYER MODE: Send to API
        fetch(`/guess?number=${userNumber}`)
            .then(res => res.text())
            .then(data => {
                messageTag.innerText = data;
                guessInput.value = "";
                if (data.includes("Game over") || data.includes("Congratulations")) {
                    handleGameOverSinglePlayer(data.includes("Congratulations"));
                }
            });
    }
});

// --- 4. MULTIPLAYER LOGIC ---
const multiplayerBtn = document.getElementById("multiplayerBtn");
const multiplayerMessage = document.getElementById("multiplayerMessage");

multiplayerBtn.addEventListener("click", function() {
    console.log("Multiplayer Button Clicked!");
    multiplayerBtn.disabled = true;

    if(multiplayerMessage) {
        multiplayerMessage.innerText = "Searching for opponent... ⏳";
    }

    socket.emit('join_game');
});

// Start Game Signal
socket.on('game_start', function(data) {
    isMultiplayer = true;
    setupScreen.style.display = "none";
    gameScreen.style.display = "block";
    document.querySelector("#game-screen h1").innerText = "⚔️ Multiplayer Mode ⚔️";
    messageTag.innerText = "Opponent found! Game on!";
    messageTag.style.color = "black";

    // Reset inputs
    guessButton.disabled = false;
    guessInput.style.display = "inline-block";
    guessButton.style.display = "inline-block";

    chatContainer.style.display = "block";
    chatBox.innerHTML= "";
    gameOverMultiplayer.style.display = "none";

    yesButtonMultiPlayer.innerText = "Play Again";
    yesButtonMultiPlayer.disabled = false;
    yesButtonMultiPlayer.style.background = "#48bb78"; // Original Green
    document.getElementById("end-title").innerText = "Game Over";
});

// Game Updates (High/Low)
socket.on('game_update', (data) => {
    messageTag.innerText = data.msg;
    messageTag.style.color = data.color || "black";
});

// Game Over (Win/Loss) - Multiplayer
socket.on('game_over', (data) => {
    if (data.winner) {
        messageTag.innerText = data.msg;
        messageTag.style.color = "green";
        document.body.style.backgroundColor = "#e6fffa";
        playSound('win');
        confetti({ particleCount: 150, spread: 70, origin: {y: 0.6} });
    } else {
        messageTag.innerText = data.msg;
        messageTag.style.color = "red";
        document.body.style.backgroundColor = "#fff5f5";
        playSound('lose');
    }

    guessButton.disabled = true;
    // Show Multiplayer specific game over screen
    gameOverMultiplayer.style.display = "block";
});


// --- 5. LEADERBOARD & UTILS ---
document.getElementById("showLeaderboardBtn").addEventListener("click", () => {
    fetch('/leaderboard').then(res => res.json()).then(data => {
        let list = "<h3>🏆 Top Players</h3><ul>";
        data.forEach(p => list += `<li><b>${p.name}</b>: ${p.score}</li>`);
        list += "</ul>";
        const div = document.createElement("div");
        div.className = "leaderboard-container";
        div.innerHTML = list;
        setupScreen.appendChild(div);
        document.getElementById("showLeaderboardBtn").style.display = "none";
    });
});

// --- 6. GAME OVER HANDLERS ---

// === SINGLE PLAYER "PLAY AGAIN" LOGIC (FILLED IN) ===
yesButtonSinglePlayer.addEventListener("click", () => {
    // 1. Hide the Game Over modal
    gameOverSinglePlayer.style.display = "none";

    // 2. Hide the Game Screen and Show Setup Screen (Back to Menu)
    gameScreen.style.display = "none";
    setupScreen.style.display = "block";

    // 3. Reset State
    isMultiplayer = false;
    document.body.style.backgroundColor = ""; // Reset background
    document.body.classList.remove("shake-effect");
    messageTag.innerText = "";
    gameScoreArea.style.display = "none"; // Hide save score form

    // 4. Reset Inputs (Crucial: Unhide them for the next game)
    guessInput.style.display = "inline-block";
    guessButton.style.display = "inline-block";
    guessInput.value = "";
});


// === MULTIPLAYER "PLAY AGAIN" LOGIC ===
yesButtonMultiPlayer.addEventListener("click", () => {
    yesButtonMultiPlayer.innerText = "Waiting for Opponent... ⏳";
    yesButtonMultiPlayer.disabled = true;
    yesButtonMultiPlayer.style.background = "#cbd5e0";
    socket.emit('request_rematch');
});

document.getElementById("saveButton").addEventListener("click", () => {
    let name = document.getElementById("nameInput").value;
    if(name) fetch(`/save-score?name=${name}`).then(() => {
        alert("Saved!");
        location.reload();
    });
});

function handleGameOverSinglePlayer(isWin) {
    gameOverSinglePlayer.style.display = "block";

    // Hide inputs so user can't guess anymore
    guessInput.style.display = "none";
    guessButton.style.display = "none";

    if(isWin) {
        gameScoreArea.style.display = "block";
        confetti({ particleCount: 150, spread: 70, origin: {y: 0.6} });
        playSound('win');
    } else {
        playSound('lose');
        confetti({
            particleCount: 100, angle: 270, spread: 360, origin: { y: 0 },
            colors: ['#000000', '#444444', '#777777'],
            gravity: 3, scalar: 0.6, ticks: 200
        });

        document.body.classList.add("shake-effect");
        setTimeout(() => {
            document.body.classList.remove("shake-effect");
        }, 500);
    }
}




// --- 7. CHAT LOGIC ---
const typingIndicator = document.getElementById("typingIndicator");
let typingTimeout = null;

chatInput.addEventListener("input", () => {
    socket.emit('typing', { isTyping: true });
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { isTyping: false });
    }, 1000);
});

socket.on('display_typing', (data) => {
    typingIndicator.style.visibility = data.isTyping ? "visible" : "hidden";
});

sendChatBtn.addEventListener("click", () => {
    let message = chatInput.value;
    if(message === "") return;
    socket.emit('send_chat', {msg: message});
    chatInput.value = "";
    socket.emit('typing', { isTyping: false });
    clearTimeout(typingTimeout);
});

socket.on('receive_chat', (data) => {
    playSound('chat');
    const wrapper = document.createElement("div");
    wrapper.classList.add("message-wrapper");
    const label = document.createElement("span");
    label.classList.add("chat-label");
    const bubble = document.createElement("div");
    bubble.classList.add("chat-bubble");
    bubble.innerText = data.msg;

    if (socket.id === data.senderID) {
        wrapper.classList.add("message-me");
        label.innerText = "You";
    } else {
        wrapper.classList.add("message-them");
        label.innerText = "Opponent";
    }

    wrapper.appendChild(label);
    wrapper.appendChild(bubble);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('opponent_left', () => {
    guessButton.disabled = true;
    messageTag.innerText = "🔌 Opponent disconnected! You win by default.";
    messageTag.style.color = "red";
    document.body.style.backgroundColor = "#fff5f5";

    // Ensure we show the Multiplayer Game Over screen
    gameOverMultiplayer.style.display = "block";
    document.getElementById("end-title").innerText = "Opponent Left 🏃‍♂️";

    chatInput.disabled = true;
    sendChatBtn.disabled = true;
});

socket.on('rematch_requested', () => {
    document.getElementById("end-title").innerText = "Opponent wants a rematch! ⚔️";
    messageTag.innerText = "Click 'Play Again' to accept!";
    yesButtonMultiPlayer.style.background = "#48bb78";
    yesButtonMultiPlayer.innerText = "Accept Rematch!";
});