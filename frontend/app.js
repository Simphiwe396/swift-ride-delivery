// ===== APPLICATION CONFIGURATION =====
const APP_CONFIG = {
  // API Endpoints
  API_BASE_URL: 'https://swiftride-api.onrender.com/api',
  // For local testing: 'http://localhost:5000/api'
  
  // Map Configuration
  MAP_CONFIG: {
    defaultCenter: [-26.195246, 28.034088], // Johannesburg
    defaultZoom: 12,
    maxZoom: 18,
    minZoom: 10
  },
  
  // User Types
  USER_TYPES: {
    ADMIN: 'admin',
    DRIVER: 'driver', 
    CUSTOMER: 'customer'
  },
  
  // Delivery Status
  STATUS: {
    PENDING: 'pending',
    ENROUTE: 'enroute',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
  }
};

// ===== GLOBAL STATE =====
let AppState = {
  user: null,
  token: null,
  socket: null,
  map: null,
  activeDrivers: new Map(),
  activeDeliveries: new Map()
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 SwiftRide App Initializing...');
  
  // Hide loading screen
  setTimeout(() => {
    document.getElementById('loadingScreen')?.classList.add('hidden');
  }, 1500);
  
  // Check authentication
  await checkAuth();
  
  // Initialize features based on page
  initializePageFeatures();
  
  // Setup event listeners
  setupEventListeners();
});

// ===== AUTHENTICATION FUNCTIONS =====
async function checkAuth() {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  
  if (token && userData) {
    try {
      AppState.token = token;
      AppState.user = JSON.parse(userData);
      
      // Verify token with server
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        console.log('✅ User authenticated:', AppState.user.name);
        updateUIForLoggedInUser();
        connectWebSocket();
      } else {
        // Token invalid, clear local storage
        logout();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    }
  } else {
    console.log('🔒 No user logged in');
  }
}

function updateUIForLoggedInUser() {
  // Update navigation based on user type
  const userType = AppState.user?.userType;
  const userName = AppState.user?.name;
  
  // Show user info in header
  const userElements = document.querySelectorAll('.user-info');
  userElements.forEach(el => {
    if (userName) {
      el.innerHTML = `
        <div class="user-avatar">${userName.charAt(0)}</div>
        <div>
          <strong>${userName}</strong>
          <small>${userType}</small>
        </div>
      `;
    }
  });
  
  // Show/hide auth buttons
  const loginBtn = document.querySelector('.login-btn');
  const logoutBtn = document.querySelector('.logout-btn');
  
  if (loginBtn) loginBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'block';
}

