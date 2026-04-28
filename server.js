const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
app.use(express.static("public"));

let rooms = {};
let waitingPlayer = null;

io.on("connection", (socket) => {
    if (waitingPlayer) {
        const roomId = waitingPlayer.id + socket.id;
        socket.join(roomId);
        waitingPlayer.join(roomId);
        rooms[roomId] = { players: [waitingPlayer.id, socket.id], choices: {} };
        io.to(roomId).emit("start", "Пара найдена! Сделайте выбор.");
        waitingPlayer = null;
    } else {
        waitingPlayer = socket;
        socket.emit("message", "Ожидаем напарника...");
    }

    socket.on("makeChoice", (choice) => {
        const roomId = Object.keys(rooms).find(id => rooms[id].players.includes(socket.id));
        if (!roomId) return;
        rooms[roomId].choices[socket.id] = choice;

        if (Object.keys(rooms[roomId].choices).length === 2) {
            const p = rooms[roomId].players;
            const c = rooms[roomId].choices;
            let res = { [p[0]]: "", [p[1]]: "" };

            if (c[p[0]] === 'silent' && c[p[1]] === 'silent') res = { [p[0]]: "0.5 года", [p[1]]: "0.5 года" };
            else if (c[p[0]] === 'betray' && c[p[1]] === 'silent') res = { [p[0]]: "Свобода", [p[1]]: "10 лет" };
            else if (c[p[0]] === 'silent' && c[p[1]] === 'betray') res = { [p[0]]: "10 лет", [p[1]]: "Свобода" };
            else res = { [p[0]]: "2 года", [p[1]]: "2 года" };

            console.log(`Игра завершена: ${res[p[0]]} vs ${res[p[1]]}`);
            io.to(p[0]).emit("result", { text: `Ваш срок: ${res[p[0]]}. Напарник: ${c[p[1]] === 'silent' ? 'Промолчал' : 'Предал'}` });
            io.to(p[1]).emit("result", { text: `Ваш срок: ${res[p[1]]}. Напарник: ${c[p[0]] === 'silent' ? 'Промолчал' : 'Предал'}` });
            delete rooms[roomId];
        }
    });
});
http.listen(process.env.PORT || 3000);
