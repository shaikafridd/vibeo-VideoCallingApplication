import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};
let socketToUsername = {};

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);

        socket.on("join-call", (path, username) => {
            if (connections[path] === undefined) {
                connections[path] = [];
            }
            connections[path].push(socket.id);
            timeOnline[socket.id] = new Date();
            socketToUsername[socket.id] = username || "Guest";

            // Send chat history of this room to the newly joined client
            if (messages[path] !== undefined) {
                for (let a = 0; a < messages[path].length; a++) {
                    io.to(socket.id).emit(
                        "chat-message",
                        messages[path][a]['data'],
                        messages[path][a]['sender'],
                        messages[path][a]['socket-id-sender']
                    );
                }
            }

            // Notify other users in the room
            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path], socketToUsername);
            }
        });

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        socket.on("chat-message", (data, sender) => {
            // Find which room/path the socket belongs to
            let key;
            for (const [k, v] of Object.entries(connections)) {
                if (v.includes(socket.id)) {
                    key = k;
                    break;
                }
            }

            if (key !== undefined) {
                if (messages[key] === undefined) {
                    messages[key] = [];
                }

                messages[key].push({
                    data: data,
                    sender: sender,
                    "socket-id-sender": socket.id
                });

                console.log("message received on key:", key, "sender:", sender, "data:", data);

                // Broadcast to all users in the same room
                for (let a = 0; a < connections[key].length; a++) {
                    io.to(connections[key][a]).emit("chat-message", data, sender, socket.id);
                }
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);

            // Find the room/path of the disconnecting socket
            let key;
            for (const [k, v] of Object.entries(connections)) {
                if (v.includes(socket.id)) {
                    key = k;
                    break;
                }
            }

            if (key !== undefined) {
                // Log duration online
                const diffTime = Math.abs(timeOnline[socket.id] - new Date());
                console.log(`User ${socket.id} was online for ${diffTime}ms`);

                // Remove user from connections list
                connections[key] = connections[key].filter((id) => id !== socket.id);

                // Notify remaining users
                for (let a = 0; a < connections[key].length; a++) {
                    io.to(connections[key][a]).emit("user-left", socket.id);
                }

                // If room is empty, clean it up
                if (connections[key].length === 0) {
                    delete connections[key];
                    delete messages[key];
                }

                // Clean up timeOnline and socketToUsername entry
                delete timeOnline[socket.id];
                delete socketToUsername[socket.id];
            }
        });
    });

    return io;
};