// ===== API FUNCTIONS =====
class API {
  static async request(endpoint, options = {}) {
    const url = `${APP_CONFIG.API_BASE_URL}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(AppState.token && { 'Authorization': `Bearer ${AppState.token}` })
      }
    };
    
    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'API request failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      showNotification(error.message, 'error');
      throw error;
    }
  }
  
  // Auth endpoints
  static async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }
  
  static async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }
  
  // Driver endpoints
  static async getDrivers(status = 'all') {
    return this.request(`/drivers?status=${status}`);
  }
  
  static async addDriver(driverData) {
    return this.request('/drivers', {
      method: 'POST',
      body: JSON.stringify(driverData)
    });
  }
  
  // Trip endpoints
  static async createTrip(tripData) {
    return this.request('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData)
    });
  }
  
  static async getTrips(userId, status = 'all') {
    return this.request(`/trips?userId=${userId}&status=${status}`);
  }
  
  // Tracking endpoints
  static async updateLocation(location) {
    return this.request('/tracking/location', {
      method: 'POST',
      body: JSON.stringify(location)
    });
  }
}

// ===== MAP FUNCTIONS =====
class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.map = null;
    this.markers = new Map();
    this.options = {
      center: APP_CONFIG.MAP_CONFIG.defaultCenter,
      zoom: APP_CONFIG.MAP_CONFIG.defaultZoom,
      ...options
    };
    
    // Check if we already have a map instance
    this._checkExistingMap();
  }
  
  _checkExistingMap() {
    // Check if container exists and already has a map
    const container = document.getElementById(this.containerId);
    if (container && container._leaflet_id) {
      console.log(`Map container ${this.containerId} already has a map. Will reuse it.`);
    }
  }
  
  initialize() {
    const container = document.getElementById(this.containerId);
    
    if (!container) {
      console.error(`Map container ${this.containerId} not found!`);
      return null;
    }
    
    // If map already exists, don't create a new one
    if (container._leaflet_id && window.L) {
      // Try to get existing map
      const existingMap = L.DomUtil.get(this.containerId)._leaflet_id;
      if (existingMap) {
        console.log(`Reusing existing map for ${this.containerId}`);
        this.map = L.map(this.containerId, { reuse: true });
        return this.map;
      }
    }
    
    // Clear container content first
    container.innerHTML = '';
    
    // Set fixed height for map container
    container.style.height = '100%';
    container.style.width = '100%';
    container.style.position = 'relative';
    
    if (!this.map) {
      try {
        // Initialize Leaflet map
        this.map = L.map(this.containerId, {
          center: this.options.center,
          zoom: this.options.zoom,
          zoomControl: true,
          attributionControl: true
        });
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: APP_CONFIG.MAP_CONFIG.maxZoom,
          minZoom: APP_CONFIG.MAP_CONFIG.minZoom
        }).addTo(this.map);
        
        // Add scale control
        L.control.scale().addTo(this.map);
        
        console.log(`🗺️ Map initialized in ${this.containerId}`);
        
      } catch (error) {
        console.error(`Failed to initialize map in ${this.containerId}:`, error);
        return null;
      }
    }
    
    return this.map;
  }
  
  addMarker(id, latlng, options = {}) {
    if (!this.map) return null;
    
    const defaultOptions = {
      title: 'Location',
      draggable: false,
      icon: this.getDefaultIcon()
    };
    
    const marker = L.marker(latlng, { ...defaultOptions, ...options });
    marker.addTo(this.map);
    
    if (options.popup) {
      marker.bindPopup(options.popup);
    }
    
    this.markers.set(id, marker);
    return marker;
  }
  
  updateMarker(id, latlng) {
    const marker = this.markers.get(id);
    if (marker && this.map) {
      marker.setLatLng(latlng);
      return true;
    }
    return false;
  }
  
  removeMarker(id) {
    const marker = this.markers.get(id);
    if (marker && this.map) {
      this.map.removeLayer(marker);
      this.markers.delete(id);
    }
  }
  
  addRoute(waypoints, options = {}) {
    if (!this.map) return null;
    
    const defaultOptions = {
      color: '#6C63FF',
      weight: 4,
      opacity: 0.7,
      dashArray: '10, 10'
    };
    
    const polyline = L.polyline(waypoints, { ...defaultOptions, ...options });
    polyline.addTo(this.map);
    return polyline;
  }
  
  getDefaultIcon() {
    return L.divIcon({
      html: '<div style="background: #6C63FF; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 0 10px rgba(108, 99, 255, 0.7);"><i class="fas fa-map-marker-alt"></i></div>',
      iconSize: [30, 30],
      className: 'pulse'
    });
  }
  
  getDriverIcon(status) {
    const colors = {
      online: '#4CAF50',
      busy: '#FF9800',
      offline: '#9E9E9E'
    };
    
    return L.divIcon({
      html: `<div style="background: ${colors[status] || colors.offline}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 0 15px ${colors[status] || colors.offline}80;"><i class="fas fa-motorcycle"></i></div>`,
      iconSize: [40, 40],
      className: 'pulse'
    });
  }
  
  centerMap(latlng, zoom = 14) {
    if (this.map) {
      this.map.setView(latlng, zoom);
    }
  }
  
  fitBounds(markers) {
    if (markers.length > 0 && this.map) {
      const bounds = L.latLngBounds(markers.map(m => m.getLatLng()));
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
  
  // Add this method to properly destroy the map
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.markers.clear();
      
      // Clear the container
      const container = document.getElementById(this.containerId);
      if (container) {
        container.innerHTML = '';
      }
    }
  }
}

// ===== WEBSOCKET FUNCTIONS =====
function connectWebSocket() {
  if (!AppState.user || AppState.socket) return;
  
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const wsUrl = `${protocol}swift-ride-api.onrender.com`; // Update with your backend URL
  
  try {
    AppState.socket = io(wsUrl, {
      auth: {
        token: AppState.token,
        userId: AppState.user._id,
        userType: AppState.user.userType
      }
    });
    
    AppState.socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      
      // Register based on user type
      if (AppState.user.userType === APP_CONFIG.USER_TYPES.DRIVER) {
        AppState.socket.emit('driver_connect', AppState.user._id);
      } else if (AppState.user.userType === APP_CONFIG.USER_TYPES.ADMIN) {
        AppState.socket.emit('admin_connect', AppState.user._id);
      }
    });
    
    // Handle driver location updates (for admin/customer)
    AppState.socket.on('driver_location', (data) => {
      handleDriverLocationUpdate(data);
    });
    
    // Handle driver status updates
    AppState.socket.on('driver_status', (data) => {
      handleDriverStatusUpdate(data);
    });
    
    // Handle new delivery assignments (for drivers)
    AppState.socket.on('new_delivery', (data) => {
      handleNewDelivery(data);
    });
    
    // Handle delivery status updates
    AppState.socket.on('delivery_status', (data) => {
      handleDeliveryStatusUpdate(data);
    });
    
    AppState.socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
    });
    
    AppState.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
  } catch (error) {
    console.error('WebSocket connection failed:', error);
  }
}

// ===== EVENT HANDLERS =====
function handleDriverLocationUpdate(data) {
  const { driverId, location } = data;
  
  // Update marker on map
  if (AppState.mapManager) {
    const markerExists = AppState.mapManager.updateMarker(
      `driver_${driverId}`,
      [location.lat, location.lng]
    );
    
    if (!markerExists) {
      // Create new marker
      AppState.mapManager.addMarker(
        `driver_${driverId}`,
        [location.lat, location.lng],
        {
          icon: AppState.mapManager.getDriverIcon('online'),
          popup: `Driver: ${driverId}`
        }
      );
    }
  }
  
  // Update driver in list
  updateDriverInList(driverId, location);
}

function handleDriverStatusUpdate(data) {
  const { driverId, status } = data;
  
  // Update UI elements
  const driverElements = document.querySelectorAll(`[data-driver-id="${driverId}"]`);
  driverElements.forEach(el => {
    el.classList.remove('status-online', 'status-busy', 'status-offline');
    el.classList.add(`status-${status}`);
    
    const statusText = el.querySelector('.driver-status-text');
    if (statusText) {
      statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
  });
  
  // Update map marker icon
  if (AppState.mapManager) {
    const marker = AppState.mapManager.markers.get(`driver_${driverId}`);
    if (marker) {
      marker.setIcon(AppState.mapManager.getDriverIcon(status));
    }
  }
}

function handleNewDelivery(data) {
  if (AppState.user?.userType === APP_CONFIG.USER_TYPES.DRIVER) {
    showNotification(`New delivery assigned! ${data.pickup} → ${data.destination}`, 'info');
    
    // Show delivery modal
    showDeliveryModal(data);
  }
}

function handleDeliveryStatusUpdate(data) {
  const { deliveryId, status } = data;
  
  // Update delivery card
  const deliveryCard = document.querySelector(`[data-delivery-id="${deliveryId}"]`);
  if (deliveryCard) {
    deliveryCard.classList.remove(
      'badge-pending', 
      'badge-enroute', 
      'badge-delivered', 
      'badge-cancelled'
    );
    deliveryCard.classList.add(`badge-${status}`);
    
    const statusElement = deliveryCard.querySelector('.delivery-status');
    if (statusElement) {
      statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }
  }
}

// ===== UI FUNCTIONS =====
function showNotification(message, type = 'info') {
  // Remove existing notification
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${getNotificationIcon(type)}"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${getNotificationColor(type)};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

function getNotificationIcon(type) {
  const icons = {
    success: 'check-circle',
    error: 'exclamation-circle',
    warning: 'exclamation-triangle',
    info: 'info-circle'
  };
  return icons[type] || 'info-circle';
}

function getNotificationColor(type) {
  const colors = {
    success: '#4CAF50',
    error: '#FF5252',
    warning: '#FF9800',
    info: '#2196F3'
  };
  return colors[type] || '#2196F3';
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
}

// ===== FIX PAGE ACCESS =====
function checkPageAccess() {
    const page = document.body.dataset.page;
    console.log('Checking access for page:', page, 'User:', AppState.user);
    
    // Public pages (no auth required)
    if (page === 'home' || page === 'tracking') return true;
    
    // If no user, show login modal instead of redirecting
    if (!AppState.user) {
        console.log('No user, showing login modal');
        showModal('loginModal');
        return false;
    }
    
    // Check user type matches page
    const userType = AppState.user?.userType;
    const pageType = page; // home, admin, driver, customer, tracking
    
    if (userType !== pageType && page !== 'tracking') {
        console.log(`User type ${userType} cannot access ${pageType} page`);
        showNotification(`Please login as ${pageType} to access this page`, 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return false;
    }
    
    return true;
}

// ===== PAGE-SPECIFIC INITIALIZATION =====
function initializePageFeatures() {
    const page = document.body.dataset.page;
    console.log('Initializing page:', page);
    
    // Check if user can access this page
    if (!checkPageAccess()) {
        return;
    }
    
    switch(page) {
        case 'home':
            initHomePage();
            break;
        case 'admin':
            initAdminPage();
            break;
        case 'driver':
            initDriverPage();
            break;
        case 'customer':
            initCustomerPage();
            break;
        case 'tracking':
            initTrackingPage();
            break;
    }
}

// ===== PAGE-SPECIFIC INITIALIZATION =====
function initializePageFeatures() {
  const page = document.body.dataset.page;
  
  console.log('Initializing page:', page);
  
  // Don't redirect if no user but on home or tracking page
  if (!AppState.user && (page === 'home' || page === 'tracking')) {
    console.log('No user but on public page:', page);
  } else if (!AppState.user && (page === 'admin' || page === 'driver' || page === 'customer')) {
    console.log('No user on protected page');
    showModal('loginModal');
    return;
  }
  
  switch(page) {
    case 'home':
      initHomePage();
      break;
    case 'admin':
      if (AppState.user?.userType === 'admin') {
        initAdminPage();
      } else {
        showNotification('Admin access required', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
      }
      break;
    case 'driver':
      if (AppState.user?.userType === 'driver') {
        initDriverPage();
      } else {
        showNotification('Driver login required', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
      }
      break;
    case 'customer':
      if (AppState.user?.userType === 'customer') {
        initCustomerPage();
      } else {
        showNotification('Customer login required', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
      }
      break;
    case 'tracking':
      initTrackingPage();
      break;
  }
}

function initHomePage() {
  console.log('Initializing home page...');
  
  // Initialize preview map - ONLY if it doesn't exist
  const previewMapDiv = document.getElementById('previewMap');
  if (previewMapDiv && !previewMapDiv._leaflet_id) {
    // Wait a bit for DOM to be ready
    setTimeout(() => {
      try {
        const previewMap = new MapManager('previewMap', {
          center: APP_CONFIG.MAP_CONFIG.defaultCenter,
          zoom: 13,
          scrollWheelZoom: false, // Prevent zoom on scroll
          dragging: true
        });
        
        const map = previewMap.initialize();
        
        if (map) {
          // Add sample marker
          previewMap.addMarker('center', APP_CONFIG.MAP_CONFIG.defaultCenter, {
            popup: 'Johannesburg CBD'
          });
          
          // Add sample driver markers
          const sampleDrivers = [
            { id: 'driver1', lat: -26.190, lng: 28.030, status: 'online' },
            { id: 'driver2', lat: -26.200, lng: 28.040, status: 'busy' },
            { id: 'driver3', lat: -26.180, lng: 28.020, status: 'online' }
          ];
          
          sampleDrivers.forEach(driver => {
            previewMap.addMarker(driver.id, [driver.lat, driver.lng], {
              icon: previewMap.getDriverIcon(driver.status),
              popup: `Driver ${driver.id} - ${driver.status}`
            });
          });
        }
      } catch (error) {
        console.error('Home page map error:', error);
      }
    }, 1000);
  }
}

// ===== TRACKING HISTORY FUNCTIONS =====
async function loadTrackingHistory() {
    try {
        const container = document.getElementById('trackingHistory');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = `
            <div class="loading-trackings">
                <div class="loader"></div>
                <p>Loading tracking history...</p>
            </div>
        `;
        
        // Try to fetch real tracking data
        let trackings = [];
        try {
            const response = await API.request('/trips/recent');
            trackings = response.trips || response || [];
        } catch (error) {
            console.log('Using sample tracking data');
            // Fallback to sample data if API fails
            trackings = getSampleTrackings();
        }
        
        // Render tracking cards
        renderTrackingHistory(trackings);
        
    } catch (error) {
        console.error('Failed to load tracking history:', error);
        // Show error state
        const container = document.getElementById('trackingHistory');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load tracking history</p>
                    <button class="retry-btn" onclick="loadTrackingHistory()">Retry</button>
                </div>
            `;
        }
    }
}

