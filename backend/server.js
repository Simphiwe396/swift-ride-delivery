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

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/swiftride")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

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

// Hardcoded Admin Credentials
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

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    service: "SwiftRide API",
    timestamp: new Date().toISOString()
  });
});

// API test endpoint
app.get("/api/test", (req, res) => {
  res.json({ 
    success: true,
    message: "SwiftRide API is running",
    version: "1.0.0"
  });
});

// Get all drivers
app.get("/api/drivers/all", async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all trips
app.get("/api/trips/all", async (req, res) => {
  try {
    const trips = await Trip.find()
      .populate("customerId", "name email")
      .populate("driverId", "name email");
    res.json(trips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer trips
app.get("/api/trips/customer/:customerId", async (req, res) => {
  try {
    const trips = await Trip.find({ customerId: req.params.customerId })
      .populate("driverId", "name email phone");
    res.json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get driver trips
app.get("/api/trips/driver/:driverId", async (req, res) => {
  try {
    const trips = await Trip.find({ driverId: req.params.driverId })
      .populate("customerId", "name email phone");
    res.json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Request trip
app.post("/api/trips/request", async (req, res) => {
  try {
    const { pickup, destination, tripType, customerId } = req.body;
    
    const trip = new Trip({
      pickup,
      destination,
      tripType,
      customerId,
      status: "pending",
      fare: tripType === "delivery" ? 50 : 100
    });
    
    await trip.save();
    
    // Notify via socket
    io.emit("trip:new", trip);
    
    res.json({ 
      success: true, 
      message: "Trip requested successfully",
      trip 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update trip status
app.put("/api/trips/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    io.emit("trip:update", trip);
    
    res.json({ success: true, trip });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin stats
app.get("/api/admin/stats", async (req, res) => {
  try {
    const totalTrips = await Trip.countDocuments();
    const activeDrivers = await Driver.countDocuments({ status: "active" });
    const totalUsers = await User.countDocuments();
    const revenueResult = await Trip.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$fare" } } }
    ]);
    
    const revenue = revenueResult[0]?.total || 0;
    
    res.json({
      success: true,
      totalTrips,
      activeDrivers,
      totalUsers,
      revenue
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Socket.io events
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  
  socket.on("driver:location", (data) => {
    console.log("Driver location update:", data);
    io.emit("location:update", data);
  });
  
  socket.on("driver:status", (data) => {
    console.log("Driver status update:", data);
    io.emit("status:update", data);
  });
  
  socket.on("trip:request", (data) => {
    console.log("New trip request:", data);
    io.emit("trip:new", data);
  });
  
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔧 Admin login: ${ADMIN_CREDENTIALS.email} / ${ADMIN_CREDENTIALS.password}`);
  console.log(`🌍 Health check: http://localhost:${PORT}/health`);
});