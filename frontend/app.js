// ===== SWIFTRIDE WORKING APP.JS =====
const APP_CONFIG = {
    API_BASE_URL: 'https://swiftride-backend-jcyl.onrender.com/api'
};

let AppState = {
    user: null,
    token: null,
    socket: null,
    mapManager: null
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 App.js loaded');
    
    // Load user from localStorage
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser) {
        try {
            AppState.user = JSON.parse(savedUser);
            AppState.token = savedToken;
            console.log('✅ User loaded:', AppState.user);
        } catch (e) {
            console.error('❌ Error parsing user:', e);
            localStorage.clear();
        }
    }
    
    // Hide loading screen after a short delay
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 800);
});

// ===== REQUIRED FUNCTIONS =====
window.trackDriver = function(id) {
    console.log('Tracking driver:', id);
    localStorage.setItem('trackingDriverId', id);
    window.location.href = 'tracking.html?driver=' + id;
};

window.logout = function() {
    localStorage.clear();
    AppState.user = null;
    AppState.token = null;
    window.location.href = 'index.html';
};

window.showModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        modal.style.opacity = '1';
    }
};

window.hideModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
};

window.showNotification = function(msg, type = 'info') {
    console.log(type.toUpperCase() + ':', msg);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${msg}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add styles if not exists
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-width: 250px;
                animation: slideIn 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            }
            .notification-success { background: #4CAF50; }
            .notification-error { background: #F44336; }
            .notification-info { background: #2196F3; }
            .notification-warning { background: #FF9800; }
            .notification button {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                margin-left: 15px;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 4000);
};

window.redirectTo = function(page) {
    window.location.href = page + '.html';
};

// ===== TEST LOGIN BUTTONS =====
window.loginAsAdmin = function() {
    const user = {
        _id: 'admin_001',
        name: 'Admin User',
        email: 'admin@swiftride.com',
        phone: '082 123 4567',
        userType: 'admin'
    };
    
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'test_admin_token_123');
    
    AppState.user = user;
    AppState.token = 'test_admin_token_123';
    
    showNotification('Logged in as Admin', 'success');
    setTimeout(() => {
        window.location.href = 'admin.html';
    }, 500);
};

window.loginAsDriver = function() {
    const user = {
        _id: 'driver_001',
        name: 'John Driver',
        email: 'driver@swiftride.com',
        phone: '083 987 6543',
        userType: 'driver'
    };
    
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'test_driver_token_123');
    
    AppState.user = user;
    AppState.token = 'test_driver_token_123';
    
    showNotification('Logged in as Driver', 'success');
    setTimeout(() => {
        window.location.href = 'driver.html';
    }, 500);
};

window.loginAsCustomer = function() {
    const user = {
        _id: 'customer_001',
        name: 'Sarah Customer',
        email: 'customer@swiftride.com',
        phone: '084 555 6789',
        userType: 'customer'
    };
    
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'test_customer_token_123');
    
    AppState.user = user;
    AppState.token = 'test_customer_token_123';
    
    showNotification('Logged in as Customer', 'success');
    setTimeout(() => {
        window.location.href = 'customer.html';
    }, 500);
};

// ===== API FUNCTIONS =====
window.API = {
    request: async function(endpoint, options = {}) {
        const url = APP_CONFIG.API_BASE_URL + endpoint;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': AppState.token ? `Bearer ${AppState.token}` : ''
            }
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            showNotification('Network error. Using demo data.', 'warning');
            
            // Return demo data for development
            return getDemoData(endpoint);
        }
    }
};