function renderTrackingHistory(trackings) {
    const container = document.getElementById('trackingHistory');
    if (!container) return;
    
    if (!trackings || trackings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>No tracking history available</p>
            </div>
        `;
        return;
    }
    
    // Limit to 6 trackings for home page
    const recentTrackings = trackings.slice(0, 6);
    
    container.innerHTML = recentTrackings.map(tracking => `
        <div class="tracking-card">
            <div class="tracking-header">
                <div class="tracking-driver-info">
                    <div class="driver-avatar-sm">
                        ${tracking.driver?.name?.charAt(0) || 'D'}
                    </div>
                    <div>
                        <h4>${tracking.driver?.name || 'Driver #' + tracking.driverId?.substring(0, 6)}</h4>
                        <small>Trip #${tracking.tripId?.substring(0, 8) || 'N/A'}</small>
                    </div>
                </div>
                <span class="tracking-status status-${tracking.status || 'pending'}">
                    ${tracking.status || 'pending'}
                </span>
            </div>
            
            <div class="tracking-details">
                <div class="tracking-route">
                    <i class="fas fa-map-marker-alt" style="color: #4CAF50;"></i>
                    <span>${tracking.pickup?.address || 'Pickup location'}</span>
                </div>
                <div class="tracking-route">
                    <i class="fas fa-flag-checkered" style="color: #FF9800;"></i>
                    <span>${tracking.destinations?.[0]?.address || 'Destination'}</span>
                </div>
                
                <div class="tracking-time">
                    <span><i class="fas fa-clock"></i> ${formatTimeFromNow(tracking.createdAt)}</span>
                    <span><i class="fas fa-road"></i> ${tracking.distance ? tracking.distance.toFixed(1) + 'km' : 'N/A'}</span>
                </div>
                
                <div class="tracking-actions">
                    <button class="track-btn-small" onclick="trackDriver('${tracking.driverId || tracking._id}')">
                        <i class="fas fa-map-marker-alt"></i> Track Again
                    </button>
                    <button class="track-btn-small" onclick="viewTrackingDetails('${tracking._id}')">
                        <i class="fas fa-eye"></i> Details
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function getSampleTrackings() {
    return [
        {
            _id: '1',
            tripId: 'TRIP001',
            driverId: 'DRV001',
            driver: { name: 'John Driver' },
            status: 'delivered',
            pickup: { address: 'Johannesburg CBD' },
            destinations: [{ address: 'Sandton City Mall' }],
            distance: 12.5,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
        },
        {
            _id: '2',
            tripId: 'TRIP002',
            driverId: 'DRV002',
            driver: { name: 'Sarah Rider' },
            status: 'in-progress',
            pickup: { address: 'Rosebank Mall' },
            destinations: [{ address: 'Fourways Mall' }],
            distance: 8.2,
            createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
        },
        {
            _id: '3',
            tripId: 'TRIP003',
            driverId: 'DRV003',
            driver: { name: 'Mike Courier' },
            status: 'pending',
            pickup: { address: 'Pretoria CBD' },
            destinations: [{ address: 'Midrand' }],
            distance: 15.8,
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
        },
        {
            _id: '4',
            tripId: 'TRIP004',
            driverId: 'DRV004',
            driver: { name: 'Lisa Express' },
            status: 'delivered',
            pickup: { address: 'Morningside' },
            destinations: [{ address: 'Randburg' }],
            distance: 6.3,
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
        },
        {
            _id: '5',
            tripId: 'TRIP005',
            driverId: 'DRV005',
            driver: { name: 'Tom Swift' },
            status: 'cancelled',
            pickup: { address: 'Soweto' },
            destinations: [{ address: 'Roodepoort' }],
            distance: 18.9,
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
        },
        {
            _id: '6',
            tripId: 'TRIP006',
            driverId: 'DRV006',
            driver: { name: 'Anna Fast' },
            status: 'delivered',
            pickup: { address: 'Bryanston' },
            destinations: [{ address: 'Parkhurst' }],
            distance: 4.7,
            createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // 5 hours ago
        }
    ];
}

function formatTimeFromNow(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Helper functions for buttons
function viewTrackingDetails(trackingId) {
    console.log('Viewing tracking details:', trackingId);
    showNotification('Loading tracking details...', 'info');
    // You can implement a modal or redirect here
}

function initAdminPage() {
  // Initialize admin dashboard
  AppState.mapManager = new MapManager('adminMap', {
    center: APP_CONFIG.MAP_CONFIG.defaultCenter,
    zoom: 12
  });
  AppState.mapManager.initialize();
  
  // Load drivers
  loadDrivers();
  
  // Load deliveries
  loadDeliveries();
  
  // Setup admin-specific event listeners
  setupAdminEventListeners();
}

function initDriverPage() {
  // Initialize driver dashboard
  AppState.mapManager = new MapManager('driverMap', {
    center: APP_CONFIG.MAP_CONFIG.defaultCenter,
    zoom: 14
  });
  AppState.mapManager.initialize();
  
  // Add driver's current location marker
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      AppState.mapManager.centerMap([latitude, longitude]);
      
      AppState.mapManager.addMarker('current', [latitude, longitude], {
        icon: AppState.mapManager.getDriverIcon('online'),
        popup: 'Your Location'
      });
    });
  }
  
  // Setup driver event listeners
  setupDriverEventListeners();
  
  // Load driver's current assignments
  loadDriverAssignments();
}

function initCustomerPage() {
  // Initialize customer interface
  AppState.mapManager = new MapManager('customerMap', {
    center: APP_CONFIG.MAP_CONFIG.defaultCenter,
    zoom: 13
  });
  AppState.mapManager.initialize();
  
  // Setup customer event listeners
  setupCustomerEventListeners();
  
  // Load customer's delivery history
  if (AppState.user) {
    loadCustomerHistory();
  }
}

async function trackSpecificDriver(driverId) {
  try {
    console.log('Tracking specific driver:', driverId);
    
    // Initialize map if not already done
    if (!AppState.mapManager) {
      AppState.mapManager = new MapManager('trackingMap', {
        center: APP_CONFIG.MAP_CONFIG.defaultCenter,
        zoom: 14,
        scrollWheelZoom: false
      });
      AppState.mapManager.initialize();
    }
    
    // Get driver info
    const driver = await API.request(`/drivers/${driverId}`);
    
    // Update tracking UI
    updateTrackingUI(driver);
    
    // Add driver marker if location exists
    if (driver.currentLocation) {
      AppState.mapManager.addMarker(
        `driver_${driverId}`,
        [driver.currentLocation.lat, driver.currentLocation.lng],
        {
          icon: AppState.mapManager.getDriverIcon(driver.status),
          popup: `<strong>${driver.name}</strong><br>Status: ${driver.status}<br>Vehicle: ${driver.vehicle?.model || 'N/A'}`
        }
      );
      
      // Center map on driver
      AppState.mapManager.centerMap([driver.currentLocation.lat, driver.currentLocation.lng]);
    }
    
    // Listen for driver location updates via WebSocket
    if (AppState.socket) {
      AppState.socket.emit('track_driver', { driverId });
      
      // Also listen for updates
      AppState.socket.on('driver_location', (data) => {
        if (data.driverId === driverId) {
          // Update marker
          AppState.mapManager.updateMarker(
            `driver_${driverId}`,
            [data.location.lat, data.location.lng]
          );
          
          // Update UI
          updateDriverLocationUI(data);
        }
      });
    }
    
  } catch (error) {
    console.error('Failed to track driver:', error);
    showNotification('Failed to load driver tracking', 'error');
  }
}

function updateTrackingUI(driver) {
  const trackingContainer = document.getElementById('trackingInfo');
  if (!trackingContainer) return;
  
  trackingContainer.innerHTML = `
    <div class="tracking-card">
      <h3>Tracking: ${driver.name}</h3>
      <div class="tracking-details">
        <p><strong>Status:</strong> 
          <span class="status-badge badge-${driver.status}">${driver.status}</span>
        </p>
        <p><strong>Vehicle:</strong> ${driver.vehicle?.model || 'Not specified'}</p>
        <p><strong>Rating:</strong> ⭐ ${driver.rating?.toFixed(1) || '5.0'}</p>
        <p><strong>Phone:</strong> ${driver.phone || 'N/A'}</p>
        <p><strong>Location:</strong> ${driver.currentLocation?.address || 'Unknown'}</p>
      </div>
      <div class="driver-contact">
        <button class="btn btn-primary" onclick="contactDriver('${driver._id}')">
          <i class="fas fa-phone"></i> Call Driver
        </button>
        <button class="btn btn-secondary" onclick="messageDriver('${driver._id}')">
          <i class="fas fa-comment"></i> Message
        </button>
      </div>
    </div>
  `;
}

