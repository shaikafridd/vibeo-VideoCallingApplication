import express from "express";
import { createServer } from "node:http";

import mongoose, { mongo } from "mongoose";


import cors from "cors";
import userRoutes from "./src/routes/users.routes.js"
import dotenv from "dotenv";
import dns from "node:dns";
import { connectToSocket } from "./src/controllers/socketController.js";

try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
    console.warn("Could not set DNS servers, using default:", e.message);
}

dotenv.config();


const app = express();
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);

const server = createServer(app);
const io = connectToSocket(server);


app.set("port", (process.env.PORT || 8000))
app.get("/", (req, res) => {
    return res.json("hello world");
});

const start = async () => {
    app.set("mongo_user")
    try {
        const connectionDb = await mongoose.connect(process.env.MONGO_URL);
        console.log(`MONGO Connected DB HOST: ${connectionDb.connection.host}`);
        server.listen(app.get("port"), () => {
            console.log("listening at port 8000");
        });
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
}

start();
