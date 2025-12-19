const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require("socket.io");

// Global variables for game state
let waitingPlayer = null; // Queue to hold a player waiting for an opponent
let randomNum = generateNumber(); // Current target number (Single Player)
let maxChances;
let attemptsUsed = 0;
let difficulty = null;

/**
 * Generates a random integer between 1 and 100
 */
function generateNumber() {
    return Math.floor(Math.random() * 100) + 1;
}

// --- LEADERBOARD INITIALIZATION ---
let leaderboard = [];

try {
    // 1. Read the file synchronously (blocks execution until done, acceptable for server startup)
    const data = fs.readFileSync('scores.json', 'utf8');

    // 2. Parse JSON string into a JavaScript Array
    leaderboard = JSON.parse(data);

    console.log("Leaderboard loaded successfully:", leaderboard);
} catch (err) {
    console.error("Could not read scores.json, starting with empty leaderboard.", err);
    leaderboard = []; // Fallback to empty array to prevent crashes
}

// --- HTTP SERVER SETUP ---
const server = http.createServer((req, res) => {
    console.log('Request for:', req.url);

    // 1. Serve the Frontend HTML
    if (req.url === '/') {
        fs.readFile('index.html', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write(data);
                res.end();
            }
        });
    }

    // 2. Serve the Client-Side JavaScript
    else if (req.url === '/index.js') {
        fs.readFile('index.js', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error');
            } else {
                // IMPORTANT: Header must be text/javascript for the browser to execute it
                res.writeHead(200, { 'Content-Type': 'text/javascript' });
                res.write(data);
                res.end();
            }
        });
    }

    // 3. Single Player API: Start Game
    else if (req.url.startsWith('/start')) {

        // A. Set Difficulty based on Query Params
        if (req.url.includes('difficulty=easy')) {
            maxChances = 10;
        } else if (req.url.includes('difficulty=medium')) {
            maxChances = 5;
        } else if (req.url.includes('difficulty=hard')) {
            maxChances = 3;
        }

        // B. Reset Game State
        attemptsUsed = 0;
        randomNum = generateNumber();

        console.log("Game Started! Target:", randomNum, "Chances:", maxChances);

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end("Game started");
    }

    // 4. Single Player API: Handle Guess
    else if (req.url.startsWith('/guess')) {

        // Parse the number from the URL (e.g., /guess?number=50)
        let parts = req.url.split('=');
        let userGuess = parseInt(parts[1]);
        attemptsUsed++;
        let chancesLeft = maxChances - attemptsUsed;

        // Game Logic: Compare guess vs target
        let message = '';

        if (userGuess === randomNum) {
            message = `Congratulations! ${userGuess} is the number! You guessed it in ` + attemptsUsed + ' tries!';
        }
        else if (chancesLeft === 0) {
            message = 'Game over! The correct number was: ' + randomNum;
        }
        else if (userGuess > randomNum) {
            message = `${userGuess} is too high! Try again. Guesses left: ` + chancesLeft;
        }
        else if (userGuess < randomNum)
            message = `${userGuess} is too low! Try again. Guesses left: ` + chancesLeft;

        // Return feedback to client
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(message);

    }
    // 5. Single Player API: Save Score
    else if (req.url.startsWith('/save-score')) {
        // Extract player name
        let parts = req.url.split('=');
        let playerName = parts[1] || "Anonymous";

        // Create score object
        let newScore = {
            name: playerName,
            score: attemptsUsed,
            date: new Date().toLocaleDateString()
        };

        // Add to array
        leaderboard.push(newScore);

        // Sort Ascending (Lower score = Better)
        leaderboard.sort((a, b) => a.score - b.score);

        // Keep only Top 5
        leaderboard = leaderboard.slice(0, 5);

        // Persist to disk
        fs.writeFile('scores.json', JSON.stringify(leaderboard, null, 2), (err) => {
            if (err) {
                console.error(err);
                res.writeHead(500);
                res.end("Error");
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(leaderboard));
            }
        });
    }
    // 6. API: Get Leaderboard
    else if(req.url ==='/leaderboard') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(leaderboard));
    }
    // 404 handler
    else {
        res.writeHead(404);
        res.end('Not Found');
    }
});


// --- SOCKET.IO SERVER SETUP ---
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from any origin (Dev only)
        methods: ["GET", "POST"]
    }
});

// Store active games: Key = RoomID, Value = Target Number
let activeGames = {};
// Store rematch votes: Key = RoomID, Value = { player1: socketId, player2: socketId }
let rematchVotes = {};

