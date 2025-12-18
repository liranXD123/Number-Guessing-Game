// --- 1. INITIAL SETUP ---
const socket = io(); // Connect to server


// --- SOUND ENGINE ---
// distinct sounds for winning, losing, and chat
const winSound = new Audio("https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3");
const loseSound = new Audio("https://www.soundjay.com/misc/sounds/fail-trombone-01.mp3");
const chatSound = new Audio("https://www.soundjay.com/button/sounds/button-16.mp3");

function playSound(type) {
    // Reset sound to start (so you can play it rapidly)
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
const gameOverScreen = document.getElementById("game-over-screen");
const yesButton = document.getElementById("yesButton");
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
                    handleGameOver(data.includes("Congratulations"));
                }
            });
    }
});

// --- 4. MULTIPLAYER LOGIC ---
const multiplayerBtn = document.getElementById("multiplayerBtn");
const multiplayerMessage = document.getElementById("multiplayerMessage");

multiplayerBtn.addEventListener("click", function() {
    console.log("Multiplayer Button Clicked!"); // <--- LOOK FOR THIS LOG

    multiplayerBtn.disabled = true;

    // Update the text safely
    if(multiplayerMessage) {
        multiplayerMessage.innerText = "Searching for opponent... ⏳";
    } else {
        console.error("Could not find multiplayerMessage element!");
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
    guessButton.disabled = false;
    chatContainer.style.display = "block";
    chatBox.innerHTML= "";

    gameOverScreen.style.display = "none";


    yesButton.innerText = "Play Again";
    yesButton.disabled = false;
    yesButton.style.background = "#48bb78"; // Original Green
    document.getElementById("end-title").innerText = "Game Over"; // Reset title

});

// Game Updates (High/Low)
socket.on('game_update', (data) => {
    messageTag.innerText = data.msg;
    messageTag.style.color = data.color || "black";
});

// Game Over (Win/Loss)
socket.on('game_over', (data) => {
    // 1. Update text and color
    if (data.winner) {
        messageTag.innerText = data.msg;
        messageTag.style.color = "green";
        document.body.style.backgroundColor = "#e6fffa";
        playSound('win');
        confetti({
            particleCount: 150,
            spread: 70,
            origin: {y: 0.6}
        });
    } else {
        messageTag.innerText = data.msg;
        messageTag.style.color = "red";
        document.body.style.backgroundColor = "#fff5f5";
        playSound('lose');
    }

    // 2. Stop the game
    guessButton.disabled = true;

    // 👇 NEW: Show the "Play Again" screen
   gameOverScreen.style.display = "block";
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

yesButton.addEventListener("click", () => {
    // 1. Change text to show we are waiting
    yesButton.innerText = "Waiting for Opponent... ⏳";
    yesButton.disabled = true; // Prevent double clicking
    yesButton.style.background = "#cbd5e0"; // Turn it gray

    // 2. Tell server
    socket.emit('request_rematch');
});

document.getElementById("saveButton").addEventListener("click", () => {
    let name = document.getElementById("nameInput").value;
    if(name) fetch(`/save-score?name=${name}`).then(() => {
        alert("Saved!");
        location.reload();
    });
});

function handleGameOver(isWin) {
    gameOverScreen.style.display = "block";
    guessInput.style.display = "none";
    guessButton.style.display = "none";

    if(isWin)
    {
        gameScoreArea.style.display = "block";
        confetti({
            particleCount: 150,
            spread: 70,
            origin: {y: 0.6}
        });
        playSound('win');
    }
    else{
        playSound('lose');
        confetti({
            particleCount: 100,
            angle: 270,        // ⬇️ Direction: Down
            spread: 360,       // All across the top
            origin: { y: 0 },  // Start at the very top of the screen
            colors: ['#000000', '#444444', '#777777'], // Grayscale colors
            gravity: 3,        // Falls fast/heavy
            scalar: 0.6,       // Smaller "ash" like particles
            ticks: 200         // Stays on screen a bit longer
        });
        // Add the class
        document.body.classList.add("shake-effect");

        // Remove it after 0.5s so it can happen again next time
        setTimeout(() => {
            document.body.classList.remove("shake-effect");
        }, 500);
    }

}


//chat
const typingIndicator = document.getElementById("typingIndicator");
let typingTimeout = null;

// 1. LISTEN: When I type in the box
chatInput.addEventListener("input", () => {

    // Tell server: "I am typing"
    socket.emit('typing', { isTyping: true });

    // Clear any existing timer (reset the clock)
    if (typingTimeout) clearTimeout(typingTimeout);

    // Set a new timer: If I don't type for 1 second, say "I stopped"
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { isTyping: false });
    }, 1000);
});

// 2. LISTEN: When server says "Opponent is typing"
socket.on('display_typing', (data) => {
    if (data.isTyping) {
        typingIndicator.style.visibility = "visible";
    } else {
        typingIndicator.style.visibility = "hidden";
    }
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

    // 1. Create the Wrapper (holds Label + Bubble)
    const wrapper = document.createElement("div");
    wrapper.classList.add("message-wrapper"); // Add CSS class

    // 2. Create the Label (You / Opponent)
    const label = document.createElement("span");
    label.classList.add("chat-label");

    // 3. Create the Bubble (The text)
    const bubble = document.createElement("div");
    bubble.classList.add("chat-bubble");
    bubble.innerText = data.msg;

    // 4. Decide: Is it ME or THEM?
    if (socket.id === data.senderID) {
        wrapper.classList.add("message-me"); // Right side, Blue gradient
        label.innerText = "You";
    } else {
        wrapper.classList.add("message-them"); // Left side, White/Gray
        label.innerText = "Opponent";
    }

    // 5. Assemble
    wrapper.appendChild(label);
    wrapper.appendChild(bubble);

    // 6. Add to screen
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;

});

socket.on('opponent_left', () => {
    // 1. Lock the game
    guessButton.disabled = true;

    // 2. Show a distinct error message
    messageTag.innerText = "🔌 Opponent disconnected! You win by default.";
    messageTag.style.color = "red";
    document.body.style.backgroundColor = "#fff5f5"; // Light red warning bg

    // 3. Show the "Game Over" popup but change the title
    gameOverScreen.style.display = "block";
    document.getElementById("end-title").innerText = "Opponent Left 🏃‍♂️";

    // 4. Disable Chat (Optional, but good UX)
    chatInput.disabled = true;
    sendChatBtn.disabled = true;
});

socket.on('rematch_requested', () => {
    // Show a notification or change text
    // We can hijack the game over title or the button text
    document.getElementById("end-title").innerText = "Opponent wants a rematch! ⚔️";
    messageTag.innerText = "Click 'Play Again' to accept!";

    // Make the button pulse or glow to encourage clicking
    yesButton.style.background = "#48bb78"; // Bright green
    yesButton.innerText = "Accept Rematch!";
});