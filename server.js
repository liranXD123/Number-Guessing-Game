const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require("socket.io");
let waitingPlayer = null; // Will hold the socket of the person waiting
// 1. Logic: This is the "Brain" keeping the secret number
let randomNum = generateNumber();
let maxChances;
let attemptsUsed = 0;
let difficulty = null;



function generateNumber() {
    return Math.floor(Math.random() * 100) + 1;
}

let leaderboard = [];


try {
    // 1. Read the file synchronously (blocks execution until done, which is fine for startup)
    const data = fs.readFileSync('scores.json', 'utf8');

    // 2. Turn the text string "[]" into a real Javascript Array
    leaderboard = JSON.parse(data);

    console.log("Leaderboard loaded successfully:", leaderboard);
} catch (err) {
    console.error("Could not read scores.json, starting with empty leaderboard.", err);
    leaderboard = []; // Fallback to empty if file fails
}


const server = http.createServer((req, res) => {
    console.log('Request for:', req.url);

    if (req.url === '/') {
        // Serve HTML (Keep your existing code here)
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

    else if (req.url === '/index.js') {
        fs.readFile('index.js', (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error');
            } else {
                // IMPORTANT: This must be text/javascript
                res.writeHead(200, { 'Content-Type': 'text/javascript' });
                res.write(data);
                res.end();
            }
        });
    }

    else if (req.url.startsWith('/start')) {

        // A. Set the Difficulty
        if (req.url.includes('difficulty=easy')) {
            maxChances = 10;
        } else if (req.url.includes('difficulty=medium')) {
            maxChances = 5;
        } else if (req.url.includes('difficulty=hard')) {
            maxChances = 3;
        }

        // B. Reset the Game
        attemptsUsed = 0;
        randomNum = generateNumber();

        console.log("Game Started! Target:", randomNum, "Chances:", maxChances);

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end("Game started");
    }

    else if (req.url.startsWith('/guess')) {

        // 1. Get the number from the URL
        // The URL looks like: /guess?number=50
        // We split it by '=' to grab the "50" part
        let parts = req.url.split('=');
        let userGuess = parseInt(parts[1]); // Convert string "50" to number 50
        attemptsUsed++;
        let chancesLeft = maxChances - attemptsUsed;
        // 2. The Logic: Compare guess with the random number
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

        // 3. Send the result back as text
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(message);

    }
        else if (req.url.startsWith('/save-score')) {
        // 1. Get the name
        let parts = req.url.split('=');
        let playerName = parts[1] || "Anonymous";

        // 2. Create the score record
        let newScore = {
            name: playerName,
            score: attemptsUsed,
            date: new Date().toLocaleDateString()
        };

        // 3. Add to memory and save to file
        leaderboard.push(newScore);
        // A. Sort by Score (Ascending: Smallest number is best)
        // If a.score is 2 and b.score is 5, 2 - 5 is negative, so 'a' comes first.
        leaderboard.sort((a, b) => a.score - b.score);

        // B. Keep only the Top 5
        // This chops off everyone after index 5
        leaderboard = leaderboard.slice(0, 5);



        fs.writeFile('scores.json', JSON.stringify(leaderboard, null, 2), (err) => {
            if (err) {
                console.error(err);
                res.writeHead(500);
                res.end("Error");
            } else {
                // Send back the updated list!
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(leaderboard));
            }
        });
    }
    else if(req.url ==='/leaderboard') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(leaderboard));
    }
    else {
        // 404 for everything else
        res.writeHead(404);
        res.end('Not Found');
    }
});


// 👇 1. Setup Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from anywhere
        methods: ["GET", "POST"]
    }
});