function updateDriverLocationUI(data) {
  // Update location in tracking UI if elements exist
  const locationElement = document.querySelector('.tracking-details p:nth-child(5)');
  if (locationElement) {
    locationElement.innerHTML = `<strong>Location:</strong> ${data.location.address || 'Updating...'}`;
  }
}

function initTrackingPage() {
  console.log('Initializing tracking page...');
  
  // Get driver ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const driverId = urlParams.get('driverId');
  
  if (driverId) {
    // Load and track specific driver
    trackSpecificDriver(driverId);
  } else {
    // Initialize empty map
    AppState.mapManager = new MapManager('trackingMap', {
      center: APP_CONFIG.MAP_CONFIG.defaultCenter,
      zoom: 14,
      scrollWheelZoom: false
    });
    AppState.mapManager.initialize();
    
    showNotification('No driver selected for tracking', 'warning');
  }
}

async function trackSpecificDriver(driverId) {
  try {
    // Initialize map
    AppState.mapManager = new MapManager('trackingMap', {
      center: APP_CONFIG.MAP_CONFIG.defaultCenter,
      zoom: 14,
      scrollWheelZoom: false
    });
    AppState.mapManager.initialize();
    
    // Get driver info
    const driver = await API.request(`/drivers/${driverId}`);
    
    // Update UI
    document.getElementById('trackingHeader').innerHTML = `
      <h2>Tracking Driver: ${driver.name}</h2>
      <p>Vehicle: ${driver.vehicle?.model || 'Not specified'}</p>
      <p>Status: <span class="status-${driver.status}">${driver.status}</span></p>
    `;
    
    // Add driver marker if location exists
    if (driver.currentLocation) {
      AppState.mapManager.addMarker(`driver_${driverId}`, 
        [driver.currentLocation.lat, driver.currentLocation.lng], {
          icon: AppState.mapManager.getDriverIcon(driver.status),
          popup: `<strong>${driver.name}</strong><br>Status: ${driver.status}<br>Vehicle: ${driver.vehicle?.model || 'N/A'}`
        }
      );
      
      // Center map on driver
      AppState.mapManager.centerMap([driver.currentLocation.lat, driver.currentLocation.lng]);
    }
    
    // Listen for driver location updates via WebSocket
    if (AppState.socket) {
      AppState.socket.emit('track_driver', { driverId });
    }
    
  } catch (error) {
    console.error('Failed to track driver:', error);
    showNotification('Failed to load driver tracking', 'error');
  }
}

// ===== EVENT LISTENER SETUP =====
function setupEventListeners() {
  // Modal close buttons
  document.querySelectorAll('.close-modal').forEach(button => {
    button.addEventListener('click', function() {
      const modal = this.closest('.modal');
      if (modal) {
        hideModal(modal.id);
      }
    });
  });
  
  // Close modal when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        hideModal(this.id);
      }
    });
  });
  
  // Install PWA button
  const installBtn = document.querySelector('.install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', installPWA);
  }
  
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Registration form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
  
  // Logout button
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

function setupAdminEventListeners() {
  // Add driver form
  const addDriverForm = document.getElementById('addDriverForm');
  if (addDriverForm) {
    addDriverForm.addEventListener('submit', handleAddDriver);
  }
  
  // Refresh drivers button
  const refreshBtn = document.getElementById('refreshDrivers');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadDrivers);
  }
  
  // Filter drivers by status
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      loadDrivers(e.target.value);
    });
  }
}

function setupDriverEventListeners() {
  // Status toggle buttons
  const statusButtons = document.querySelectorAll('.status-btn');
  statusButtons.forEach(button => {
    button.addEventListener('click', function() {
      const status = this.dataset.status;
      updateDriverStatus(status);
    });
  });
  
  // Start trip button
  const startTripBtn = document.getElementById('startTripBtn');
  if (startTripBtn) {
    startTripBtn.addEventListener('click', startTrip);
  }
  
  // Complete delivery button
  const completeDeliveryBtn = document.getElementById('completeDeliveryBtn');
  if (completeDeliveryBtn) {
    completeDeliveryBtn.addEventListener('click', completeDelivery);
  }
  
  // Location sharing toggle
  const locationToggle = document.getElementById('locationToggle');
  if (locationToggle) {
    locationToggle.addEventListener('change', toggleLocationSharing);
  }
}

function setupCustomerEventListeners() {
  // New delivery form
  const newDeliveryForm = document.getElementById('newDeliveryForm');
  if (newDeliveryForm) {
    newDeliveryForm.addEventListener('submit', handleNewDeliveryForm);
  }
  
  // Rate driver form
  const rateForm = document.getElementById('rateForm');
  if (rateForm) {
    rateForm.addEventListener('submit', handleRateDriver);
  }
  
  // Address autocomplete
  const addressInputs = document.querySelectorAll('.address-input');
  addressInputs.forEach(input => {
    input.addEventListener('input', handleAddressInput);
  });
}

// ===== FORM HANDLERS =====
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    const response = await API.login(email, password);
    
    // Save token and user data
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    AppState.token = response.token;
    AppState.user = response.user;
    
    showNotification('Login successful!', 'success');
    
    // Redirect based on user type
    setTimeout(() => {
      window.location.href = `${response.user.userType}.html`;
    }, 1000);
    
  } catch (error) {
    showNotification('Login failed: ' + error.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const userData = Object.fromEntries(formData);
  
  try {
    const response = await API.register(userData);
    showNotification('Registration successful!', 'success');
    
    // Auto login after registration
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    AppState.token = response.token;
    AppState.user = response.user;
    
    setTimeout(() => {
      window.location.href = `${response.user.userType}.html`;
    }, 1500);
    
  } catch (error) {
    showNotification('Registration failed: ' + error.message, 'error');
  }
}

async function handleAddDriver(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const driverData = Object.fromEntries(formData);
  
  try {
    const response = await API.addDriver(driverData);
    showNotification('Driver added successfully!', 'success');
    
    // Close modal and refresh list
    hideModal('addDriverModal');
    loadDrivers();
    
    // Reset form
    e.target.reset();
    
  } catch (error) {
    showNotification('Failed to add driver: ' + error.message, 'error');
  }
}

// ===== HELPER FUNCTIONS =====
async function loadDrivers(status = 'all') {
  try {
    const drivers = await API.getDrivers(status);
    renderDriversList(drivers);
  } catch (error) {
    console.error('Failed to load drivers:', error);
  }
}

function renderDriversList(drivers) {
  const container = document.getElementById('driversList');
  if (!container) return;
  
  container.innerHTML = drivers.map(driver => `
    <div class="driver-card" data-driver-id="${driver._id}">
      <div class="driver-avatar">
        <img src="${driver.profileImage || 'https://via.placeholder.com/70'}" 
             alt="${driver.name}" class="driver-img">
        <div class="driver-status status-${driver.status}"></div>
      </div>
      <div class="driver-details">
        <h4>${driver.name}</h4>
        <div class="driver-meta">
          <span class="driver-rating">
            <i class="fas fa-star"></i> ${driver.rating?.toFixed(1) || '5.0'}
          </span>
          <span class="driver-vehicle">
            <i class="fas fa-motorcycle"></i> ${driver.vehicle?.model || 'N/A'}
          </span>
          <span class="driver-status-text">${driver.status}</span>
        </div>
        <p>📍 ${driver.currentLocation?.address || 'Location unknown'}</p>
        <p>📞 ${driver.phone || 'No phone'}</p>
      </div>
      <div class="driver-actions">
        <button class="action-btn track-btn" onclick="trackDriver('${driver._id}')">
          <i class="fas fa-map-marker-alt"></i> Track Live
        </button>
        <button class="action-btn message-btn" onclick="messageDriver('${driver._id}')">
          <i class="fas fa-comment"></i> Message
        </button>
      </div>
    </div>
  `).join('');
}

function updateDriverInList(driverId, location) {
  const driverCard = document.querySelector(`[data-driver-id="${driverId}"]`);
  if (driverCard) {
    const locationElement = driverCard.querySelector('p');
    if (locationElement && location.address) {
      locationElement.textContent = `📍 ${location.address}`;
    }
  }
}

async function loadDeliveries() {
  try {
    const response = await API.request('/trips?status=active');
    renderDeliveriesList(response.trips);
  } catch (error) {
    console.error('Failed to load deliveries:', error);
  }
}

function renderDeliveriesList(deliveries) {
  const container = document.getElementById('deliveriesList');
  if (!container) return;
  
  container.innerHTML = deliveries.map(delivery => `
    <div class="trip-item" data-delivery-id="${delivery._id}">
      <div class="trip-info">
        <div class="trip-icon">
          <i class="fas fa-box"></i>
        </div>
        <div>
          <h4>${delivery.pickup.address} → ${delivery.destinations[0]?.address || 'Multiple stops'}</h4>
          <p><i class="fas fa-clock"></i> ${new Date(delivery.requestedAt).toLocaleTimeString()}</p>
          <span class="status-badge badge-${delivery.status}">${delivery.status}</span>
        </div>
      </div>
      <div class="trip-price">R${delivery.fare?.total?.toFixed(2) || '0.00'}</div>
    </div>
  `).join('');
}

// ===== PWA INSTALLATION =====

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show install button
  const installBtn = document.querySelector('.install-btn');
  if (installBtn) {
    installBtn.style.display = 'flex';
  }
});

