// ===== GLOBAL APP CONFIGURATION =====
const APP_CONFIG = {
    // CRITICAL FIX: Updated API URL for Render deployment
    API_URL: 'https://swift-ride.onrender.com/api',
    
    // Updated warehouse location: 5 Zaria Cres, Birchleigh North, Kempton Park
    MAP_CENTER: [-26.0748, 28.2104],
    DEFAULT_ZOOM: 14,
    
    // CRITICAL FIX: Updated Socket URL for Render
    SOCKET_URL: 'https://swift-ride.onrender.com'
};

let AppState = {
    user: null,
    socket: null,
    map: null,
    markers: {},
    connected: false
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 SwiftRide App Initializing...');
    
    // Load user from localStorage
    const userData = localStorage.getItem('swiftride_user');
    if (userData) {
        try {
            AppState.user = JSON.parse(userData);
            console.log('✅ User loaded:', AppState.user.name);
        } catch (e) {
            console.error('❌ Failed to parse user data');
            localStorage.removeItem('swiftride_user');
        }
    } else {
        console.log('🔒 No user logged in');
    }
    
    // Initialize socket connection
    initSocket();
    
    // Hide loading screen
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 1500);
});

// ===== SOCKET.IO FUNCTIONS =====
function initSocket() {
    try {
        console.log('🔌 Initializing socket connection...');
        console.log('🌐 Connecting to:', APP_CONFIG.SOCKET_URL);
        
        AppState.socket = io(APP_CONFIG.SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        });
        
        AppState.socket.on('connect', () => {
            console.log('✅ Socket.io connected successfully');
            AppState.connected = true;
            
            if (AppState.user) {
                AppState.socket.emit('user-connected', {
                    userId: AppState.user.id,
                    userType: AppState.user.type,
                    name: AppState.user.name
                });
            }
        });
        
        AppState.socket.on('driver-update', (data) => {
            console.log('📍 Driver location update:', data);
            updateDriverOnMap(data);
        });
        
        AppState.socket.on('new-trip', (data) => {
            console.log('📦 New trip request:', data);
            showNotification(`New delivery request!`, 'info');
        });
        
        AppState.socket.on('trip-accepted', (data) => {
            console.log('✅ Trip accepted:', data);
            showNotification('Driver accepted your delivery!', 'success');
        });
        
        AppState.socket.on('trip-updated', (data) => {
            console.log('🔄 Trip updated:', data);
            if (typeof window.handleTripUpdate === 'function') {
                window.handleTripUpdate(data);
            }
        });
        
        AppState.socket.on('driver-offline', (data) => {
            console.log('🔴 Driver offline:', data);
            removeMarker(`driver_${data.driverId}`);
        });
        
        AppState.socket.on('connect_error', (error) => {
            console.log('❌ Socket connection error:', error.message);
            AppState.connected = false;
            showNotification('Connection lost. Reconnecting...', 'warning');
        });
        
        AppState.socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
            AppState.connected = false;
        });
        
    } catch (error) {
        console.error('❌ Failed to initialize socket:', error);
    }
}

// ===== MAP FUNCTIONS =====
function initMap(elementId = 'map', center = APP_CONFIG.MAP_CENTER, zoom = APP_CONFIG.DEFAULT_ZOOM) {
    const mapElement = document.getElementById(elementId);
    if (!mapElement) {
        console.error('❌ Map element not found:', elementId);
        return null;
    }
    
    try {
        // Remove existing map if any
        if (AppState.map && mapElement._leaflet_id) {
            AppState.map.remove();
            AppState.markers = {};
        }
        
        console.log(`🗺️ Creating map for ${elementId}`);
        AppState.map = L.map(elementId).setView(center, zoom);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(AppState.map);
        
        console.log('✅ Map created successfully');
        
        // Add warehouse marker for warehouse location
        if (elementId === 'adminMap' || elementId === 'trackingMap' || elementId === 'driverMap') {
            L.marker(APP_CONFIG.MAP_CENTER).addTo(AppState.map)
                .bindPopup('<strong>TV Stands Warehouse</strong><br>5 Zaria Cres, Birchleigh North')
                .openPopup();
        }
        
        return AppState.map;
    } catch (error) {
        console.error('❌ Failed to initialize map:', error);
        return null;
    }
}

function addMarker(id, latlng, options = {}) {
    if (!AppState.map) {
        console.error('❌ No map available');
        return null;
    }
    
    try {
        console.log(`📍 Adding marker ${id} at`, latlng);
        const marker = L.marker(latlng, options).addTo(AppState.map);
        AppState.markers[id] = marker;
        return marker;
    } catch (error) {
        console.error('❌ Failed to add marker:', error);
        return null;
    }
}

function updateMarker(id, latlng) {
    if (AppState.markers[id]) {
        console.log(`📍 Updating marker ${id} to`, latlng);
        AppState.markers[id].setLatLng(latlng);
    } else {
        console.warn(`⚠️ Marker ${id} not found for update`);
    }
}