io.on('connection', (socket) => {
    console.log('✨ User connected:', socket.id);

    // 1. MATCHMAKING LOGIC
    socket.on('join_game', () => {
        if (waitingPlayer) {
            // --- MATCH FOUND ---

            // Create unique Room ID using the waiting player's ID
            const roomID = "game_" + waitingPlayer.id;
            const sharedNum = Math.floor(Math.random() * 100) + 1;

            console.log(`Match Started! Room: ${roomID} | Target: ${sharedNum}`);

            // Setup Player 1 (Waiting Player)
            waitingPlayer.join(roomID);
            waitingPlayer.data.room = roomID;
            waitingPlayer.emit('game_start', { randomNum: sharedNum });

            // Setup Player 2 (Current Socket)
            socket.join(roomID);
            socket.data.room = roomID;
            socket.emit('game_start', { randomNum: sharedNum });

            // Initialize Game State
            activeGames[roomID] = sharedNum;
            waitingPlayer = null; // Clear queue

        } else {
            // --- NO MATCH, ADD TO QUEUE ---
            console.log("Player waiting:", socket.id);
            waitingPlayer = socket;
        }
    });

    // 2. GUESS HANDLING (MULTIPLAYER)
    socket.on('make_guess', (data) => {
        const roomID = socket.data.room;
        const targetNumber = activeGames[roomID];
        const userGuess = parseInt(data.guess);

        // Security/Error Check
        if (!roomID || targetNumber === undefined) return;

        console.log(`Guess from ${socket.id} in ${roomID}: ${userGuess}`);

        // SCENARIO A: WINNER 🏆
        if (userGuess === targetNumber) {
            // Notify Winner
            socket.emit('game_over', {
                winner: true,
                msg: `🎉 YOU WON! The number was ${targetNumber}!`
            });

            // Notify Loser (using socket.to -> sends to everyone in room EXCEPT sender)
            socket.to(roomID).emit('game_over', {
                winner: false,
                msg: `💀 You Lost. Opponent guessed ${targetNumber}.`
            });

            // Cleanup game state
            delete activeGames[roomID];
        }

        // SCENARIO B: WRONG GUESS 📉
        else {
            let feedback = userGuess > targetNumber ? "Too High! 📉" : "Too Low! 📉";

            // Update Sender (Black Text)
            socket.emit('game_update', {
                msg: `You guessed ${userGuess}: ${feedback}`,
                color: "black"
            });

            // Update Opponent (Blue Text)
            socket.to(roomID).emit('game_update', {
                msg: `Opponent guessed ${userGuess}: ${feedback}`,
                color: "#3182ce"
            });
        }
    });

    // 3. CHAT MESSAGING
    socket.on('send_chat', (data) => {
        const roomID = socket.data.room;
        if (!roomID) return;

        // Broadcast entire object including senderID for styling on frontend
        io.to(roomID).emit('receive_chat', {
            msg: data.msg,
            senderID: socket.id
        });
    });

    // 4. TYPING INDICATOR
    socket.on('typing', (data) => {
        const roomID = socket.data.room;
        if (!roomID) return;

        // Broadcast boolean to opponent only
        socket.to(roomID).emit('display_typing', { isTyping: data.isTyping });
    });

    // 5. DISCONNECT HANDLING
    socket.on('disconnect', () => {
        // If the waiting player leaves, clear the queue
        if (waitingPlayer === socket) {
            waitingPlayer = null;
            console.log("Waiting player disconnected.");
        }

        const roomID = socket.data.room;
        // If a player in an active game leaves, notify opponent
        if (roomID && activeGames[roomID]) {
            socket.to(roomID).emit('opponent_left');
            delete activeGames[roomID];
            console.log(`Game in ${roomID} ended due to disconnect.`);
        }
    });

    // 6. REMATCH LOGIC (Synchronization)
    socket.on('request_rematch', () => {
        const roomID = socket.data.room;
        if (!roomID) return;

        // Initialize vote object for room if not exists
        if (!rematchVotes[roomID]) {
            rematchVotes[roomID] = { player1: null, player2: null };
        }

        const votes = rematchVotes[roomID];

        // Fill empty vote slot with socket ID
        if (votes.player1 === null) votes.player1 = socket.id;
        else if (votes.player2 === null && votes.player1 !== socket.id) votes.player2 = socket.id;

        // Check if both slots are filled (Both players agreed)
        if (votes.player1 && votes.player2) {
            // --- RESTART GAME ---
            const newNum = Math.floor(Math.random() * 100) + 1;
            activeGames[roomID] = newNum;

            delete rematchVotes[roomID]; // Reset votes

            // Notify both clients to start
            io.to(roomID).emit('game_start', { randomNum: newNum });
            console.log(`Rematch started in ${roomID} with target ${newNum}`);

        } else {
            // --- WAITING FOR OTHER PLAYER ---
            socket.to(roomID).emit('rematch_requested');
        }
    });
});

// --- SERVER START ---
const PORT = process.env.PORT || 1300;
server.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`);
});