async function installPWA() {
  if (!deferredPrompt) {
    showNotification('PWA installation not available', 'warning');
    return;
  }
  
  deferredPrompt.prompt();
  
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    showNotification('App installed successfully!', 'success');
  }
  
  deferredPrompt = null;
}

// ===== LOCATION TRACKING =====
function startLocationTracking() {
  if (!navigator.geolocation) {
    showNotification('Geolocation not supported by your browser', 'error');
    return;
  }
  
  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  };
  
  AppState.watchId = navigator.geolocation.watchPosition(
    handlePositionUpdate,
    handlePositionError,
    options
  );
}

function handlePositionUpdate(position) {
  const { latitude, longitude, speed, heading } = position.coords;
  
  // Update local state
  AppState.currentLocation = { lat: latitude, lng: longitude };
  
  // Update map marker
  if (AppState.mapManager) {
    AppState.mapManager.updateMarker('current', [latitude, longitude]);
  }
  
  // Send to server if driver is online
  if (AppState.user?.userType === APP_CONFIG.USER_TYPES.DRIVER && AppState.socket) {
    AppState.socket.emit('location_update', {
      location: { lat: latitude, lng: longitude },
      speed: speed || 0,
      heading: heading || 0
    });
    
    // Also update via API
    API.updateLocation({
      lat: latitude,
      lng: longitude,
      speed,
      heading
    });
  }
}

function handlePositionError(error) {
  console.error('Geolocation error:', error);
  
  let message = 'Unable to get your location';
  switch(error.code) {
    case error.PERMISSION_DENIED:
      message = 'Location permission denied. Please enable in browser settings.';
      break;
    case error.POSITION_UNAVAILABLE:
      message = 'Location unavailable. Check your GPS signal.';
      break;
    case error.TIMEOUT:
      message = 'Location request timeout.';
      break;
  }
  
  showNotification(message, 'error');
}

function stopLocationTracking() {
  if (AppState.watchId) {
    navigator.geolocation.clearWatch(AppState.watchId);
    AppState.watchId = null;
  }
}

// ===== UTILITY FUNCTIONS =====
function logout() {
  // Clear local storage
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Clear app state
  AppState.token = null;
  AppState.user = null;
  
  // Disconnect WebSocket
  if (AppState.socket) {
    AppState.socket.disconnect();
    AppState.socket = null;
  }
  
  // Stop location tracking
  stopLocationTracking();
  
  // Redirect to home
  showNotification('Logged out successfully', 'success');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(amount);
}

function formatDistance(km) {
  if (km < 1) {
    return `${(km * 1000).toFixed(0)}m`;
  }
  return `${km.toFixed(1)}km`;
}

function formatTime(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
}

function redirectTo(url) {
  window.location.href = url;
}

// ===== EXPORT FUNCTIONS TO GLOBAL SCOPE =====
// Export functions
window.redirectTo = redirectTo;
window.installPWA = installPWA;
window.showModal = showModal;
window.hideModal = hideModal;
window.logout = logout;
window.trackDriver = trackDriver;

// That's it - no more duplicate initialization!

window.messageDriver = (driverId) => {
  showModal('messageModal');
  document.getElementById('messageDriverId').value = driverId;
};

// ===== AUTHENTICATION CONTINUED =====
async function handleLoginForm(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await API.login(email, password);
        
        // Store authentication data
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        AppState.token = response.token;
        AppState.user = response.user;
        
        showNotification('Login successful!', 'success');
        
        // Redirect based on user type
        setTimeout(() => {
            window.location.href = `${response.user.userType}.html`;
        }, 1000);
        
    } catch (error) {
        showNotification('Login failed: ' + error.message, 'error');
    }
}

async function handleRegisterForm(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = Object.fromEntries(formData);
    
    // Add default values based on user type
    userData.userType = document.querySelector('input[name="userType"]:checked').value;
    
    if (userData.userType === 'driver') {
        userData.driverData = {
            vehicleType: document.getElementById('vehicleType').value,
            licenseNumber: document.getElementById('licenseNumber').value
        };
    }
    
    try {
        const response = await API.register(userData);
        
        showNotification('Registration successful!', 'success');
        
        // Auto login after registration
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        AppState.token = response.token;
        AppState.user = response.user;
        
        setTimeout(() => {
            window.location.href = `${response.user.userType}.html`;
        }, 1500);
        
    } catch (error) {
        showNotification('Registration failed: ' + error.message, 'error');
    }
}

