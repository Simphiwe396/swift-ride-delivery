const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection - FIXED: removed localhost fallback for Render
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("✅ MongoDB connected");
}).catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
});

// Models
const Driver = require("./models/Driver");
const Trip = require("./models/Trip");
const User = require("./models/User");
const Delivery = require("./models/Delivery");

// Routes
app.use("/api/admin", require("./routes/admin"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/drivers", require("./routes/drivers"));
app.use("/api/trips", require("./routes/trips"));
app.use("/api/tracking", require("./routes/tracking"));

// Hardcoded Admin Credentials (Client can change these)
const ADMIN_CREDENTIALS = {
  email: "admin@swiftride.co.za",
  password: "Admin123!"
};

// Admin Login Endpoint
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  
  if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
    res.json({
      success: true,
      user: {
        _id: "admin_001",
        name: "Admin Owner",
        email: email,
        userType: "admin",
        phone: "0111234567",
        company: "SwiftRide Delivery"
      },
      token: "admin_token_" + Date.now()
    });
  } else {
    res.status(401).json({
      success: false,
      error: "Invalid admin credentials"
    });
  }
});

// Test endpoints
app.get("/api/test", (req, res) => {
  res.json({ 
    success: true,
    message: "SwiftRide API is running",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/drivers/all", async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json({
      success: true,
      count: drivers.length,
      drivers
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "SwiftRide API"
  });
});

// Socket.io events
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  
  socket.on("driver:location", (data) => {
    console.log("Driver location:", data);
    io.emit("location:update", data);
  });
  
  socket.on("driver:status", (data) => {
    console.log("Driver status:", data);
    io.emit("status:update", data);
  });
  
  socket.on("trip:request", (data) => {
    console.log("Trip requested:", data);
    io.emit("trip:new", data);
  });
  
  socket.on("trip:update", (data) => {
    console.log("Trip updated:", data);
    io.emit("trip:status", data);
  });
  
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Use Render's PORT (10000 from your yaml) or default to 5000
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Admin login: ${ADMIN_CREDENTIALS.email} / ${ADMIN_CREDENTIALS.password}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});