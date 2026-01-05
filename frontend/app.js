// SwiftRide Delivery - Main Application
// Global Configuration
const CONFIG = {
  API_URL: window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://swiftride-backend-jcyl.onrender.com/api',
  MAP_CENTER: [-26.195246, 28.034088],
  DEFAULT_ZOOM: 14,
  PRICING: {
    ECONOMY: 5,   // R5/km
    STANDARD: 10, // R10/km
    EXPRESS: 20   // R20/km
  }
};

// Global State
let currentUser = null;
let currentMap = null;
let socket = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('SwiftRide App Initializing...');
  
  // Load user from localStorage
  const savedUser = localStorage.getItem('swiftride_user');
  const savedToken = localStorage.getItem('swiftride_token');
  
  if (savedUser && savedToken) {
    currentUser = JSON.parse(savedUser);
    console.log('User loaded:', currentUser.name);
  }
  
  // Initialize socket
  initSocket();
  
  // Initialize service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('Service Worker registered:', registration);
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
      });
  }
  
  // Hide loading screen
  setTimeout(() => {
    const loading = document.getElementById('loadingScreen');
    if (loading) loading.style.display = 'none';
  }, 1500);
});

// Socket.io initialization
function initSocket() {
  try {
    socket = io('https://swiftride-backend-jcyl.onrender.com', {
      transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
    });
    
    socket.on('connect_error', (error) => {
      console.log('Socket connection error:', error);
    });
    
    socket.on('location:update', (data) => {
      console.log('Location update:', data);
      if (window.handleLocationUpdate) {
        window.handleLocationUpdate(data);
      }
    });
    
    socket.on('status:update', (data) => {
      console.log('Status update:', data);
      if (window.handleStatusUpdate) {
        window.handleStatusUpdate(data);
      }
    });
  } catch (error) {
    console.log('Socket.io not available:', error);
  }
}

// Map Manager Class
class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.map = null;
    this.markers = new Map();
    this.options = {
      center: CONFIG.MAP_CENTER,
      zoom: CONFIG.DEFAULT_ZOOM,
      ...options
    };
  }
  
  initialize() {
    try {
      if (typeof L === 'undefined') {
        console.error('Leaflet not loaded');
        return null;
      }
      
      const container = document.getElementById(this.containerId);
      if (!container) {
        console.error('Map container not found:', this.containerId);
        return null;
      }
      
      this.map = L.map(this.containerId).setView(this.options.center, this.options.zoom);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);
      
      console.log('✅ Map initialized:', this.containerId);
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
  
  centerOn(latlng, zoom = null) {
    if (this.map) {
      this.map.setView(latlng, zoom || this.map.getZoom());
    }
  }
  
  clearMarkers() {
    this.markers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers.clear();
  }
}

// Authentication Functions
function loginAsUser(userType) {
  let userData;
  
  switch(userType) {
    case 'customer':
      userData = {
        _id: 'cust_' + Date.now(),
        name: 'Demo Customer',
        email: 'customer@demo.com',
        userType: 'customer',
        phone: '0831234567',
        address: '123 Main St, Johannesburg'
      };
      break;
      
    case 'driver':
      userData = {
        _id: 'drv_' + Date.now(),
        name: 'Demo Driver',
        email: 'driver@demo.com',
        userType: 'driver',
        phone: '0821234567',
        vehicle: {
          type: 'motorcycle',
          model: 'Honda 125',
          licensePlate: 'DEMO123',
          color: 'Red'
        },
        status: 'online',
        rating: 4.8,
        totalEarnings: 12500,
        todayEarnings: 325,
        todayTrips: 7,
        completedTrips: 245,
        totalDistance: 1250
      };
      break;
  }
  
  if (userData) {
    currentUser = userData;
    localStorage.setItem('swiftride_user', JSON.stringify(userData));
    localStorage.setItem('swiftride_token', 'demo_token_' + Date.now());
    
    showNotification(`Welcome ${userData.name}!`, 'success');
    
    // Redirect to appropriate page
    setTimeout(() => {
      window.location.href = userType + '.html';
    }, 500);
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('swiftride_user');
  localStorage.removeItem('swiftride_token');
  localStorage.removeItem('is_admin');
  
  showNotification('Logged out successfully', 'info');
  
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
}

// Utility Functions
function showNotification(message, type = 'info') {
  // Create notification element
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
    z-index: 10000;
    animation: slideIn 0.3s ease;
    max-width: 300px;
    font-family: 'Poppins', sans-serif;
  `;
  
  const icon = type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle';
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <i class="fas fa-${icon}"></i>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Add animation styles if not present
  if (!document.querySelector('style[data-notifications]')) {
    const style = document.createElement('style');
    style.setAttribute('data-notifications', 'true');
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
  
  // Auto remove
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function calculateFare(distanceKm, ratePerKm = CONFIG.PRICING.STANDARD) {
  const baseFare = 20;
  const distanceFare = distanceKm * ratePerKm;
  const serviceFee = (baseFare + distanceFare) * 0.1;
  const total = baseFare + distanceFare + serviceFee;
  
  return {
    base: baseFare.toFixed(2),
    distance: distanceFare.toFixed(2),
    serviceFee: serviceFee.toFixed(2),
    total: Math.round(total),
    rate: ratePerKm
  };
}

// Make functions globally available
window.CONFIG = CONFIG;
window.currentUser = currentUser;
window.currentMap = currentMap;
window.socket = socket;
window.MapManager = MapManager;
window.loginAsUser = loginAsUser;
window.logout = logout;
window.showNotification = showNotification;
window.calculateFare = calculateFare;

console.log('SwiftRide App Ready!');