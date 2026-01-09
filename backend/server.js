const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ===== FIXED CORS CONFIGURATION =====
const corsOptions = {
    origin: [
        'https://swift-ride.onrender.com',
        'http://localhost:3000',
        'http://localhost:10000',
        'http://localhost:8080',
        'http://localhost:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Handle preflight requests
app.options('*', cors(corsOptions));

// ===== SOCKET.IO CONFIGURATION =====
const io = socketIo(server, {
    cors: {
        origin: [
            'https://swift-ride.onrender.com',
            'http://localhost:3000',
            'http://localhost:10000'
        ],
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ngozobolwanengolobane_db_user:2022gogo@cluster0.2xj7xle.mongodb.net/delivery_app?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️ Using mock data mode');
});

// Simple schemas
const driverSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    vehicleType: { type: String, default: 'motorcycle' },
    vehicleNumber: String,
    currentLocation: { lat: Number, lng: Number },
    status: { type: String, default: 'offline' },
    ratePerKm: { type: Number, default: 10 },
    totalTrips: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
});

const tripSchema = new mongoose.Schema({
    tripId: { type: String, default: () => `TRIP${Date.now()}` },
    customerId: String,
    customerName: String,
    driverId: String,
    driverName: String,
    pickup: { 
        address: String, 
        lat: { type: Number, default: -26.0748 },
        lng: { type: Number, default: 28.2104 }
    },
    destination: { 
        address: String, 
        lat: { type: Number, default: -26.0748 },
        lng: { type: Number, default: 28.2104 }
    },
    distance: { type: Number, default: 0 },
    fare: { type: Number, default: 0 },
    status: { type: String, default: 'pending' },
    driverLocation: { lat: Number, lng: Number },
    packageDescription: String,
    createdAt: { type: Date, default: Date.now },
    completedAt: Date
});

const Driver = mongoose.model('Driver', driverSchema);
const Trip = mongoose.model('Trip', tripSchema);

// ===== REAL-TIME TRACKING SYSTEM =====
let onlineDrivers = new Map(); // Map of driverId -> {socketId, data}
let connectedUsers = new Map(); // Map of socketId -> userData

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);
    
    // ===== USER CONNECTED =====
    socket.on('user-connected', (data) => {
        console.log(`👤 ${data.userType} connected: ${data.name}`);
        connectedUsers.set(socket.id, data);
        
        if (data.userType === 'driver') {
            // Add driver to online list
            onlineDrivers.set(data.userId, {
                socketId: socket.id,
                driverId: data.userId,
                name: data.name,
                status: 'online',
                location: data.currentLocation || { lat: -26.0748, lng: 28.2204 },
                lastUpdate: new Date()
            });
            
            // Broadcast to ALL admin users
            io.emit('driver-online', {
                driverId: data.userId,
                name: data.name,
                status: 'online',
                location: data.currentLocation || { lat: -26.0748, lng: 28.2204 },
                timestamp: new Date()
            });
            
            console.log(`🟢 Driver ${data.name} is now online`);
        }
    });
    
    // ===== DRIVER LOCATION UPDATE =====
    socket.on('driver-location', (data) => {
        const { driverId, lat, lng, status, name } = data;
        console.log(`📍 Driver location: ${name || driverId} at ${lat},${lng} (${status})`);
        
        // Update driver data
        const driverData = {
            socketId: socket.id,
            driverId,
            name: name || `Driver ${driverId.substring(0, 6)}`,
            status: status || 'online',
            location: { lat, lng },
            lastUpdate: new Date()
        };
        
        onlineDrivers.set(driverId, driverData);
        
        // Broadcast to ALL clients (admin, customers)
        io.emit('driver-update', {
            driverId,
            name: name || `Driver ${driverId.substring(0, 6)}`,
            lat,
            lng,
            status: status || 'online',
            timestamp: new Date()
        });
        
        // Also update database
        updateDriverInDB(driverId, { lat, lng, status });
    });
    
    // ===== DRIVER STATUS CHANGE =====
    socket.on('driver-status-change', (data) => {
        const { driverId, name, status } = data;
        console.log(`🔄 Driver status: ${name} -> ${status}`);
        
        // Update in memory
        const currentDriver = onlineDrivers.get(driverId);
        if (currentDriver) {
            currentDriver.status = status;
            currentDriver.lastUpdate = new Date();
            onlineDrivers.set(driverId, currentDriver);
        }
        
        // Broadcast to ALL clients
        io.emit('driver-status', {
            driverId,
            name,
            status,
            timestamp: new Date()
        });
        
        // Update database
        updateDriverInDB(driverId, { status });
        
        // If going offline, notify
        if (status === 'offline') {
            io.emit('driver-offline', { driverId, name });
            console.log(`🔴 Driver ${name} went offline`);
        }
    });
    
    // ===== TRIP REQUEST =====
    socket.on('request-trip', async (data) => {
        console.log('📦 New trip request:', data.customerName);
        
        try {
            // Create trip
            const trip = new Trip({
                customerId: data.customerId,
                customerName: data.customerName || 'TV Stands Customer',
                pickup: {
                    address: '5 Zaria Cres, Birchleigh North, Kempton Park',
                    lat: -26.0748,
                    lng: 28.2104
                },
                destination: data.destination,
                distance: data.distance || 10,
                fare: data.fare || 200,
                packageDescription: 'TV Stand Delivery',
                status: 'pending'
            });
            
            await trip.save();
            
            // Find available drivers
            const drivers = Array.from(onlineDrivers.values()).filter(d => 
                d.status === 'online' || d.status === 'available'
            );
            
            if (drivers.length > 0) {
                // Notify all available drivers
                drivers.forEach(driver => {
                    io.to(driver.socketId).emit('new-trip', {
                        tripId: trip._id,
                        tripId: trip.tripId,
                        customerName: data.customerName,
                        pickup: trip.pickup,
                        destination: data.destination,
                        fare: data.fare || 200,
                        distance: data.distance || 10
                    });
                });
                
                // Assign to first available driver
                const assignedDriver = drivers[0];
                trip.driverId = assignedDriver.driverId;
                trip.driverName = assignedDriver.name;
                trip.status = 'assigned';
                await trip.save();
                
                // Notify customer
                socket.emit('trip-assigned', {
                    tripId: trip._id,
                    driverId: assignedDriver.driverId,
                    driverName: assignedDriver.name,
                    eta: '30-60 mins'
                });
                
                // Notify driver
                io.to(assignedDriver.socketId).emit('trip-assigned-driver', {
                    tripId: trip._id,
                    customerName: data.customerName,
                    pickup: trip.pickup,
                    destination: data.destination,
                    fare: data.fare || 200
                });
                
                // Broadcast update
                io.emit('trip-updated', {
                    tripId: trip._id,
                    status: 'assigned',
                    driverName: assignedDriver.name
                });
            } else {
                // No drivers available
                socket.emit('no-drivers-available', {
                    message: 'No drivers available at the moment'
                });
            }
        } catch (error) {
            console.error('Error creating trip:', error);
            socket.emit('trip-error', { error: 'Failed to create trip' });
        }
    });
    
    // ===== ACCEPT TRIP =====
    socket.on('accept-trip', async (data) => {
        const { tripId, driverId, driverName } = data;
        console.log(`✅ Trip accepted: ${tripId} by ${driverName}`);
        
        try {
            await Trip.findByIdAndUpdate(tripId, {
                status: 'accepted',
                driverId,
                driverName
            });
            
            // Notify customer
            const trip = await Trip.findById(tripId);
            if (trip && trip.customerId) {
                io.emit('trip-accepted', {
                    tripId,
                    driverId,
                    driverName,
                    status: 'accepted'
                });
            }
            
            // Broadcast update
            io.emit('trip-updated', {
                tripId,
                status: 'accepted',
                driverName
            });
        } catch (error) {
            console.error('Error accepting trip:', error);
        }
    });
    
    // ===== UPDATE TRIP STATUS =====
    socket.on('update-trip', async (data) => {
        const { tripId, status, location, driverId } = data;
        console.log(`🔄 Trip update: ${tripId} -> ${status}`);
        
        try {
            const updateData = { status };
            if (location) updateData.driverLocation = location;
            if (status === 'completed') updateData.completedAt = new Date();
            
            await Trip.findByIdAndUpdate(tripId, updateData);
            
            // Broadcast to all clients
            io.emit('trip-updated', {
                tripId,
                status,
                location,
                driverId
            });
        } catch (error) {
            console.error('Error updating trip:', error);
        }
    });
    
    // ===== GET ONLINE DRIVERS =====
    socket.on('get-online-drivers', () => {
        const drivers = Array.from(onlineDrivers.values());
        socket.emit('online-drivers-list', drivers);
    });
    
    // ===== DISCONNECT =====
    socket.on('disconnect', () => {
        console.log('❌ Disconnected:', socket.id);
        
        // Find user
        const user = connectedUsers.get(socket.id);
        if (user) {
            // If driver, mark as offline
            if (user.userType === 'driver') {
                onlineDrivers.delete(user.userId);
                
                // Notify all clients
                io.emit('driver-offline', {
                    driverId: user.userId,
                    name: user.name
                });
                
                console.log(`🔴 Driver ${user.name} disconnected`);
            }
            
            connectedUsers.delete(socket.id);
        }
    });
});