function logout() {
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Clear app state
    AppState.token = null;
    AppState.user = null;
    
    // Disconnect WebSocket
    if (AppState.socket) {
        AppState.socket.disconnect();
        AppState.socket = null;
    }
    
    // Stop location tracking
    if (AppState.watchId) {
        navigator.geolocation.clearWatch(AppState.watchId);
        AppState.watchId = null;
    }
    
    // Redirect to home
    showNotification('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// ===== DRIVER FUNCTIONS =====
class DriverManager {
    constructor() {
        this.currentTrip = null;
        this.locationWatcher = null;
        this.isSharingLocation = false;
    }
    
    async goOnline() {
        try {
            const response = await API.request('/drivers/status', {
                method: 'PUT',
                body: JSON.stringify({ status: 'online' })
            });
            
            // Start sharing location
            this.startSharingLocation();
            
            // Update UI
            document.getElementById('driverStatus').textContent = 'Online';
            document.getElementById('driverStatus').className = 'status-online';
            
            showNotification('You are now online and visible to customers', 'success');
            
            return response;
            
        } catch (error) {
            showNotification('Failed to go online: ' + error.message, 'error');
            throw error;
        }
    }
    
    async goOffline() {
        try {
            const response = await API.request('/drivers/status', {
                method: 'PUT',
                body: JSON.stringify({ status: 'offline' })
            });
            
            // Stop sharing location
            this.stopSharingLocation();
            
            // Update UI
            document.getElementById('driverStatus').textContent = 'Offline';
            document.getElementById('driverStatus').className = 'status-offline';
            
            showNotification('You are now offline', 'info');
            
            return response;
            
        } catch (error) {
            showNotification('Failed to go offline: ' + error.message, 'error');
            throw error;
        }
    }
    
    startSharingLocation() {
        if (this.isSharingLocation) return;
        
        if (!navigator.geolocation) {
            showNotification('Geolocation not supported by your browser', 'error');
            return;
        }
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };
        
        this.locationWatcher = navigator.geolocation.watchPosition(
            (position) => this.handleLocationUpdate(position),
            (error) => this.handleLocationError(error),
            options
        );
        
        this.isSharingLocation = true;
        console.log('📍 Location sharing started');
    }
    
    stopSharingLocation() {
        if (this.locationWatcher) {
            navigator.geolocation.clearWatch(this.locationWatcher);
            this.locationWatcher = null;
        }
        
        this.isSharingLocation = false;
        console.log('📍 Location sharing stopped');
    }
    
    async handleLocationUpdate(position) {
        const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || 0,
            heading: position.coords.heading,
            timestamp: new Date().toISOString()
        };
        
        // Update map marker if exists
        if (AppState.mapManager) {
            AppState.mapManager.updateMarker('driver', [location.lat, location.lng]);
        }
        
        // Send to server via WebSocket
        if (AppState.socket) {
            AppState.socket.emit('location_update', {
                location: location,
                speed: location.speed,
                heading: location.heading
            });
        }
        
        // Also update via HTTP API
        try {
            await API.updateLocation(location);
        } catch (error) {
            console.error('Failed to update location via API:', error);
        }
    }
    
    handleLocationError(error) {
        let message = 'Unable to get your location';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied. Please enable in browser settings.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location unavailable. Check your GPS signal.';
                break;
            case error.TIMEOUT:
                message = 'Location request timeout.';
                break;
        }
        
        showNotification('GPS Error: ' + message, 'error');
        
        // Stop sharing location on error
        this.stopSharingLocation();
    }
    
    async acceptDelivery(deliveryId) {
        try {
            const response = await API.request(`/trips/${deliveryId}/accept`, {
                method: 'PUT'
            });
            
            this.currentTrip = response.trip;
            showNotification('Delivery accepted!', 'success');
            
            // Update UI
            this.updateCurrentTripUI(response.trip);
            
            return response;
            
        } catch (error) {
            showNotification('Failed to accept delivery: ' + error.message, 'error');
            throw error;
        }
    }
    
    async startDelivery(deliveryId) {
        try {
            const response = await API.request(`/trips/${deliveryId}/start`, {
                method: 'PUT'
            });
            
            showNotification('Delivery started!', 'success');
            
            // Update trip status
            this.currentTrip.status = 'in_progress';
            this.updateCurrentTripUI(this.currentTrip);
            
            return response;
            
        } catch (error) {
            showNotification('Failed to start delivery: ' + error.message, 'error');
            throw error;
        }
    }
    
    async completeDelivery(deliveryId, proofData = {}) {
        try {
            const response = await API.request(`/trips/${deliveryId}/complete`, {
                method: 'PUT',
                body: JSON.stringify(proofData)
            });
            
            showNotification('Delivery completed!', 'success');
            
            // Clear current trip
            this.currentTrip = null;
            this.clearCurrentTripUI();
            
            // Update earnings
            this.updateEarnings(response.earnings);
            
            return response;
            
        } catch (error) {
            showNotification('Failed to complete delivery: ' + error.message, 'error');
            throw error;
        }
    }
    
    updateCurrentTripUI(trip) {
        const tripContainer = document.getElementById('currentTrip');
        if (!tripContainer) return;
        
        tripContainer.innerHTML = `
            <div class="current-trip-card">
                <h3>Current Delivery</h3>
                <div class="trip-details">
                    <p><strong>Trip ID:</strong> ${trip.tripId}</p>
                    <p><strong>Pickup:</strong> ${trip.pickup.address}</p>
                    <p><strong>Delivery:</strong> ${trip.destinations[0]?.address || 'Multiple stops'}</p>
                    <p><strong>Distance:</strong> ${trip.distance ? trip.distance.toFixed(1) + 'km' : 'Calculating...'}</p>
                    <p><strong>Fare:</strong> R${trip.fare?.total?.toFixed(2) || '0.00'}</p>
                </div>
                <div class="trip-actions">
                    ${trip.status === 'accepted' ? `
                        <button class="btn btn-primary" onclick="driverManager.startDelivery('${trip._id}')">
                            <i class="fas fa-play"></i> Start Trip
                        </button>
                    ` : ''}
                    ${trip.status === 'in_progress' ? `
                        <button class="btn btn-success" onclick="showDeliveryProofModal('${trip._id}')">
                            <i class="fas fa-check"></i> Complete Delivery
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        tripContainer.style.display = 'block';
    }
    
    clearCurrentTripUI() {
        const tripContainer = document.getElementById('currentTrip');
        if (tripContainer) {
            tripContainer.innerHTML = '';
            tripContainer.style.display = 'none';
        }
    }
    
    updateEarnings(earnings) {
        const earningsElement = document.getElementById('todayEarnings');
        if (earningsElement) {
            const currentEarnings = parseFloat(earningsElement.textContent) || 0;
            const newEarnings = currentEarnings + (earnings || 0);
            earningsElement.textContent = newEarnings.toFixed(2);
        }
    }
    
    async loadAvailableDeliveries() {
        try {
            const deliveries = await API.request('/trips/available');
            this.renderAvailableDeliveries(deliveries);
            return deliveries;
        } catch (error) {
            console.error('Failed to load deliveries:', error);
            return [];
        }
    }
    
    renderAvailableDeliveries(deliveries) {
        const container = document.getElementById('availableDeliveries');
        if (!container) return;
        
        if (!deliveries || deliveries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box"></i>
                    <p>No deliveries available</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = deliveries.map(delivery => `
            <div class="delivery-card">
                <div class="delivery-header">
                    <h4>Trip #${delivery.tripId.substring(0, 8)}</h4>
                    <span class="delivery-price">R${delivery.fare?.total?.toFixed(2)}</span>
                </div>
                <div class="delivery-details">
                    <p><i class="fas fa-map-marker-alt"></i> ${delivery.pickup.address}</p>
                    <p><i class="fas fa-flag-checkered"></i> ${delivery.destinations[0]?.address}</p>
                    <p><i class="fas fa-road"></i> ${delivery.distance ? delivery.distance.toFixed(1) + 'km' : 'N/A'}</p>
                </div>
                <button class="btn btn-primary" onclick="driverManager.acceptDelivery('${delivery._id}')">
                    <i class="fas fa-check"></i> Accept Delivery
                </button>
            </div>
        `).join('');
    }
}

// Initialize driver manager
const driverManager = new DriverManager();

// ===== CUSTOMER FUNCTIONS =====
class CustomerManager {
    constructor() {
        this.currentDelivery = null;
        this.fareEstimate = null;
    }
    
    async calculateFare(pickup, destination, rate = 10) {
        try {
            // For now, use a simple distance calculation
            // In production, use a routing API
            const distance = this.calculateDistance(
                pickup.coordinates.lat, pickup.coordinates.lng,
                destination.coordinates.lat, destination.coordinates.lng
            );
            
            const fare = distance * rate;
            const minFare = 25;
            const serviceFee = fare * 0.1;
            
            this.fareEstimate = {
                distance: distance.toFixed(1),
                rate: rate,
                baseFare: Math.max(fare, minFare),
                serviceFee: serviceFee,
                total: Math.max(fare, minFare) + serviceFee
            };
            
            return this.fareEstimate;
            
        } catch (error) {
            console.error('Fare calculation error:', error);
            return null;
        }
    }
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    async requestDelivery(deliveryData) {
        try {
            const response = await API.createTrip(deliveryData);
            
            this.currentDelivery = response.trip;
            showNotification('Delivery requested successfully!', 'success');
            
            // Start tracking the delivery
            this.startDeliveryTracking(response.trip._id);
            
            return response;
            
        } catch (error) {
            showNotification('Failed to request delivery: ' + error.message, 'error');
            throw error;
        }
    }
    
    startDeliveryTracking(tripId) {
        // Redirect to tracking page
        window.location.href = `tracking.html?tripId=${tripId}`;
    }
    
    async trackDelivery(tripId) {
        try {
            const trip = await API.request(`/trips/${tripId}`);
            
            // Update tracking UI
            this.updateTrackingUI(trip);
            
            // If driver is assigned, track their location
            if (trip.driverId && AppState.socket) {
                AppState.socket.emit('track_driver', { driverId: trip.driverId });
            }
            
            return trip;
            
        } catch (error) {
            console.error('Failed to track delivery:', error);
            throw error;
        }
    }
    
