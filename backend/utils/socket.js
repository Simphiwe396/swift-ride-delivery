const WebSocket = require('ws');

class TrackingServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.driverConnections = new Map(); // driverId -> WebSocket
        this.adminConnections = new Set(); // Admin WebSockets
        this.driverLocations = new Map(); // driverId -> location
        
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection');
            
            ws.on('message', (message) => {
                this.handleMessage(ws, message);
            });
            
            ws.on('close', () => {
                this.handleDisconnection(ws);
            });
        });
    }

    handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'register_driver':
                    this.registerDriver(ws, data.driverId);
                    break;
                    
                case 'register_admin':
                    this.registerAdmin(ws);
                    break;
                    
                case 'location_update':
                    this.handleLocationUpdate(data.driverId, data.location);
                    break;
                    
                case 'get_drivers':
                    this.sendDriverList(ws);
                    break;
                    
                case 'get_locations':
                    this.sendAllLocations(ws);
                    break;
            }
            
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    }

    registerDriver(ws, driverId) {
        this.driverConnections.set(driverId, ws);
        console.log(`Driver ${driverId} registered for WebSocket`);
        
        // Send confirmation
        ws.send(JSON.stringify({
            type: 'registered',
            driverId: driverId,
            message: 'WebSocket connected for real-time tracking'
        }));
    }

    registerAdmin(ws) {
        this.adminConnections.add(ws);
        console.log('Admin registered for WebSocket');
        
        // Send current driver locations
        this.sendDriverList(ws);
    }

    handleLocationUpdate(driverId, location) {
        // Store location
        this.driverLocations.set(driverId, {
            ...location,
            timestamp: Date.now()
        });
        
        // Broadcast to all admins
        this.broadcastToAdmins({
            type: 'driver_location',
            driverId: driverId,
            location: location
        });
    }

    broadcastToAdmins(message) {
        const messageStr = JSON.stringify(message);
        this.adminConnections.forEach(adminWs => {
            if (adminWs.readyState === WebSocket.OPEN) {
                adminWs.send(messageStr);
            }
        });
    }

    sendDriverList(ws) {
        const drivers = Array.from(this.driverLocations.entries()).map(([driverId, location]) => ({
            driverId,
            location,
            lastUpdate: location.timestamp
        }));
        
        ws.send(JSON.stringify({
            type: 'all_drivers',
            drivers: drivers
        }));
    }

    sendAllLocations(ws) {
        const locations = {};
        this.driverLocations.forEach((location, driverId) => {
            locations[driverId] = location;
        });
        
        ws.send(JSON.stringify({
            type: 'all_locations',
            locations: locations
        }));
    }

    handleDisconnection(ws) {
        // Remove from driver connections
        for (const [driverId, driverWs] of this.driverConnections.entries()) {
            if (driverWs === ws) {
                this.driverConnections.delete(driverId);
                console.log(`Driver ${driverId} disconnected`);
                
                // Notify admins
                this.broadcastToAdmins({
                    type: 'driver_offline',
                    driverId: driverId
                });
                break;
            }
        }
        
        // Remove from admin connections
        if (this.adminConnections.has(ws)) {
            this.adminConnections.delete(ws);
            console.log('Admin disconnected');
        }
    }
}