// Demo data fallback
function getDemoData(endpoint) {
    if (endpoint.includes('/drivers')) {
        return [
            { _id: '1', name: 'John Driver', status: 'online', phone: '082 123 4567', vehicle: { type: 'motorcycle' } },
            { _id: '2', name: 'Sarah Rider', status: 'busy', phone: '083 987 6543', vehicle: { type: 'car' } },
            { _id: '3', name: 'Mike Courier', status: 'online', phone: '084 555 6789', vehicle: { type: 'motorcycle' } }
        ];
    }
    
    if (endpoint.includes('/trips')) {
        return [
            { tripId: 'TRIP-001', status: 'delivered', fare: { total: 120.50 } },
            { tripId: 'TRIP-002', status: 'enroute', fare: { total: 85.00 } },
            { tripId: 'TRIP-003', status: 'pending', fare: { total: 65.00 } }
        ];
    }
    
    if (endpoint.includes('/admin/stats')) {
        return {
            totalDrivers: 12,
            onlineDrivers: 8,
            activeTrips: 15,
            todayRevenue: 2450.75,
            completionRate: 95
        };
    }
    
    return { success: true, message: 'Demo data' };
}

// ===== MAP MANAGER =====
window.MapManager = class MapManager {
    constructor(mapId, options = {}) {
        this.mapId = mapId;
        this.options = {
            center: [-26.195246, 28.034088],
            zoom: 12,
            scrollWheelZoom: true,
            ...options
        };
        this.map = null;
        this.markers = new Map();
    }
    
    initialize() {
        const element = document.getElementById(this.mapId);
        if (!element) {
            console.error('Map element not found:', this.mapId);
            return null;
        }
        
        try {
            // Clear previous map
            element.innerHTML = '';
            element.style.height = element.style.height || '400px';
            
            // Create new map
            this.map = L.map(this.mapId).setView(this.options.center, this.options.zoom);
            
            // Add tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(this.map);
            
            if (this.options.scrollWheelZoom) {
                this.map.scrollWheelZoom.enable();
            }
            
            console.log('✅ Map initialized:', this.mapId);
            return this.map;
            
        } catch (error) {
            console.error('Failed to initialize map:', error);
            
            // Fallback UI
            element.innerHTML = `
                <div style="height:100%;background:linear-gradient(135deg,#6C63FF,#4A43C8);
                           border-radius:8px;display:flex;align-items:center;
                           justify-content:center;color:white;text-align:center;padding:20px;">
                    <div>
                        <i class="fas fa-map-marked-alt" style="font-size:3rem;margin-bottom:1rem;"></i>
                        <h3>Live Map</h3>
                        <p>Map view will appear here</p>
                        <p style="font-size:0.9rem;opacity:0.8;">Leaflet map library required</p>
                    </div>
                </div>
            `;
            return null;
        }
    }
    
    addMarker(id, latlng, options = {}) {
        if (!this.map) return null;
        
        const marker = L.marker(latlng, options).addTo(this.map);
        
        if (options.popup) {
            marker.bindPopup(options.popup);
        }
        
        this.markers.set(id, marker);
        return marker;
    }
    
    updateMarker(id, latlng) {
        const marker = this.markers.get(id);
        if (marker) {
            marker.setLatLng(latlng);
        }
    }
    
    removeMarker(id) {
        const marker = this.markers.get(id);
        if (marker) {
            this.map.removeLayer(marker);
            this.markers.delete(id);
        }
    }
    
    centerMap(latlng) {
        if (this.map) {
            this.map.setView(latlng, this.map.getZoom());
        }
    }
    
    fitBounds(markers) {
        if (this.map && markers.length > 0) {
            const bounds = L.latLngBounds(markers.map(m => m.getLatLng()));
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
    
    getDriverIcon(status) {
        const iconUrl = status === 'online' ? 
            'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png' :
            'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
        
        return L.icon({
            iconUrl: iconUrl,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        });
    }
    
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
            this.markers.clear();
        }
    }
};

// ===== DEBUG =====
console.log('✅ app.js loaded successfully');
console.log('Available functions:', Object.keys(window).filter(k => 
    typeof window[k] === 'function' && 
    ['trackDriver', 'loginAsAdmin', 'loginAsDriver', 'loginAsCustomer', 'logout'].includes(k)
));