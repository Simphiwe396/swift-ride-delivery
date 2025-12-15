const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
require("dotenv").config();

const app = express();

// ===== SECURITY & MIDDLEWARE =====
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS Configuration
const corsOptions = {
  origin: [
    "https://swift-ride-frontend.onrender.com",
    "http://localhost:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8080"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));

// ===== HTTP SERVER =====
const server = http.createServer(app);

// ===== SOCKET.IO SETUP =====
const io = new Server(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ===== DATABASE CONNECTION =====
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/swiftride";
console.log("🔍 Connecting to MongoDB...");

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1);
  });

// ===== DATABASE MODELS =====
const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: [true, "Phone is required"]
  },
  userType: {
    type: String,
    enum: ["admin", "driver", "customer"],
    default: "driver"
  },
  licenseNumber: String,
  vehicle: {
    make: String,
    model: String,
    color: String,
    licensePlate: String,
    type: {
      type: String,
      enum: ["motorcycle", "car", "van", "truck"],
      default: "motorcycle"
    }
  },
  currentLocation: {
    lat: { type: Number, default: -26.195246 },
    lng: { type: Number, default: 28.034088 },
    address: String,
    timestamp: Date
  },
  status: {
    type: String,
    enum: ["online", "offline", "busy", "on_break"],
    default: "offline"
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 1,
    max: 5
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  completedTrips: {
    type: Number,
    default: 0
  },
  dailyDistance: {
    type: Number,
    default: 0
  },
  lastUpdateDate: String,
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Driver = mongoose.model("Driver", driverSchema);

// User Schema
const userSchema = new mongoose.Schema({
  userType: {
    type: String,
    enum: ["admin", "driver", "customer"],
    required: true,
    default: "customer"
  },
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: [true, "Phone is required"]
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: 6
  },
  address: {
    street: String,
    city: String,
    country: { type: String, default: "South Africa" },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  profileImage: String,
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  const bcrypt = require("bcryptjs");
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = require("bcryptjs");
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

// Trip Schema
const tripSchema = new mongoose.Schema({
  tripId: {
    type: String,
    unique: true,
    required: true,
    default: () => `TRIP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver"
  },
  pickup: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    contactName: String,
    contactPhone: String
  },
  delivery: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    recipientName: String,
    recipientPhone: String
  },
  distance: {
    type: Number,
    default: 0
  },
  estimatedDuration: {
    type: Number,
    default: 30
  },
  fare: {
    base: { type: Number, default: 25 },
    distance: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: "ZAR" }
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "enroute", "delivered", "cancelled"],
    default: "pending"
  },
  paymentMethod: {
    type: String,
    enum: ["cash", "card", "wallet"],
    default: "cash"
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending"
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  notes: String
});

const Trip = mongoose.model("Trip", tripSchema);

// ===== HELPER FUNCTIONS =====
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// ===== SOCKET.IO HANDLERS =====
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);
  
  // Authentication
  socket.on("authenticate", (data) => {
    if (data.token) {
      socket.userId = data.userId;
      socket.userType = data.userType;
      console.log(`✅ User ${data.userId} authenticated as ${data.userType}`);
    }
  });
  
  // Driver location update
  socket.on("driver:location", async (data) => {
    try {
      const { driverId, lat, lng, speed, heading } = data;
      
      if (!driverId || lat == null || lng == null) {
        return socket.emit("error", { message: "Invalid location data" });
      }
      
      const today = new Date().toISOString().split("T")[0];
      const driver = await Driver.findById(driverId);
      
      if (!driver) {
        return socket.emit("error", { message: "Driver not found" });
      }
      
      // Calculate distance if previous location exists
      if (driver.currentLocation && driver.currentLocation.lat) {
        const distance = calculateDistance(
          driver.currentLocation.lat,
          driver.currentLocation.lng,
          lat,
          lng
        );
        
        // Reset daily distance if new day
        if (driver.lastUpdateDate !== today) {
          driver.dailyDistance = 0;
          driver.lastUpdateDate = today;
        }
        
        driver.dailyDistance += distance / 1000; // Convert to kilometers
      }
      
      // Update driver location
      driver.currentLocation = {
        lat,
        lng,
        timestamp: new Date(),
        speed: speed || 0,
        heading: heading || 0
      };
      driver.updatedAt = new Date();
      
      await driver.save();
      
      // Broadcast to all admin clients
      const driverData = {
        driverId: driver._id,
        name: driver.name,
        lat,
        lng,
        speed: speed || 0,
        heading: heading || 0,
        status: driver.status,
        dailyDistance: Math.round(driver.dailyDistance * 100) / 100,
        vehicle: driver.vehicle,
        timestamp: new Date().toISOString()
      };
      
      io.emit("admin:driverUpdate", driverData);
      io.emit("tracking:update", driverData);
      
    } catch (error) {
      console.error("❌ Error updating driver location:", error);
      socket.emit("error", { message: "Failed to update location" });
    }
  });
  
  // Driver status update
  socket.on("driver:status", async (data) => {
    try {
      const { driverId, status } = data;
      const driver = await Driver.findByIdAndUpdate(
        driverId,
        { status, updatedAt: new Date() },
        { new: true }
      );
      
      if (driver) {
        io.emit("driver:statusUpdate", {
          driverId: driver._id,
          name: driver.name,
          status: driver.status,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("❌ Error updating driver status:", error);
    }
  });
  
  // Track specific driver
  socket.on("track:driver", (data) => {
    const { driverId } = data;
    socket.join(`tracking_${driverId}`);
    console.log(`📡 Socket ${socket.id} tracking driver ${driverId}`);
  });
  
  // Disconnect handler
  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

// ===== API ROUTES =====

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
    message: "SwiftRide API is running"
  });
});

// Authentication
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, userType = "customer" } = req.body;
    
    // Simple authentication for demo
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    
    let user = await User.findOne({ email });
    
    // Create demo user if doesn't exist
    if (!user) {
      const name = email.split("@")[0];
      const phone = "1234567890";
      
      user = new User({
        userType,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email,
        phone,
        password: password || "demo123",
        isVerified: true
      });
      
      await user.save();
      
      // Create driver record if user is driver
      if (userType === "driver") {
        const driver = new Driver({
          name: user.name,
          email: user.email,
          phone: user.phone,
          userType: "driver",
          vehicle: {
            type: "motorcycle",
            make: "Demo",
            model: "M2024",
            color: "Blue",
            licensePlate: "DEMO-001"
          },
          status: "offline",
          rating: 5.0,
          currentLocation: {
            lat: -26.195246,
            lng: 28.034088,
            address: "Johannesburg CBD",
            timestamp: new Date()
          }
        });
        
        await driver.save();
      }
    }
    
    // Generate JWT token
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        userType: user.userType
      },
      process.env.JWT_SECRET || "swiftride-secret-key-2024",
      { expiresIn: "7d" }
    );
    
    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        userType: user.userType
      }
    });
    
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Get all drivers
app.get("/api/drivers", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    
    if (status && status !== "all") {
      filter.status = status;
    }
    
    const drivers = await Driver.find(filter)
      .select("-__v")
      .sort({ updatedAt: -1 });
    
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single driver
app.get("/api/drivers/:id", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).select("-__v");
    
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }
    
    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new driver
app.post("/api/drivers", async (req, res) => {
  try {
    const driver = new Driver(req.body);
    await driver.save();
    res.status(201).json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver
app.put("/api/drivers/:id", async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    ).select("-__v");
    
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }
    
    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().select("-password -__v").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new user
app.post("/api/users", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trips API
app.get("/api/trips", async (req, res) => {
  try {
    const { driverId, customerId, status } = req.query;
    const filter = {};
    
    if (driverId) filter.driverId = driverId;
    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;
    
    const trips = await Trip.find(filter)
      .populate("customerId", "name email phone")
      .populate("driverId", "name email phone vehicle")
      .sort({ requestedAt: -1 })
      .limit(50);
    
    res.json(trips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new trip
app.post("/api/trips", async (req, res) => {
  try {
    const trip = new Trip({
      ...req.body,
      tripId: `TRIP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
    
    await trip.save();
    
    // Populate references
    await trip.populate("customerId", "name email phone");
    await trip.populate("driverId", "name email phone vehicle");
    
    res.status(201).json(trip);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin statistics
app.get("/api/admin/stats", async (req, res) => {
  try {
    const totalDrivers = await Driver.countDocuments();
    const onlineDrivers = await Driver.countDocuments({ status: "online" });
    const totalTrips = await Trip.countDocuments();
    const activeTrips = await Trip.countDocuments({ 
      status: { $in: ["pending", "accepted", "enroute"] } 
    });
    const todayRevenue = await Trip.aggregate([
      {
        $match: {
          status: "delivered",
          completedAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$fare.total" }
        }
      }
    ]);
    
    res.json({
      totalDrivers,
      onlineDrivers,
      totalTrips,
      activeTrips,
      todayRevenue: todayRevenue[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`🌐 WebSocket server ready on ws://${HOST}:${PORT}`);
  console.log(`🔗 Health check: http://${HOST}:${PORT}/api/health`);
  console.log(`📊 Database: ${MONGODB_URI}`);
});