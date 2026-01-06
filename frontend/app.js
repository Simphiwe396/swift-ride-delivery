const APP_CONFIG = {
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:10000/api'
        : '/api',
    MAP_CENTER: [-26.195246, 28.034088],
    DEFAULT_ZOOM: 13
};

let AppState = {
    user: null,
    socket: null,
    map: null,
    markers: {},
    connected: false
};

document.addEventListener('DOMContentLoaded', () => {
    const userData = localStorage.getItem('swiftride_user');
    if (userData) {
        try {
            AppState.user = JSON.parse(userData);
        } catch (e) {
            console.error('Failed to parse user data');
        }
    }
    
    initSocket();
    
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.style.display = 'none';
    }, 1000);
});

function initSocket() {
    try {
        const socketUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:10000'
            : window.location.origin;
        
        AppState.socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        AppState.socket.on('connect', () => {
            console.log('✅ Socket.io connected to:', socketUrl);
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
            updateDriverOnMap(data);
        });
        
        AppState.socket.on('new-trip', (data) => {
            if (typeof showNotification === 'function') {
                showNotification(`New trip: ${data.pickup?.address || 'Unknown'} to ${data.destination?.address || 'Unknown'}`, 'info');
            }
        });
        
        AppState.socket.on('trip-accepted', (data) => {
            if (typeof showNotification === 'function') {
                showNotification('Driver accepted your trip!', 'success');
            }
        });
        
        AppState.socket.on('trip-updated', (data) => {
            if (typeof window.handleTripUpdate === 'function') {
                window.handleTripUpdate(data);
            }
        });
        
        AppState.socket.on('driver-offline', (data) => {
            removeMarker(`driver_${data.driverId}`);
        });
        
        AppState.socket.on('connect_error', (error) => {
            console.log('Socket connection error:', error.message);
            AppState.connected = false;
        });
        
    } catch (error) {
        console.error('Failed to initialize socket:', error);
    }
}

function initMap(elementId = 'map', center = APP_CONFIG.MAP_CENTER, zoom = APP_CONFIG.DEFAULT_ZOOM) {
    const mapElement = document.getElementById(elementId);
    if (!mapElement) return null;
    
    try {
        if (AppState.map) {
            AppState.map.remove();
        }
        
        AppState.map = L.map(elementId).setView(center, zoom);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(AppState.map);
        
        return AppState.map;
    } catch (error) {
        console.error('Failed to initialize map:', error);
        return null;
    }
}

function addMarker(id, latlng, options = {}) {
    if (!AppState.map) return null;
    
    try {
        const marker = L.marker(latlng, options).addTo(AppState.map);
        AppState.markers[id] = marker;
        return marker;
    } catch (error) {
        console.error('Failed to add marker:', error);
        return null;
    }
}

function updateMarker(id, latlng) {
    if (AppState.markers[id]) {
        AppState.markers[id].setLatLng(latlng);
    }
}

function removeMarker(id) {
    if (AppState.markers[id]) {
        AppState.map.removeLayer(AppState.markers[id]);
        delete AppState.markers[id];
    }
}

function updateDriverOnMap(data) {
    const { driverId, lat, lng, status } = data;
    const markerId = `driver_${driverId}`;
    
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
                title: `Driver ${driverId.substring(0, 8)}`
            });
        }
    } catch (error) {
        console.error('Failed to update driver on map:', error);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateFare(distanceKm, ratePerKm = 10) {
    const baseFare = 20;
    const calculated = distanceKm * ratePerKm;
    return Math.max(baseFare, Math.round(calculated * 100) / 100);
}

function showNotification(message, type = 'info', duration = 5000) {
    console.log(`Notification (${type}): ${message}`);
    
    try {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s;
            max-width: 300px;
        `;
        
        const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
        notification.innerHTML = `
            <strong>${icon} ${type.toUpperCase()}:</strong>
            <div style="margin-top: 5px;">${message}</div>
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
        console.error('Failed to show notification:', error);
        alert(`${type}: ${message}`);
    }
}

async function apiRequest(endpoint, options = {}) {
    const url = APP_CONFIG.API_URL + endpoint;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        return response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

async function getAvailableDrivers() {
    try {
        return await apiRequest('/drivers/available');
    } catch (error) {
        console.error('Failed to get drivers:', error);
        return [];
    }
}

async function getTripHistory(userId, userType) {
    try {
        const query = userType === 'driver' ? `driverId=${userId}` : `customerId=${userId}`;
        return await apiRequest(`/trips/history?${query}`);
    } catch (error) {
        console.error('Failed to get trip history:', error);
        return [];
    }
}

async function createTrip(tripData) {
    try {
        return await apiRequest('/trips', {
            method: 'POST',
            body: JSON.stringify(tripData)
        });
    } catch (error) {
        console.error('Failed to create trip:', error);
        throw error;
    }
}

async function updateTripStatus(tripId, status, location = null) {
    try {
        return await apiRequest(`/trips/${tripId}`, {
            method: 'PUT',
            body: JSON.stringify({ status, ...(location && { driverLocation: location }) })
        });
    } catch (error) {
        console.error('Failed to update trip:', error);
        throw error;
    }
}

function loginAs(userType) {
    const userId = `${userType}_${Date.now()}`;
    const user = {
        id: userId,
        name: `Test ${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
        email: `${userType}@test.com`,
        type: userType,
        phone: '0821234567'
    };
    
    localStorage.setItem('swiftride_user', JSON.stringify(user));
    AppState.user = user;
    
    if (AppState.socket && AppState.socket.connected) {
        AppState.socket.emit('user-connected', {
            userId: user.id,
            userType: user.type,
            name: user.name
        });
    }
    
    showNotification(`Logged in as ${userType}`, 'success');
    
    setTimeout(() => {
        window.location.href = userType + '.html';
    }, 1000);
}

function logout() {
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