// 👇 2. Listen for "Phone Calls" (WebSockets)
// Store active games: { "roomID": targetNumber }
// Store active games: { "roomID": targetNumber }
let activeGames = {};
let rematchVotes = {};
io.on('connection', (socket) => {
    console.log('✨ User connected:', socket.id);

    // 1. MATCHMAKING
    socket.on('join_game', () => {
        if (waitingPlayer) {
            // MATCH FOUND!

            // 👇 CHANGE 1: Create a distinct Room Name (Prefix with "game_")
            const roomID = "game_" + waitingPlayer.id;

            const sharedNum = Math.floor(Math.random() * 100) + 1;

            console.log(`Match Started! Room: ${roomID} | Target: ${sharedNum}`);

            // Join Player 1 (The waiting player)
            waitingPlayer.join(roomID);
            waitingPlayer.data.room = roomID;
            waitingPlayer.emit('game_start', { randomNum: sharedNum });

            // Join Player 2 (You)
            socket.join(roomID);
            socket.data.room = roomID;
            socket.emit('game_start', { randomNum: sharedNum });

            // Store the secret number
            activeGames[roomID] = sharedNum;
            waitingPlayer = null;

        } else {
            console.log("Player waiting:", socket.id);
            waitingPlayer = socket;
        }
    });

    // 2. HANDLING GUESSES
    socket.on('make_guess', (data) => {
        const roomID = socket.data.room;
        const targetNumber = activeGames[roomID];
        const userGuess = parseInt(data.guess);

        // Safety check
        if (!roomID || targetNumber === undefined) return;

        console.log(`Guess from ${socket.id} in ${roomID}: ${userGuess}`);

        // SCENARIO A: WINNER 🏆
        if (userGuess === targetNumber) {
            // Tell YOU (Winner)
            socket.emit('game_over', {
                winner: true,
                msg: `🎉 YOU WON! The number was ${targetNumber}!`
            });

            // Tell OPPONENT (Loser)
            // 👇 CHANGE 2: Ensure we send to the specific game room
            socket.to(roomID).emit('game_over', {
                winner: false,
                msg: `💀 You Lost. Opponent guessed ${targetNumber}.`
            });

            delete activeGames[roomID];
        }

        // SCENARIO B: WRONG GUESS 📉
        else {
            let feedback = userGuess > targetNumber ? "Too High! 📉" : "Too Low! 📈";

            // 1. Update YOU (Black text)
            socket.emit('game_update', {
                msg: `You guessed ${userGuess}: ${feedback}`,
                color: "black"
            });

            // 2. Update OPPONENT (Blue text)
            // 👇 CHANGE 3: This will now definitely reach the other player
            socket.to(roomID).emit('game_update', {
                msg: `Opponent guessed ${userGuess}: ${feedback}`,
                color: "#3182ce" // Nice blue color
            });
        }


    });
    // 3. CHAT MESSAGING
    socket.on('send_chat', (data) => {
        const roomID = socket.data.room;

        // Safety check
        if (!roomID) return;

        // Broadcast the message to the room
        // We include the 'senderID' so the client knows if it's "Me" or "Them"
        io.to(roomID).emit('receive_chat', {
            msg: data.msg,
            senderID: socket.id
        });
    });

    // 4. TYPING INDICATOR
    socket.on('typing', (data) => {
        const roomID = socket.data.room;
        if (!roomID) return;

        // Broadcast to the other person in the room
        // data.isTyping will be true or false
        socket.to(roomID).emit('display_typing', { isTyping: data.isTyping });
    });

    socket.on('disconnect', () => {

        if (waitingPlayer === socket) {
            waitingPlayer = null;
            console.log("Waiting player disconnected.");
        }
        const roomID = socket.data.room;

        if (roomID && activeGames[roomID]) {
            // 1. Notify the opponent
            socket.to(roomID).emit('opponent_left');

            // 2. Destroy the game record (cleanup memory)
            delete activeGames[roomID];

            console.log(`Game in ${roomID} ended due to disconnect.`);
        }
    });
    //rematch handling
    socket.on('request_rematch', () => {
        const roomID = socket.data.room;
        if (!roomID) return;

        // 1. Initialize vote tracking for this room if missing
        if (!rematchVotes[roomID]) {
            rematchVotes[roomID] = { player1: null, player2: null };
        }

        const votes = rematchVotes[roomID];

        // 2. Record this player's vote
        // We use socket.id to ensure one vote per person
        if (votes.player1 === null) votes.player1 = socket.id;
        else if (votes.player2 === null && votes.player1 !== socket.id) votes.player2 = socket.id;

        // 3. Check status
        if (votes.player1 && votes.player2) {
            // --- BOTH AGREED! RESET GAME ---

            const newNum = Math.floor(Math.random() * 100) + 1;
            activeGames[roomID] = newNum;

            // Clear votes for next time
            delete rematchVotes[roomID];

            // Tell everyone to restart
            io.to(roomID).emit('game_start', { randomNum: newNum });
            console.log(`Rematch started in ${roomID} with target ${newNum}`);

        } else {
            // --- ONLY ONE AGREED ---
            // Tell the OTHER person that this person is waiting
            socket.to(roomID).emit('rematch_requested');
        }
    });
});

// 👇 3. Start the Server
const PORT = process.env.PORT || 1300;

server.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`);
});