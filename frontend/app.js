// ===== GLOBAL APP CONFIGURATION =====
if (typeof APP_CONFIG === 'undefined') {
    const APP_CONFIG = {
        API_URL: window.location.hostname === 'localhost' 
            ? 'http://localhost:10000/api'
            : '/api',
        MAP_CENTER: [-26.195246, 28.034088],
        DEFAULT_ZOOM: 13,
        SOCKET_URL: window.location.hostname === 'localhost' 
            ? 'http://localhost:10000'
            : window.location.origin
    };
    window.APP_CONFIG = APP_CONFIG;
}

let AppState = {
    user: null,
    socket: null,
    map: null,
    markers: {},
    connected: false,
    currentPage: 'home'
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 SwiftRide App Initializing...');
    
    const userData = localStorage.getItem('swiftride_user');
    if (userData) {
        try {
            AppState.user = JSON.parse(userData);
            console.log('✅ User found:', AppState.user.name);
        } catch (e) {
            console.error('❌ Failed to parse user data');
            localStorage.removeItem('swiftride_user');
        }
    } else {
        console.log('🔒 No user logged in');
    }
    
    // Get current page
    const body = document.body;
    AppState.currentPage = body.getAttribute('data-page') || 'home';
    
    // Initialize based on page
    initializePage();
    
    // Hide loading screen
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 1500);
});

function initializePage() {
    console.log(`Initializing page: ${AppState.currentPage}`);
    
    switch(AppState.currentPage) {
        case 'home':
            initHomePage();
            break;
        case 'customer':
            if (!requireLogin('customer', 'index.html')) return;
            break;
        case 'driver':
            if (!requireLogin('driver', 'index.html')) return;
            break;
        case 'admin':
            if (!requireLogin('admin', 'index.html')) return;
            break;
    }
    
    // Initialize socket for all authenticated pages
    if (AppState.user && AppState.user.type) {
        initSocket();
    }
}

function initHomePage() {
    console.log('Initializing home page...');
    
    // If user is logged in, show appropriate page
    if (AppState.user && AppState.user.type) {
        console.log(`Redirecting ${AppState.user.type} to their dashboard`);
        setTimeout(() => {
            window.location.href = `${AppState.user.type}.html`;
        }, 500);
        return;
    }
    
    // Initialize map if on homepage
    const mapElement = document.getElementById('previewMap');
    if (mapElement && typeof L !== 'undefined') {
        console.log('🗺️ Map found, initializing...');
        try {
            const map = L.map('previewMap').setView([-26.195246, 28.034088], 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);
            
            // Add sample markers
            L.marker([-26.195246, 28.034088]).addTo(map)
                .bindPopup('TV Stands Warehouse<br>Delivery Hub')
                .openPopup();
                
            L.marker([-26.205246, 28.044088]).addTo(map)
                .bindPopup('Delivery Driver #1<br>On Route');
                
            L.marker([-26.185246, 28.024088]).addTo(map)
                .bindPopup('Delivery Driver #2<br>Available');
                
            console.log('✅ Map initialized successfully');
        } catch (error) {
            console.error('❌ Map initialization failed:', error);
        }
    }
}

// ===== SOCKET.IO FUNCTIONS =====
function initSocket() {
    try {
        console.log('🔌 Initializing socket connection...');
        
        AppState.socket = io(APP_CONFIG.SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        AppState.socket.on('connect', () => {
            console.log('✅ Socket.io connected');
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
            if (typeof updateDriverOnMap === 'function') {
                updateDriverOnMap(data);
            }
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
            if (typeof removeMarker === 'function') {
                removeMarker(`driver_${data.driverId}`);
            }
        });
        
        AppState.socket.on('connect_error', (error) => {
            console.log('❌ Socket connection error:', error.message);
            AppState.connected = false;
            showNotification('Connection lost. Reconnecting...', 'warning');
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
        }
        
        console.log(`🗺️ Creating map for ${elementId}`);
        AppState.map = L.map(elementId).setView(center, zoom);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(AppState.map);
        
        console.log('✅ Map created successfully');
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
    return Math.round(R * c * 10) / 10; // Round to 1 decimal
}

function calculateFare(distanceKm, ratePerKm = 10) {
    const baseFare = 50; // R50 base for TV stand deliveries
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
            ...options
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
        showNotification('Network error. Please check connection.', 'error');
        throw error;
    }
}

async function getAvailableDrivers() {
    try {
        console.log('👥 Fetching available drivers...');
        return await apiRequest('/drivers/available');
    } catch (error) {
        console.error('❌ Failed to get drivers:', error);
        showNotification('Failed to load drivers', 'error');
        return [];
    }
}

async function getTripHistory(userId, userType) {
    try {
        console.log(`📋 Fetching trip history for ${userType} ${userId}`);
        const query = userType === 'driver' ? `driverId=${userId}` : `customerId=${userId}`;
        return await apiRequest(`/trips/history?${query}`);
    } catch (error) {
        console.error('❌ Failed to get trip history:', error);
        showNotification('Failed to load trip history', 'error');
        return [];
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
        throw error;
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
        throw error;
    }
}

// ===== AUTH FUNCTIONS =====
function loginAs(userType) {
    console.log(`👤 Logging in as ${userType}`);
    
    const userId = `${userType}_${Date.now()}`;
    const user = {
        id: userId,
        name: userType === 'admin' ? 'Business Owner' : `Test ${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
        email: `${userType}@tvstands.com`,
        type: userType,
        phone: '0821234567'
    };
    
    // For admin, use proper credentials
    if (userType === 'admin') {
        user.id = 'admin_001';
        user.name = 'Business Owner';
        user.email = 'owner@tvstands.com';
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