// Helper function to update driver in DB
async function updateDriverInDB(driverId, data) {
    try {
        await Driver.findByIdAndUpdate(driverId, {
            ...data,
            lastActive: new Date()
        }, { upsert: true, new: true });
    } catch (error) {
        console.log('⚠️ Could not update driver in DB, using in-memory only');
    }
}

// API Routes
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'SwiftRide TV Stands Delivery API',
        version: '1.0.0',
        warehouse: '5 Zaria Cres, Birchleigh North, Kempton Park',
        onlineDrivers: onlineDrivers.size,
        connectedUsers: connectedUsers.size,
        timestamp: new Date() 
    });
});

app.get('/api/drivers/available', async (req, res) => {
    try {
        const drivers = await Driver.find({ 
            $or: [{ status: 'online' }, { status: 'available' }] 
        });
        res.json(drivers);
    } catch (error) {
        // Return in-memory drivers if DB fails
        const drivers = Array.from(onlineDrivers.values()).map(d => ({
            _id: d.driverId,
            name: d.name,
            status: d.status,
            currentLocation: d.location,
            vehicleType: 'motorcycle',
            phone: '082 111 2222'
        }));
        res.json(drivers);
    }
});

app.get('/api/drivers/all', async (req, res) => {
    try {
        const drivers = await Driver.find();
        res.json(drivers);
    } catch (error) {
        // Return in-memory + some mock drivers
        const onlineDriversList = Array.from(onlineDrivers.values()).map(d => ({
            _id: d.driverId,
            name: d.name,
            status: d.status,
            currentLocation: d.location,
            vehicleType: 'motorcycle',
            phone: '082 111 2222',
            totalTrips: Math.floor(Math.random() * 50) + 10,
            totalEarnings: Math.floor(Math.random() * 5000) + 1000
        }));
        
        const mockDrivers = [
            {
                _id: 'driver_001',
                name: 'John Driver',
                status: 'online',
                currentLocation: { lat: -26.0748, lng: 28.2204 },
                vehicleType: 'van',
                phone: '082 111 2222',
                totalTrips: 45,
                totalEarnings: 12500
            },
            {
                _id: 'driver_002',
                name: 'Mike Rider',
                status: 'busy',
                currentLocation: { lat: -26.0848, lng: 28.2004 },
                vehicleType: 'truck',
                phone: '082 333 4444',
                totalTrips: 32,
                totalEarnings: 9800
            }
        ];
        
        res.json([...onlineDriversList, ...mockDrivers]);
    }
});

