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

// ===== SCHEMAS =====
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
    rating: { type: Number, default: 5.0 },
    joinedDate: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    notes: String
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
    completedAt: Date,
    tripDuration: Number // in minutes
});

// ===== NEW: TRACKING HISTORY SCHEMA =====
const trackingHistorySchema = new mongoose.Schema({
    driverId: String,
    driverName: String,
    tripId: String,
    location: { lat: Number, lng: Number },
    speed: { type: Number, default: 0 },
    status: String,
    timestamp: { type: Date, default: Date.now },
    batteryLevel: { type: Number, default: 100 }
});

const Driver = mongoose.model('Driver', driverSchema);
const Trip = mongoose.model('Trip', tripSchema);
const TrackingHistory = mongoose.model('TrackingHistory', trackingHistorySchema);

// ===== REAL-TIME TRACKING SYSTEM =====
let onlineDrivers = new Map();
let connectedUsers = new Map();

// Socket.io
io.on('connection', (socket) => {
    console.log('🔌 New connection:', socket.id);
    
    // ===== USER CONNECTED =====
    socket.on('user-connected', (data) => {
        console.log(`👤 ${data.userType} connected: ${data.name}`);
        connectedUsers.set(socket.id, data);
        
        if (data.userType === 'driver') {
            onlineDrivers.set(data.userId, {
                socketId: socket.id,
                driverId: data.userId,
                name: data.name,
                status: 'online',
                location: data.currentLocation || { lat: -26.0748, lng: 28.2204 },
                lastUpdate: new Date()
            });
            
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
    socket.on('driver-location', async (data) => {
        const { driverId, lat, lng, status, name, speed } = data;
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
        
        // ===== SAVE TO TRACKING HISTORY =====
        try {
            const trackingRecord = new TrackingHistory({
                driverId,
                driverName: name || `Driver ${driverId.substring(0, 6)}`,
                location: { lat, lng },
                speed: speed || 0,
                status: status || 'online',
                timestamp: new Date()
            });
            await trackingRecord.save();
            console.log(`📝 Saved tracking history for driver ${driverId}`);
        } catch (error) {
            console.error('Error saving tracking history:', error);
        }
        
        // Broadcast to ALL clients
        io.emit('driver-update', {
            driverId,
            name: name || `Driver ${driverId.substring(0, 6)}`,
            lat,
            lng,
            status: status || 'online',
            timestamp: new Date()
        });
        
        // Update database
        updateDriverInDB(driverId, { lat, lng, status });
    });
    
    // ===== DRIVER STATUS CHANGE =====
    socket.on('driver-status-change', (data) => {
        const { driverId, name, status } = data;
        console.log(`🔄 Driver status: ${name} -> ${status}`);
        
        const currentDriver = onlineDrivers.get(driverId);
        if (currentDriver) {
            currentDriver.status = status;
            currentDriver.lastUpdate = new Date();
            onlineDrivers.set(driverId, currentDriver);
        }
        
        io.emit('driver-status', {
            driverId,
            name,
            status,
            timestamp: new Date()
        });
        
        updateDriverInDB(driverId, { status });
        
        if (status === 'offline') {
            io.emit('driver-offline', { driverId, name });
            console.log(`🔴 Driver ${name} went offline`);
        }
    });
    
    // ===== TRIP REQUEST =====
    socket.on('request-trip', async (data) => {
        console.log('📦 New trip request:', data.customerName);
        
        try {
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
            
            const drivers = Array.from(onlineDrivers.values()).filter(d => 
                d.status === 'online' || d.status === 'available'
            );
            
            if (drivers.length > 0) {
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
                
                const assignedDriver = drivers[0];
                trip.driverId = assignedDriver.driverId;
                trip.driverName = assignedDriver.name;
                trip.status = 'assigned';
                await trip.save();
                
                socket.emit('trip-assigned', {
                    tripId: trip._id,
                    driverId: assignedDriver.driverId,
                    driverName: assignedDriver.name,
                    eta: '30-60 mins'
                });
                
                io.to(assignedDriver.socketId).emit('trip-assigned-driver', {
                    tripId: trip._id,
                    customerName: data.customerName,
                    pickup: trip.pickup,
                    destination: data.destination,
                    fare: data.fare || 200
                });
                
                io.emit('trip-updated', {
                    tripId: trip._id,
                    status: 'assigned',
                    driverName: assignedDriver.name
                });
            } else {
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
            
            const trip = await Trip.findById(tripId);
            if (trip && trip.customerId) {
                io.emit('trip-accepted', {
                    tripId,
                    driverId,
                    driverName,
                    status: 'accepted'
                });
            }
            
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
            if (status === 'completed') {
                updateData.completedAt = new Date();
                // Calculate trip duration
                const trip = await Trip.findById(tripId);
                if (trip) {
                    const duration = Math.round((new Date() - trip.createdAt) / 60000);
                    updateData.tripDuration = duration;
                }
            }
            
            await Trip.findByIdAndUpdate(tripId, updateData);
            
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
        
        const user = connectedUsers.get(socket.id);
        if (user) {
            if (user.userType === 'driver') {
                onlineDrivers.delete(user.userId);
                
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

// ===== API ROUTES =====
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

// ===== DRIVER ROUTES =====
app.get('/api/drivers/available', async (req, res) => {
    try {
        const drivers = await Driver.find({ 
            $or: [{ status: 'online' }, { status: 'available' }] 
        });
        res.json(drivers);
    } catch (error) {
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
                totalEarnings: 12500,
                rating: 4.8,
                joinedDate: new Date('2024-01-15')
            },
            {
                _id: 'driver_002',
                name: 'Mike Rider',
                status: 'busy',
                currentLocation: { lat: -26.0848, lng: 28.2004 },
                vehicleType: 'truck',
                phone: '082 333 4444',
                totalTrips: 32,
                totalEarnings: 9800,
                rating: 4.5,
                joinedDate: new Date('2024-02-20')
            }
        ];
        
        res.json([...onlineDriversList, ...mockDrivers]);
    }
});

// ===== ADD NEW DRIVER (ADMIN) =====
app.post('/api/drivers', async (req, res) => {
    try {
        console.log('Creating new driver:', req.body);
        
        const driverData = {
            ...req.body,
            status: 'offline',
            totalTrips: 0,
            totalEarnings: 0,
            rating: 5.0,
            joinedDate: new Date(),
            lastActive: new Date()
        };
        
        const driver = new Driver(driverData);
        await driver.save();
        
        console.log('✅ Driver created:', driver._id);
        res.json({
            success: true,
            message: 'Driver added successfully',
            driver: driver
        });
    } catch (error) {
        console.error('❌ Error creating driver:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create driver',
            details: error.message 
        });
    }
});

// ===== GET DRIVER BY ID =====
app.get('/api/drivers/:id', async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (driver) {
            res.json(driver);
        } else {
            res.status(404).json({ error: 'Driver not found' });
        }
    } catch (error) {
        console.log('⚠️ Using mock driver data');
        const driver = Array.from(onlineDrivers.values()).find(d => d.driverId === req.params.id);
        if (driver) {
            res.json({
                _id: driver.driverId,
                name: driver.name,
                status: driver.status,
                currentLocation: driver.location,
                vehicleType: 'motorcycle',
                phone: '082 111 2222'
            });
        } else {
            res.status(404).json({ error: 'Driver not found' });
        }
    }
});

// ===== TRIP ROUTES =====
app.get('/api/trips', async (req, res) => {
    try {
        const trips = await Trip.find().sort({ createdAt: -1 }).limit(50);
        res.json(trips);
    } catch (error) {
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
                createdAt: new Date(Date.now() - 86400000),
                tripDuration: 45
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
                createdAt: new Date(),
                tripDuration: 25
            }
        ];
        res.json(mockTrips);
    }
});

app.get('/api/trips/history', async (req, res) => {
    const { customerId, driverId } = req.query;
    
    try {
        let query = {};
        if (customerId) query.customerId = customerId;
        if (driverId) query.driverId = driverId;
        
        const trips = await Trip.find(query).sort({ createdAt: -1 }).limit(50);
        res.json(trips);
    } catch (error) {
        console.log('⚠️ Using mock trips data for history');
        let filteredTrips = [
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
            }
        ];
        res.json(filteredTrips);
    }
});

// ===== TRACKING HISTORY ROUTES =====
app.get('/api/tracking/history', async (req, res) => {
    try {
        const { driverId, limit = 100, date } = req.query;
        let query = {};
        
        if (driverId) query.driverId = driverId;
        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            query.timestamp = { $gte: startDate, $lt: endDate };
        }
        
        const history = await TrackingHistory.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        res.json(history);
    } catch (error) {
        console.error('Error fetching tracking history:', error);
        
        // Mock data for testing
        const mockHistory = [
            {
                _id: 'track_001',
                driverId: 'driver_001',
                driverName: 'John Driver',
                location: { lat: -26.0748, lng: 28.2204 },
                speed: 45,
                status: 'online',
                timestamp: new Date(Date.now() - 60000),
                batteryLevel: 85
            },
            {
                _id: 'track_002',
                driverId: 'driver_001',
                driverName: 'John Driver',
                location: { lat: -26.0750, lng: 28.2210 },
                speed: 50,
                status: 'online',
                timestamp: new Date(Date.now() - 120000),
                batteryLevel: 82
            },
            {
                _id: 'track_003',
                driverId: 'driver_002',
                driverName: 'Mike Rider',
                location: { lat: -26.0848, lng: 28.2004 },
                speed: 35,
                status: 'busy',
                timestamp: new Date(Date.now() - 180000),
                batteryLevel: 90
            }
        ];
        
        res.json(mockHistory.filter(h => !driverId || h.driverId === driverId).slice(0, parseInt(limit)));
    }
});

// ===== ADMIN STATS =====
app.get('/api/admin/stats', async (req, res) => {
    try {
        const totalDrivers = await Driver.countDocuments();
        const activeTrips = await Trip.countDocuments({ 
            status: { $in: ['pending', 'accepted', 'in_progress', 'picked_up'] } 
        });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTrips = await Trip.find({
            createdAt: { $gte: today },
            status: 'completed'
        });
        const todayRevenue = todayTrips.reduce((sum, trip) => sum + (trip.fare || 0), 0);
        
        const totalCustomers = await Trip.distinct('customerId').then(ids => ids.length);
        
        res.json({
            totalDrivers,
            activeDeliveries: activeTrips,
            todayRevenue,
            totalCustomers: totalCustomers || 25,
            totalTrips: await Trip.countDocuments(),
            todayTrips: todayTrips.length
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.json({
            totalDrivers: 3,
            activeDeliveries: 2,
            todayRevenue: 1200,
            totalCustomers: 25,
            totalTrips: 150,
            todayTrips: 8
        });
    }
});

// ===== HOME PAGE STATS =====
app.get('/api/home/stats', async (req, res) => {
    try {
        // Today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTrips = await Trip.find({
            createdAt: { $gte: today }
        });
        
        const todayCompletedTrips = todayTrips.filter(t => t.status === 'completed');
        const todayRevenue = todayCompletedTrips.reduce((sum, t) => sum + (t.fare || 0), 0);
        
        // Recent tracking activity
        const recentTracking = await TrackingHistory.find()
            .sort({ timestamp: -1 })
            .limit(20);
        
        // Active drivers
        const onlineDriversCount = Array.from(onlineDrivers.values()).filter(d => 
            d.status === 'online' || d.status === 'available'
        ).length;
        
        res.json({
            todayTrips: todayTrips.length,
            todayCompletedTrips: todayCompletedTrips.length,
            todayRevenue,
            onlineDrivers: onlineDriversCount,
            recentTracking: recentTracking.map(track => ({
                driverName: track.driverName,
                location: track.location,
                time: track.timestamp,
                status: track.status
            })),
            totalDrivers: await Driver.countDocuments(),
            totalCustomers: await Trip.distinct('customerId').then(ids => ids.length) || 45
        });
    } catch (error) {
        console.error('Error getting home stats:', error);
        res.json({
            todayTrips: 8,
            todayCompletedTrips: 6,
            todayRevenue: 2400,
            onlineDrivers: 2,
            recentTracking: [
                {
                    driverName: 'John Driver',
                    location: { lat: -26.0748, lng: 28.2204 },
                    time: new Date(Date.now() - 300000),
                    status: 'online'
                },
                {
                    driverName: 'Mike Rider',
                    location: { lat: -26.0848, lng: 28.2004 },
                    time: new Date(Date.now() - 600000),
                    status: 'busy'
                }
            ],
            totalDrivers: 3,
            totalCustomers: 45
        });
    }
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
    console.log(`📝 Tracking history system ready`);
});