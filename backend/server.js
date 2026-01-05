const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors({
  origin: ["https://swift-ride-frontend.onrender.com", "http://localhost:3000"],
  credentials: true
}));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://swift-ride-frontend.onrender.com", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

/* ----------------------------
   ENVIRONMENT CHECK
-----------------------------*/
console.log("🔍 Checking environment variables...");
console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
console.log("PORT:", process.env.PORT);

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is NOT set in environment variables");
  process.exit(1);
}

/* ----------------------------
   MONGODB CONNECTION
-----------------------------*/
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1);
  });

/* ----------------------------
   MODELS
-----------------------------*/
const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  lastLat: Number,
  lastLng: Number,
  dailyDistance: {
    type: Number,
    default: 0
  },
  lastUpdateDate: String,
  status: {
    type: String,
    default: 'offline',
    enum: ['online', 'offline', 'busy']
  },
  vehicleType: String,
  phone: String,
  email: String,
  rating: {
    type: Number,
    default: 5.0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  completedTrips: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Driver = mongoose.model("Driver", driverSchema);

// User Schema
const userSchema = new mongoose.Schema({
  userType: {
    type: String,
    enum: ['admin', 'driver', 'customer'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: String,
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", userSchema);

/* ----------------------------
   DISTANCE CALCULATION
-----------------------------*/
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ----------------------------
   SOCKET.IO HANDLERS
-----------------------------*/
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  // Handle driver location updates
  socket.on("driver:location", async (data) => {
    try {
      const { name, lat, lng } = data;
      
      if (!name || lat == null || lng == null) {
        console.log('❌ Invalid location data received');
        return;
      }

      console.log(`📍 Location update from ${name}: ${lat}, ${lng}`);

      const today = new Date().toISOString().split("T")[0];

      let driver = await Driver.findOne({ name });

      if (!driver) {
        driver = new Driver({
          name,
          lastLat: lat,
          lastLng: lng,
          dailyDistance: 0,
          lastUpdateDate: today,
          status: 'online'
        });
        console.log(`✅ New driver created: ${name}`);
      } else {
        if (driver.lastUpdateDate !== today) {
          driver.dailyDistance = 0;
          driver.lastUpdateDate = today;
          console.log(`🔄 Daily distance reset for ${name}`);
        }

        if (driver.lastLat && driver.lastLng) {
          const distance = getDistance(
            driver.lastLat,
            driver.lastLng,
            lat,
            lng
          );
          driver.dailyDistance += distance;
          console.log(`📏 Distance added for ${name}: ${distance.toFixed(2)}m`);
        }

        driver.lastLat = lat;
        driver.lastLng = lng;
      }

      await driver.save();

      const driverData = {
        driverId: driver._id,
        name,
        lat,
        lng,
        dailyDistance: Math.round(driver.dailyDistance),
        lastUpdateDate: driver.lastUpdateDate,
        timestamp: new Date().toISOString()
      };

      console.log(`📡 Broadcasting update for ${name}`);

      // Broadcast to all connected admin clients
      io.emit("admin:driverUpdate", driverData);

    } catch (error) {
      console.error('❌ Error processing driver location:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  });

  // Handle driver status updates
  socket.on("driver:status", async (data) => {
    try {
      const { name, status } = data;
      await Driver.findOneAndUpdate(
        { name },
        { status, updatedAt: new Date() }
      );
      
      io.emit("driver:status", { name, status });
      console.log(`📊 Driver ${name} status updated to ${status}`);
    } catch (error) {
      console.error('❌ Error updating driver status:', error);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

/* ----------------------------
   API ROUTES
-----------------------------*/
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date(),
    message: "SwiftRide API is running"
  });
});

// Get all drivers
app.get("/api/drivers", async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get driver by name
app.get("/api/drivers/:name", async (req, res) => {
  try {
    const driver = await Driver.findOne({ name: req.params.name });
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update driver
app.put("/api/drivers/:name", async (req, res) => {
  try {
    const driver = await Driver.findOneAndUpdate(
      { name: req.params.name },
      req.body,
      { new: true }
    );
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth endpoints
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, userType } = req.body;
    
    // For demo purposes - simple auth
    const user = await User.findOne({ email }) || 
      await User.create({
        userType: userType || 'customer',
        name: email.split('@')[0],
        email,
        phone: '1234567890',
        password: password || 'demo123'
      });
    
    res.json({
      token: "demo-token-" + Date.now(),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new driver
app.post("/api/drivers", async (req, res) => {
  try {
    const driver = new Driver(req.body);
    await driver.save();
    res.status(201).json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------------------------
   START SERVER
-----------------------------*/
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 WebSocket server ready`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});