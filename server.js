const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

let waitingPlayer = null;
let rooms = {};

io.on("connection", (socket) => {
    socket.on("joinGame", (userName) => {
        socket.userName = userName;

        if (waitingPlayer) {
            const roomId = waitingPlayer.id + socket.id;
            socket.join(roomId);
            waitingPlayer.join(roomId);

            rooms[roomId] = {
                players: [waitingPlayer, socket],
                choices: {}
            };

            // Просто даем сигнал к началу, не передавая имен
            io.to(roomId).emit("start");
            
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
                if (me === 'silent' && peer === 'silent') return { res: "0.5 года", text: "Вы оба промолчали." };
                if (me === 'betray' && peer === 'silent') return { res: "Свобода", text: "Вы предали напарника!" };
                if (me === 'silent' && peer === 'betray') return { res: "10 лет", text: "Напарник предал вас..." };
                return { res: "2 года", text: "Вы оба предали друг друга." };
            };

            p.forEach((player, index) => {
                const peer = p[1 - index];
                const result = calc(player.id, peer.id);
                // Только здесь мы отправляем имя напарника
                io.to(player.id).emit("result", {
                    text: result.text,
                    prisonTime: result.res,
                    partnerName: peer.userName,
                    partnerChoice: c[peer.id] === 'silent' ? 'Промолчать' : 'Предать'
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
