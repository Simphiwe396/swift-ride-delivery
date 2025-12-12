const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.log('❌ MongoDB Connection Error:', err));

// Import Routes
const authRoutes = require('./routes/auth');
const driverRoutes = require('./routes/drivers');
const tripRoutes = require('./routes/trips');
const adminRoutes = require('./routes/admin');
const trackingRoutes = require('./routes/tracking');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tracking', trackingRoutes);

// Real-time Socket.io Setup
const activeDrivers = new Map();
const activeAdmins = new Map();

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  // Driver connects
  socket.on('driver_connect', (driverId) => {
    activeDrivers.set(driverId, socket.id);
    console.log(`🚗 Driver ${driverId} connected`);
    
    // Driver sends location updates
    socket.on('location_update', (data) => {
      // Broadcast to all admins tracking this driver
      io.emit(`driver_${driverId}_location`, {
        driverId,
        location: data.location,
        speed: data.speed,
        heading: data.heading,
        timestamp: Date.now()
      });
    });
    
    // Driver status updates
    socket.on('status_update', (data) => {
      io.emit(`driver_${driverId}_status`, {
        driverId,
        status: data.status,
        timestamp: Date.now()
      });
    });
  });
  
  // Admin connects
  socket.on('admin_connect', (adminId) => {
    activeAdmins.set(adminId, socket.id);
    console.log(`👑 Admin ${adminId} connected`);
  });
  
  // Customer connects
  socket.on('customer_connect', (customerId) => {
    console.log(`👤 Customer ${customerId} connected`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
    
    // Remove from active connections
    for (const [driverId, socketId] of activeDrivers.entries()) {
      if (socketId === socket.id) {
        activeDrivers.delete(driverId);
        io.emit(`driver_${driverId}_offline`, { driverId });
        break;
      }
    }
    
    for (const [adminId, socketId] of activeAdmins.entries()) {
      if (socketId === socket.id) {
        activeAdmins.delete(adminId);
        break;
      }
    }
  });
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../frontend'));
}

// Start Server
const PORT = process.env.PORT || 5000;
http.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Backend URL: http://localhost:${PORT}`);
  console.log(`🗺️  Mapbox Token: ${process.env.MAPBOX_TOKEN ? 'Loaded' : 'Missing'}`);
});