app.post('/api/drivers', async (req, res) => {
    try {
        const driver = new Driver(req.body);
        await driver.save();
        res.json(driver);
    } catch (error) {
        console.error('Error creating driver:', error);
        res.status(500).json({ error: 'Failed to create driver' });
    }
});

app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 }).limit(50);
        res.json(trips);
    } catch (error) {
        // Mock trips
        const mockTrips = [
            { 
                _id: 'trip_001',
                tripId: 'TRIP001',
                customerName: 'Sandton City Mall', 
                driverName: 'John Driver',
                pickup: { address: '5 Zaria Cres, Birchleigh North', lat: -26.0748, lng: 28.2104 },
                destination: { address: 'Sandton City, Johannesburg', lat: -26.1070, lng: 28.0530 },
                distance: 25,
                fare: 500,
                status: 'completed',
                createdAt: new Date(Date.now() - 86400000)
            },
            { 
                _id: 'trip_002',
                tripId: 'TRIP002',
                customerName: 'Menlyn Maine', 
                driverName: 'Mike Rider',
                pickup: { address: '5 Zaria Cres, Birchleigh North', lat: -26.0748, lng: 28.2104 },
                destination: { address: 'Menlyn Maine, Pretoria', lat: -25.7750, lng: 28.2750 },
                distance: 35,
                fare: 700,
                status: 'in_progress',
                createdAt: new Date()
            }
        ];
        res.json(mockTrips);
    }
});

app.get('/api/admin/stats', (req, res) => {
    res.json({
        totalDrivers: onlineDrivers.size + 2, // Add some mock drivers
        activeDeliveries: Math.floor(Math.random() * 5) + 1,
        todayRevenue: Math.floor(Math.random() * 5000) + 1000,
        totalCustomers: Math.floor(Math.random() * 50) + 20
    });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 SwiftRide TV Stands Delivery Server running on port ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`📡 Socket.io: ws://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/status`);
    console.log(`👥 Online drivers tracking ready`);
});