import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import dotenv from "dotenv";
import Driver from "./models/Driver.js";


dotenv.config();


const app = express();
app.use(cors());
app.use(express.json());


const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });


mongoose.connect(process.env.MONGODB_URI).then(() =>
console.log("DB Connected")
);


io.on("connection", socket => {
console.log("driver connected");


socket.on("driverLocation", async data => {
const { name, lat, lng } = data;


await Driver.findOneAndUpdate(
{ name },
{ name, lastLat: lat, lastLng: lng, active: true },
{ upsert: true }
);


io.emit("driverLocation", {
driverId: name,
name,
lat,
lng
});
});
});


app.get("/drivers", async (req, res) => {
res.json(await Driver.find());
});


server.listen(process.env.PORT || 10000, () =>
console.log("Server running")
);