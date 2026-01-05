// Socket.io Client for SwiftRide Delivery
// Create this as a new file: frontend/socket.js

class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.listeners = new Map();
    }

    initialize() {
        try {
            if (typeof io === 'undefined') {
                console.error('Socket.io not loaded');
                return null;
            }

            this.socket = io('https://swiftride-backend-jcyl.onrender.com', {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 2000
            });

            this.setupEventListeners();
            return this.socket;
        } catch (error) {
            console.error('Failed to initialize socket:', error);
            return null;
        }
    }

    setupEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ Socket connected:', this.socket.id);
            this.isConnected = true;
            this.emit('socket:connected', { time: new Date() });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Socket disconnected:', reason);
            this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        // Driver location updates
        this.socket.on('driver:location', (data) => {
            this.emit('driver_location_update', data);
        });

        this.socket.on('driver:status', (data) => {
            this.emit('driver_status_update', data);
        });

        // Admin updates
        this.socket.on('admin:driver_update', (driverData) => {
            this.emit('admin_driver_update', driverData);
        });

        // Error handling
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.emit('socket_error', error);
        });
    }

    // Update driver location
    updateDriverLocation(driverId, location) {
        if (!this.socket || !this.isConnected) {
            console.error('Socket not connected');
            return false;
        }

        this.socket.emit('driver:location', {
            name: driverId,
            lat: location.lat,
            lng: location.lng
        });

        return true;
    }

    // Update driver status
    updateDriverStatus(driverId, status) {
        if (!this.socket || !this.isConnected) {
            console.error('Socket not connected');
            return false;
        }

        this.socket.emit('driver:status', {
            name: driverId,
            status: status
        });

        return true;
    }

    // Event emitter for local listeners
    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} callback:`, error);
            }
        });
    }

    // Add event listener
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    // Remove event listener
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    // Disconnect socket
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.listeners.clear();
        }
    }
}

// Create global socket manager instance
const socketManager = new SocketManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        socketManager.initialize();
    }, 1000);
});

// Add to global scope
window.socketManager = socketManager;

// Helper functions
window.updateDriverLocation = function(lat, lng) {
    if (!window.AppState?.user || window.AppState.user.userType !== 'driver') {
        console.error('Only drivers can update location');
        return false;
    }
    
    return socketManager.updateDriverLocation(window.AppState.user._id, { lat, lng });
};

window.updateDriverStatus = function(status) {
    if (!window.AppState?.user || window.AppState.user.userType !== 'driver') {
        console.error('Only drivers can update status');
        return false;
    }
    
    return socketManager.updateDriverStatus(window.AppState.user._id, status);
};