function removeMarker(id) {
    if (AppState.markers[id]) {
        console.log(`🗑️ Removing marker ${id}`);
        AppState.map.removeLayer(AppState.markers[id]);
        delete AppState.markers[id];
    }
}

function updateDriverOnMap(data) {
    const { driverId, lat, lng, status } = data;
    const markerId = `driver_${driverId}`;
    
    console.log(`📍 Updating driver ${driverId} on map`);
    
    const iconColors = {
        'available': 'green',
        'busy': 'orange',
        'offline': 'gray',
        'online': 'blue'
    };
    
    try {
        const icon = L.divIcon({
            html: `<div style="background: ${iconColors[status] || 'blue'}; 
                   width: 20px; height: 20px; border-radius: 50%; 
                   border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
            className: 'driver-marker',
            iconSize: [20, 20]
        });
        
        if (AppState.markers[markerId]) {
            updateMarker(markerId, [lat, lng]);
        } else {
            addMarker(markerId, [lat, lng], { 
                icon,
                title: `Driver ${driverId?.substring(0, 8) || 'Unknown'}`
            });
        }
    } catch (error) {
        console.error('❌ Failed to update driver on map:', error);
    }
}

// ===== UTILITY FUNCTIONS =====
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10;
}

function calculateFare(distanceKm, ratePerKm = 20) {
    const baseFare = 200; // R200 base for TV stand deliveries
    const calculated = distanceKm * ratePerKm;
    return Math.max(baseFare, Math.round(calculated * 100) / 100);
}

function showNotification(message, type = 'info', duration = 5000) {
    console.log(`📢 Notification (${type}): ${message}`);
    
    try {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : type === 'warning' ? '#FF9800' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s;
            max-width: 300px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;
        
        const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">${icon}</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, duration);
        
        // Add animation styles
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    } catch (error) {
        console.error('❌ Failed to show notification:', error);
    }
}

async function apiRequest(endpoint, options = {}) {
    const url = APP_CONFIG.API_URL + endpoint;
    console.log(`🌐 API Request: ${url}`);
    
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options,
            mode: 'cors',
            credentials: 'include'
        });
        
        console.log(`🌐 API Response status: ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('🌐 API Response data:', data);
        return data;
    } catch (error) {
        console.error('❌ API request failed:', error);
        showNotification('Network error. Using simulated data.', 'warning');
        // Return mock data for testing
        return mockData(endpoint);
    }
}

function mockData(endpoint) {
    console.log('📦 Returning mock data for:', endpoint);
    
    switch(endpoint) {
        case '/drivers/available':
            return [
                { 
                    _id: 'driver_001', 
                    name: 'John Driver', 
                    status: 'available', 
                    currentLocation: { lat: -26.0748, lng: 28.2204 },
                    vehicleType: 'van',
                    phone: '082 111 2222'
                },
                { 
                    _id: 'driver_002', 
                    name: 'Mike Rider', 
                    status: 'available', 
                    currentLocation: { lat: -26.0848, lng: 28.2004 },
                    vehicleType: 'truck',
                    phone: '082 333 4444'
                }
            ];
            
        case '/drivers/all':
            return [
                { 
                    _id: 'driver_001', 
                    name: 'John Driver', 
                    status: 'available', 
                    currentLocation: { lat: -26.0748, lng: 28.2204 },
                    vehicleType: 'van',
                    phone: '082 111 2222',
                    totalTrips: 15,
                    totalEarnings: 4500
                },
                { 
                    _id: 'driver_002', 
                    name: 'Mike Rider', 
                    status: 'busy', 
                    currentLocation: { lat: -26.0848, lng: 28.2004 },
                    vehicleType: 'truck',
                    phone: '082 333 4444',
                    totalTrips: 22,
                    totalEarnings: 6600
                },
                { 
                    _id: 'driver_003', 
                    name: 'David Biker', 
                    status: 'offline', 
                    currentLocation: { lat: -26.0648, lng: 28.1904 },
                    vehicleType: 'motorcycle',
                    phone: '082 555 6666',
                    totalTrips: 8,
                    totalEarnings: 2400
                }
            ];
            
        case '/trips':
        case '/trips/history':
            return [
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
                },
                { 
                    _id: 'trip_003',
                    tripId: 'TRIP003',
                    customerName: 'Kempton Park Store', 
                    driverName: 'David Biker',
                    pickup: { address: '5 Zaria Cres, Birchleigh North', lat: -26.0748, lng: 28.2104 },
                    destination: { address: 'Kempton Park CBD', lat: -26.0900, lng: 28.2300 },
                    distance: 8,
                    fare: 200,
                    status: 'pending',
                    createdAt: new Date(Date.now() - 3600000)
                }
            ];
            
        case '/admin/stats':
            return {
                totalDrivers: 3,
                activeDeliveries: 2,
                todayRevenue: 1200,
                totalCustomers: 25
            };
            
        default:
            return { status: 'ok', message: 'Mock data returned' };
    }
}

async function getAvailableDrivers() {
    try {
        console.log('👥 Fetching available drivers...');
        return await apiRequest('/drivers/available');
    } catch (error) {
        console.error('❌ Failed to get drivers:', error);
        return mockData('/drivers/available');
    }
}

async function getTripHistory(userId, userType) {
    try {
        console.log(`📋 Fetching trip history for ${userType} ${userId}`);
        const trips = await apiRequest('/trips/history');
        // Filter by user type
        if (userType === 'driver') {
            return trips.filter(trip => trip.driverId === userId || trip.driverName?.includes('Driver'));
        } else if (userType === 'customer') {
            return trips.filter(trip => trip.customerId === userId);
        }
        return trips;
    } catch (error) {
        console.error('❌ Failed to get trip history:', error);
        return mockData('/trips/history');
    }
}

async function createTrip(tripData) {
    try {
        console.log('📦 Creating new trip:', tripData);
        return await apiRequest('/trips', {
            method: 'POST',
            body: JSON.stringify(tripData)
        });
    } catch (error) {
        console.error('❌ Failed to create trip:', error);
        showNotification('Failed to create delivery request', 'error');
        // Return mock response
        return { 
            _id: 'mock_trip_' + Date.now(),
            ...tripData,
            status: 'pending',
            createdAt: new Date()
        };
    }
}

async function updateTripStatus(tripId, status, location = null) {
    try {
        console.log(`🔄 Updating trip ${tripId} to ${status}`);
        return await apiRequest(`/trips/${tripId}`, {
            method: 'PUT',
            body: JSON.stringify({ status, ...(location && { driverLocation: location }) })
        });
    } catch (error) {
        console.error('❌ Failed to update trip:', error);
        showNotification('Failed to update delivery status', 'error');
        return { status: 'ok' };
    }
}

// ===== AUTH FUNCTIONS =====
function loginAs(userType) {
    console.log(`👤 Logging in as ${userType}`);
    
    let user;
    
    switch(userType) {
        case 'admin':
            user = {
                id: 'admin_001',
                name: 'Business Owner',
                email: 'owner@tvstands.com',
                type: 'admin',
                phone: '011 123 4567'
            };
            break;
            
        case 'driver':
            user = {
                id: 'driver_001',
                name: 'John Driver',
                email: 'driver@tvstands.com',
                type: 'driver',
                phone: '082 111 2222',
                vehicleType: 'van',
                currentLocation: { lat: -26.0748, lng: 28.2204 }
            };
            break;
            
        case 'customer':
            user = {
                id: 'customer_001',
                name: 'TV Stands Customer',
                email: 'customer@tvstands.com',
                type: 'customer',
                phone: '082 999 8888'
            };
            break;
            
        default:
            user = {
                id: `${userType}_${Date.now()}`,
                name: `Test ${userType}`,
                email: `${userType}@test.com`,
                type: userType,
                phone: '082 123 4567'
            };
    }
    
    localStorage.setItem('swiftride_user', JSON.stringify(user));
    AppState.user = user;
    
    showNotification(`Logged in as ${user.name}`, 'success');
    
    setTimeout(() => {
        window.location.href = userType + '.html';
    }, 1000);
}

function logout() {
    console.log('👤 Logging out...');
    
    localStorage.removeItem('swiftride_user');
    AppState.user = null;
    
    if (AppState.socket) {
        AppState.socket.disconnect();
    }
    
    showNotification('Logged out successfully', 'info');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

function getCurrentUser() {
    return AppState.user;
}

function isLoggedIn(userType = null) {
    if (!AppState.user) return false;
    if (userType && AppState.user.type !== userType) return false;
    return true;
}

function requireLogin(userType = null, redirectTo = 'index.html') {
    if (!isLoggedIn(userType)) {
        showNotification(`Please login as ${userType || 'user'} first`, 'error');
        setTimeout(() => {
            window.location.href = redirectTo;
        }, 1500);
        return false;
    }
    return true;
}

// ===== GLOBAL EXPORTS =====
window.AppState = AppState;
window.APP_CONFIG = APP_CONFIG;
window.initMap = initMap;
window.addMarker = addMarker;
window.updateMarker = updateMarker;
window.removeMarker = removeMarker;
window.calculateDistance = calculateDistance;
window.calculateFare = calculateFare;
window.showNotification = showNotification;
window.apiRequest = apiRequest;
window.getAvailableDrivers = getAvailableDrivers;
window.getTripHistory = getTripHistory;
window.createTrip = createTrip;
window.updateTripStatus = updateTripStatus;
window.loginAs = loginAs;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.isLoggedIn = isLoggedIn;
window.requireLogin = requireLogin;
window.updateDriverOnMap = updateDriverOnMap;