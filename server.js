const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

let waitingPlayer = null;
let rooms = {};

io.on("connection", (socket) => {
    socket.on("joinGame", (userName) => {
        socket.userName = userName; // Сохраняем имя в объекте сокета

        if (waitingPlayer) {
            const roomId = waitingPlayer.id + socket.id;
            socket.join(roomId);
            waitingPlayer.join(roomId);

            rooms[roomId] = {
                players: [waitingPlayer, socket],
                choices: {}
            };

            // Говорим каждому имя его напарника сразу при начале
            io.to(waitingPlayer.id).emit("start", { partnerName: socket.userName });
            io.to(socket.id).emit("start", { partnerName: waitingPlayer.userName });
            
            waitingPlayer = null;
        } else {
            waitingPlayer = socket;
            socket.emit("message", "Ожидаем напарника...");
        }
    });

    socket.on("makeChoice", (choice) => {
        const roomId = Object.keys(rooms).find(id => rooms[id].players.some(p => p.id === socket.id));
        if (!roomId) return;

        rooms[roomId].choices[socket.id] = choice;

        if (Object.keys(rooms[roomId].choices).length === 2) {
            const p = rooms[roomId].players;
            const c = rooms[roomId].choices;

            const calc = (meId, peerId) => {
                const me = c[meId], peer = c[peerId];
                if (me === 'silent' && peer === 'silent') return { res: "0.5 года", text: "Сотрудничество!" };
                if (me === 'betray' && peer === 'silent') return { res: "Свобода", text: "Вы предали!" };
                if (me === 'silent' && peer === 'betray') return { res: "10 лет", text: "Вас предали..." };
                return { res: "2 года", text: "Оба предали" };
            };

            p.forEach((player, index) => {
                const peer = p[1 - index];
                const result = calc(player.id, peer.id);
                io.to(player.id).emit("result", {
                    text: result.text + " Ваш срок: " + result.res,
                    partnerName: peer.userName,
                    partnerChoice: c[peer.id] === 'silent' ? 'Молчать' : 'Предать'
                });
            });
            delete rooms[roomId];
        }
    });

    socket.on("disconnect", () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
    });
});

http.listen(process.env.PORT || 3000);
