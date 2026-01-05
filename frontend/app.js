// SwiftRide Delivery App - Main JavaScript
// Global configuration and state management

// Only define if not already defined
if (typeof window.APP_CONFIG === 'undefined') {
    window.APP_CONFIG = {
        API_BASE_URL: 'https://swiftride-backend-jcyl.onrender.com/api',
        MAP_CONFIG: { defaultCenter: [-26.195246, 28.034088], defaultZoom: 14 }
    };
}

if (typeof window.AppState === 'undefined') {
    window.AppState = { 
        user: null, 
        token: null, 
        mapManager: null, 
        socket: null,
        currentTrip: null
    };
}

// Map Manager Class
class MapManager {
    constructor(mapElementId, options = {}) {
        this.mapElementId = mapElementId;
        this.options = options;
        this.map = null;
        this.markers = new Map();
        this.polylines = [];
    }

    initialize() {
        const mapElement = document.getElementById(this.mapElementId);
        if (!mapElement) {
            console.error('Map element not found:', this.mapElementId);
            return null;
        }

        try {
            this.map = L.map(this.mapElementId).setView(
                this.options.center || window.APP_CONFIG.MAP_CONFIG.defaultCenter,
                this.options.zoom || window.APP_CONFIG.MAP_CONFIG.defaultZoom
            );

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);

            if (this.options.scrollWheelZoom !== false) {
                this.map.scrollWheelZoom.enable();
            }

            console.log('✅ Map initialized:', this.mapElementId);
            return this.map;
        } catch (error) {
            console.error('Failed to initialize map:', error);
            return null;
        }
    }

    addMarker(id, latlng, options = {}) {
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

    centerMap(latlng, zoom) {
        if (this.map) {
            this.map.setView(latlng, zoom || this.map.getZoom());
        }
    }

    getDriverIcon(status = 'offline') {
        const colors = {
            'online': '#16a34a',
            'busy': '#f59e0b',
            'offline': '#6b7280'
        };
        
        return L.divIcon({
            html: `<div style="
                background: ${colors[status] || '#6b7280'};
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 0 5px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [20, 20],
            className: 'driver-marker'
        });
    }

    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
            this.markers.clear();
            this.polylines = [];
        }
    }
}

// Initialize app for dashboard pages only
document.addEventListener('DOMContentLoaded', () => {
    // Only run on dashboard pages (not index.html)
    if (!document.body.dataset.page || document.body.dataset.page === 'home') {
        return;
    }
    
    setTimeout(() => {
        const loading = document.getElementById('loadingScreen');
        if (loading) loading.style.display = 'none';
    }, 1000);
    
    // Load user from localStorage
    const token = localStorage.getItem('swiftride_token');
    const user = localStorage.getItem('swiftride_user');
    if (token && user) {
        window.AppState.token = token;
        window.AppState.user = JSON.parse(user);
        console.log('User loaded:', window.AppState.user?.name);
    }
});

// Notification system for dashboard pages
function showNotification(msg, type = 'info') {
    console.log(`${type}: ${msg}`);
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${msg}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS for notifications if not already added
if (!document.querySelector('style[data-notifications]')) {
    const notificationStyle = document.createElement('style');
    notificationStyle.setAttribute('data-notifications', 'true');
    notificationStyle.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(notificationStyle);
}

// Modal functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// Logout function
function logout() {
    if (window.AppState.socket) {
        window.AppState.socket.disconnect();
    }
    
    if (window.AppState.mapManager) {
        window.AppState.mapManager.destroy();
    }
    
    localStorage.removeItem('swiftride_token');
    localStorage.removeItem('swiftride_user');
    localStorage.removeItem('is_admin');
    
    window.AppState = { user: null, token: null, mapManager: null, socket: null };
    
    showNotification('Logged out successfully', 'info');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Trip management
function calculateFare(distanceKm, ratePerKm = 10) {
    const baseFare = 20;
    const distanceFare = distanceKm * ratePerKm;
    const serviceFee = (baseFare + distanceFare) * 0.1;
    const total = baseFare + distanceFare + serviceFee;
    
    return {
        base: baseFare,
        distance: distanceFare,
        serviceFee: serviceFee,
        total: Math.round(total)
    };
}

// Security check for admin
function isAdmin() {
    const user = window.AppState.user;
    const isAdminFlag = localStorage.getItem('is_admin');
    return user && user.userType === 'admin' && isAdminFlag === 'true';
}

// Security check for driver
function isDriver() {
    const user = window.AppState.user;
    return user && user.userType === 'driver';
}

// Security check for customer
function isCustomer() {
    const user = window.AppState.user;
    return user && user.userType === 'customer';
}

// Expose functions to global scope
window.MapManager = MapManager;
window.showNotification = showNotification;
window.logout = logout;
window.showModal = showModal;
window.hideModal = hideModal;
window.calculateFare = calculateFare;
window.isAdmin = isAdmin;
window.isDriver = isDriver;
window.isCustomer = isCustomer;

// Redirect function
window.redirectTo = (page) => {
    window.location.href = page + '.html';
};

// Track driver function
window.trackDriver = (driverId) => {
    localStorage.setItem('trackingDriverId', driverId);
    window.location.href = `tracking.html?driver=${driverId}`;
};

// DO NOT EXPOSE login() function - it's only for index.html
// DO NOT EXPOSE AppState globally - it's only for dashboard pages