    updateTrackingUI(trip) {
        const trackingContainer = document.getElementById('trackingInfo');
        if (!trackingContainer) return;
        
        trackingContainer.innerHTML = `
            <div class="tracking-card">
                <h3>Delivery Tracking</h3>
                <div class="tracking-details">
                    <p><strong>Status:</strong> 
                        <span class="status-badge badge-${trip.status}">${trip.status}</span>
                    </p>
                    <p><strong>Driver:</strong> ${trip.driver?.name || 'Not assigned'}</p>
                    <p><strong>Vehicle:</strong> ${trip.driver?.vehicle?.type || 'N/A'}</p>
                    <p><strong>Estimated Time:</strong> ${trip.estimatedDuration || 'Calculating...'} min</p>
                    <p><strong>Fare:</strong> R${trip.fare?.total?.toFixed(2)}</p>
                </div>
                
                ${trip.driver ? `
                    <div class="driver-contact">
                        <button class="btn btn-primary" onclick="contactDriver('${trip.driver._id}')">
                            <i class="fas fa-phone"></i> Call Driver
                        </button>
                        <button class="btn btn-secondary" onclick="messageDriver('${trip.driver._id}')">
                            <i class="fas fa-comment"></i> Message
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    async rateDelivery(tripId, rating, comment = '') {
        try {
            const response = await API.request(`/trips/${tripId}/rate`, {
                method: 'POST',
                body: JSON.stringify({ rating, comment })
            });
            
            showNotification('Thank you for your rating!', 'success');
            return response;
            
        } catch (error) {
            showNotification('Failed to submit rating: ' + error.message, 'error');
            throw error;
        }
    }
}

// Initialize customer manager
const customerManager = new CustomerManager();

// ===== WEB SOCKET EVENT HANDLERS =====
function setupWebSocketHandlers() {
    if (!AppState.socket) return;
    
    // New delivery assignment (for drivers)
    AppState.socket.on('new_delivery', (data) => {
        showNotification(`New delivery available! ${data.pickup} → ${data.destination}`, 'info');
        
        // Update available deliveries list
        if (AppState.user?.userType === 'driver') {
            driverManager.loadAvailableDeliveries();
        }
    });
    
    // Delivery status updates
    AppState.socket.on('delivery_update', (data) => {
        const { tripId, status, driverId } = data;
        
        // Update delivery card if visible
        const deliveryCard = document.querySelector(`[data-trip-id="${tripId}"]`);
        if (deliveryCard) {
            const statusElement = deliveryCard.querySelector('.delivery-status');
            if (statusElement) {
                statusElement.textContent = status;
                statusElement.className = `status-badge badge-${status}`;
            }
        }
        
        // If this is the current delivery being tracked
        if (AppState.currentDeliveryId === tripId) {
            customerManager.updateTrackingUI({ status, driverId });
        }
    });
    
    // Driver location updates (for customers/admin)
    AppState.socket.on('driver_location', (data) => {
        const { driverId, location } = data;
        
        // Update driver marker on map
        if (AppState.mapManager) {
            AppState.mapManager.updateMarker(`driver_${driverId}`, [location.lat, location.lng]);
        }
        
        // Update ETA if tracking this driver
        if (AppState.trackedDriverId === driverId) {
            updateETA(location);
        }
    });
    
    // Chat messages
    AppState.socket.on('chat_message', (data) => {
        const { from, message, timestamp } = data;
        showNotification(`New message from ${from}: ${message}`, 'info');
        
        // Add to chat UI if chat is open
        if (document.getElementById('chatContainer')) {
            addChatMessage(from, message, timestamp, false);
        }
    });
    
    // System notifications
    AppState.socket.on('system_notification', (data) => {
        const { title, message, type } = data;
        showNotification(`${title}: ${message}`, type || 'info');
    });
}

function updateETA(location) {
    // Simple ETA calculation based on distance and average speed
    if (AppState.destination && location) {
        const distance = customerManager.calculateDistance(
            location.lat, location.lng,
            AppState.destination.lat, AppState.destination.lng
        );
        
        const avgSpeed = 30; // km/h average in city
        const etaMinutes = Math.round((distance / avgSpeed) * 60);
        
        const etaElement = document.getElementById('etaValue');
        if (etaElement) {
            etaElement.textContent = `${etaMinutes} min`;
        }
    }
}

// ===== CHAT FUNCTIONS =====
function initChat(userId, userName) {
    AppState.chat = {
        userId: userId,
        userName: userName,
        messages: [],
        isOpen: false
    };
}

function openChat(withUser) {
    AppState.chat.withUser = withUser;
    AppState.chat.isOpen = true;
    
    // Show chat modal
    showChatModal();
    
    // Load chat history
    loadChatHistory(withUser.id);
}

function showChatModal() {
    const modalContent = `
        <div class="chat-modal">
            <div class="chat-header">
                <h3>Chat with ${AppState.chat.withUser.name}</h3>
                <button class="close-chat" onclick="closeChat()">&times;</button>
            </div>
            <div class="chat-messages" id="chatMessages">
                <!-- Messages will be added here -->
            </div>
            <div class="chat-input">
                <input type="text" id="chatMessageInput" placeholder="Type your message...">
                <button onclick="sendChatMessage()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;
    
    // Create or update chat container
    let chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) {
        chatContainer = document.createElement('div');
        chatContainer.id = 'chatContainer';
        chatContainer.className = 'modal active';
        document.body.appendChild(chatContainer);
    }
    
    chatContainer.innerHTML = modalContent;
    
    // Focus on input
    setTimeout(() => {
        document.getElementById('chatMessageInput').focus();
    }, 100);
}

function closeChat() {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.remove();
    }
    AppState.chat.isOpen = false;
}

async function loadChatHistory(withUserId) {
    try {
        const messages = await API.request(`/chat/history/${withUserId}`);
        
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = messages.map(msg => `
                <div class="chat-message ${msg.from === AppState.chat.userId ? 'sent' : 'received'}">
                    <div class="message-content">${msg.message}</div>
                    <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `).join('');
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        AppState.chat.messages = messages;
        
    } catch (error) {
        console.error('Failed to load chat history:', error);
    }
}

function addChatMessage(from, message, timestamp, isOwn = false) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOwn ? 'sent' : 'received'}`;
    messageElement.innerHTML = `
        <div class="message-content">${message}</div>
        <div class="message-time">${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Add to local messages array
    AppState.chat.messages.push({
        from,
        message,
        timestamp,
        isOwn
    });
}

function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    
    if (!message || !AppState.chat.withUser) return;
    
    // Add to UI immediately
    addChatMessage(AppState.chat.userId, message, new Date(), true);
    
    // Send via WebSocket
    if (AppState.socket) {
        AppState.socket.emit('chat_message', {
            to: AppState.chat.withUser.id,
            message: message,
            timestamp: new Date().toISOString()
        });
    }
    
    // Also send via API for persistence
    API.request('/chat/send', {
        method: 'POST',
        body: JSON.stringify({
            to: AppState.chat.withUser.id,
            message: message
        })
    }).catch(error => {
        console.error('Failed to send message via API:', error);
    });
    
    // Clear input
    input.value = '';
    input.focus();
}

// ===== NOTIFICATION FUNCTIONS =====
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.permission = null;
    }
    
    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            this.permission = 'granted';
            return true;
        }
        
        if (Notification.permission !== 'denied') {
            this.permission = await Notification.requestPermission();
            return this.permission === 'granted';
        }
        
        return false;
    }
    
    showNotification(title, options = {}) {
        if (!this.permission || this.permission !== 'granted') return;
        
        const notification = new Notification(title, {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            ...options
        });
        
        this.notifications.push(notification);
        
        // Auto close after 5 seconds
        setTimeout(() => {
            notification.close();
        }, 5000);
        
        return notification;
    }
    
    showDeliveryNotification(delivery) {
        this.showNotification('New Delivery Available!', {
            body: `${delivery.pickup.address} → ${delivery.destinations[0]?.address}`,
            tag: 'delivery',
            data: { deliveryId: delivery._id },
            requireInteraction: true
        });
    }
    
    showStatusNotification(trip, status) {
        const statusMessages = {
            'accepted': `Driver accepted your delivery`,
            'in_progress': `Driver is on the way to pickup`,
            'completed': `Your delivery has been completed`
        };
        
        this.showNotification('Delivery Update', {
            body: statusMessages[status] || `Delivery status: ${status}`,
            tag: 'delivery_update',
            data: { tripId: trip._id }
        });
    }
}

// Initialize notification manager
const notificationManager = new NotificationManager();

// ===== PAYMENT FUNCTIONS =====
class PaymentManager {
    constructor() {
        this.paymentMethods = [];
    }
    
    async initialize() {
        // Load saved payment methods
        if (AppState.user) {
            await this.loadPaymentMethods();
        }
    }
    
    async loadPaymentMethods() {
        try {
            const methods = await API.request('/payment/methods');
            this.paymentMethods = methods;
            return methods;
        } catch (error) {
            console.error('Failed to load payment methods:', error);
            return [];
        }
    }
    
    async addPaymentMethod(methodData) {
        try {
            const method = await API.request('/payment/methods', {
                method: 'POST',
                body: JSON.stringify(methodData)
            });
            
            this.paymentMethods.push(method);
            showNotification('Payment method added', 'success');
            
            return method;
            
        } catch (error) {
            showNotification('Failed to add payment method: ' + error.message, 'error');
            throw error;
        }
    }
    
    async processPayment(tripId, paymentMethodId) {
        try {
            const payment = await API.request('/payment/process', {
                method: 'POST',
                body: JSON.stringify({
                    tripId: tripId,
                    paymentMethodId: paymentMethodId
                })
            });
            
            showNotification('Payment successful!', 'success');
            return payment;
            
        } catch (error) {
            showNotification('Payment failed: ' + error.message, 'error');
            throw error;
        }
    }
    
    getPaymentMethods() {
        return this.paymentMethods;
    }
}

// Initialize payment manager
const paymentManager = new PaymentManager();

// ===== OFFLINE SUPPORT =====
class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.pendingRequests = [];
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }
    
    handleOnline() {
        this.isOnline = true;
        showNotification('You are back online', 'success');
        
        // Process pending requests
        this.processPendingRequests();
    }
    
    handleOffline() {
        this.isOnline = false;
        showNotification('You are offline. Some features may be limited.', 'warning');
    }
    
    addPendingRequest(request) {
        this.pendingRequests.push(request);
        localStorage.setItem('pendingRequests', JSON.stringify(this.pendingRequests));
    }
    
    async processPendingRequests() {
        const pending = [...this.pendingRequests];
        this.pendingRequests = [];
        
        for (const request of pending) {
            try {
                await API.request(request.endpoint, request.options);
                console.log('Processed pending request:', request);
            } catch (error) {
                // If still failing, add back to pending
                this.pendingRequests.push(request);
            }
        }
        
        localStorage.setItem('pendingRequests', JSON.stringify(this.pendingRequests));
    }
    
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    }
    
    loadFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return null;
        }
    }
}

// Initialize offline manager
const offlineManager = new OfflineManager();

// ===== UTILITY FUNCTIONS =====
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR'
    }).format(amount);
}

function formatDistance(km) {
    if (km < 1) {
        return `${(km * 1000).toFixed(0)}m`;
    }
    return `${km.toFixed(1)}km`;
}

function formatTime(minutes) {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-ZA', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ===== GEOCODING FUNCTIONS =====
class Geocoder {
    constructor() {
        this.cache = new Map();
    }
    
    async geocode(address) {
        // Check cache first
        if (this.cache.has(address)) {
            return this.cache.get(address);
        }
        
        try {
            // Using OpenStreetMap Nominatim API (free)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
                {
                    headers: {
                        'Accept-Language': 'en',
                        'User-Agent': 'SwiftRide Delivery App'
                    }
                }
            );
            
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = {
                    address: data[0].display_name,
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
                
                // Cache result
                this.cache.set(address, result);
                
                return result;
            }
            
            throw new Error('Address not found');
            
        } catch (error) {
            console.error('Geocoding error:', error);
            throw error;
        }
    }
    
    async reverseGeocode(lat, lng) {
        const cacheKey = `${lat},${lng}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
                {
                    headers: {
                        'Accept-Language': 'en',
                        'User-Agent': 'SwiftRide Delivery App'
                    }
                }
            );
            
            const data = await response.json();
            
            if (data && data.display_name) {
                const result = {
                    address: data.display_name,
                    lat: lat,
                    lng: lng
                };
                
                // Cache result
                this.cache.set(cacheKey, result);
                
                return result;
            }
            
            throw new Error('Reverse geocoding failed');
            
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            throw error;
        }
    }
}

// Initialize geocoder
const geocoder = new Geocoder();

// ===== EXPORT FUNCTIONS TO GLOBAL SCOPE =====
window.AppState = AppState;
window.API = API;
window.driverManager = driverManager;
window.customerManager = customerManager;
window.notificationManager = notificationManager;
window.paymentManager = paymentManager;
window.offlineManager = offlineManager;
window.geocoder = geocoder;

window.handleLoginForm = handleLoginForm;
window.handleRegisterForm = handleRegisterForm;
window.logout = logout;
window.showNotification = showNotification;
window.showModal = showModal;
window.hideModal = hideModal;

window.installPWA = installPWA;
window.openChat = openChat;
window.closeChat = closeChat;
window.sendChatMessage = sendChatMessage;

// ===== SIMPLE TRACK DRIVER FUNCTION =====
// ===== TRACK BUTTON FIX =====
window.trackDriver = (driverId) => {
    console.log('🚨 TRACK BUTTON CLICKED! Driver ID:', driverId);
    
    // Save driver ID
    localStorage.setItem('trackDriverId', driverId);
    
    // Show debug alert
    alert(`Tracking driver: ${driverId}\nOpening tracking page...`);
    
    // Open tracking page
    window.location.href = `tracking.html?driver=${driverId}`;
    
    // Prevent any other actions
    return false;
};

window.messageDriver = (driverId) => {
  // Get driver info and open chat
  API.request(`/drivers/${driverId}`).then(driver => {
    openChat({ id: driverId, name: driver.name });
  }).catch(error => {
    showNotification('Failed to start chat', 'error');
  });
};

window.contactDriver = (driverId) => {
  // Implementation for contacting driver
  showNotification('Calling driver...', 'info');
};

window.formatCurrency = formatCurrency;
window.formatDistance = formatDistance;
window.formatTime = formatTime;
window.formatDate = formatDate;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 SwiftRide App Initialized');
    
    // Hide loading screen
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }, 1000);
    
    // Check authentication
    checkAuth().then(() => {
        // Initialize notification permission
        if (AppState.user) {
            notificationManager.requestPermission();
            
            // Initialize payment manager
            paymentManager.initialize();
        }
        
        // Initialize page-specific features
        initializePageFeatures();
        
        // Setup WebSocket handlers
        setupWebSocketHandlers();
        
        // Setup event listeners
        setupEventListeners();
    }).catch(error => {
        console.error('Initialization error:', error);
    });
});

// Handle beforeunload
window.addEventListener('beforeunload', () => {
    if (AppState.socket) {
        AppState.socket.disconnect();
    }
    
    if (driverManager.locationWatcher) {
        driverManager.stopSharingLocation();
    }
});

// Handle online/offline status
window.addEventListener('online', () => {
    showNotification('You are back online', 'success');
    
    // Reconnect WebSocket
    if (AppState.user && !AppState.socket) {
        connectWebSocket();
    }
});

window.addEventListener('offline', () => {
    showNotification('You are offline. Some features may be limited.', 'warning');
});

// Service Worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// PWA installation

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button if hidden
    const installBtn = document.querySelector('.install-btn');
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
});

window.installPWA = async () => {
    if (!deferredPrompt) {
        showNotification('PWA installation not available', 'warning');
        return;
    }
    
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        showNotification('App installed successfully!', 'success');
    } else {
        showNotification('App installation cancelled', 'info');
    }
    
    deferredPrompt = null;
};

// Export the main initialization function
window.initSwiftRideApp = () => {
  console.log('SwiftRide App starting...')
  
  // Check if user is authenticated
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (token && user) {
    try {
      AppState.token = token;
      AppState.user = JSON.parse(user);
      
      // Connect to WebSocket
      connectWebSocket();
      
      // Update UI
      updateUIForLoggedInUser();
      
    } catch (error) {
      console.error('Failed to restore session:', error);
      logout();
    }
  }
};

// Auto-initialize if this is the main app.js
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initSwiftRideApp);
} else {
  window.initSwiftRideApp();
}

// ===== FIX TRACK BUTTON =====
// Ensure trackDriver is available globally and works
document.addEventListener('click', function(e) {
  // Check if clicked element or its parent has onclick with trackDriver
  let element = e.target;
  
  // Traverse up to find the button with trackDriver
  while (element && element !== document.body) {
    const onclick = element.getAttribute('onclick');
    if (onclick && onclick.includes('trackDriver')) {
      e.preventDefault();
      e.stopPropagation();
      
      // Extract driverId from onclick attribute
      const match = onclick.match(/trackDriver\('([^']+)'\)/);
      if (match && match[1]) {
        const driverId = match[1];
        console.log('Tracking driver:', driverId);
        
        // Store driver ID for tracking
        localStorage.setItem('trackingDriverId', driverId);
        
        // Redirect to tracking page
        window.location.href = `tracking.html?driverId=${driverId}`;
      }
      return false;
    }
    element = element.parentElement;
  }
}, true);

// ===== SERVICE WORKER REGISTRATION =====
// This MUST be added to enable PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('✅ Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

// ===== DEBUG MODE =====
console.log('=== DEBUG MODE ENABLED ===');
console.log('Current page:', document.body.dataset.page);
console.log('AppState.user:', AppState.user);
console.log('LocalStorage user:', localStorage.getItem('user'));
console.log('LocalStorage token:', localStorage.getItem('token'));

// Log all page loads
window.addEventListener('load', () => {
    console.log('📄 Page loaded:', window.location.href);
    console.log('📝 Body data-page:', document.body.dataset.page);
});

// Log all redirects
const originalRedirect = window.redirectTo;
window.redirectTo = function(url) {
    console.log('🔀 REDIRECTING TO:', url);
    console.trace('Redirect stack trace');
    return originalRedirect(url);
};