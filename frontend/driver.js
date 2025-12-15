// ===== DRIVER PAGE SPECIFIC FUNCTIONS =====

// Wait for app.js to load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Driver page loading...');
    
    // Wait for app.js to initialize
    setTimeout(async () => {
        // Check if we have a driver logged in
        if (!AppState.user || AppState.user.userType !== 'driver') {
            console.log('Not logged in as driver, redirecting...');
            showNotification('Please login as driver first', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        // Initialize driver page
        initDriverPage();
    }, 500);
});

function initDriverPage() {
    console.log('Initializing driver page for:', AppState.user?.name);
    
    // Update UI with driver info
    updateDriverUI();
    
    // Initialize map
    initDriverMap();
    
    // Load driver data
    loadDriverData();
    
    // Setup driver event listeners
    setupDriverListeners();
}

function updateDriverUI() {
    const driver = AppState.user;
    if (!driver) return;
    
    // Update display elements
    const nameElements = document.querySelectorAll('.driver-name-display');
    nameElements.forEach(el => {
        if (el) el.textContent = driver.name;
    });
    
    const avatarElements = document.querySelectorAll('.driver-avatar');
    avatarElements.forEach(el => {
        if (el) el.textContent = driver.name.charAt(0);
    });
}

function initDriverMap() {
    const mapElement = document.getElementById('driverMap');
    if (!mapElement) return;
    
    // Use the MapManager from app.js
    if (AppState.mapManager) {
        AppState.mapManager.destroy(); // Clean up old map
    }
    
    AppState.mapManager = new MapManager('driverMap', {
        center: APP_CONFIG.MAP_CONFIG.defaultCenter,
        zoom: 14,
        scrollWheelZoom: false
    });
    
    const map = AppState.mapManager.initialize();
    
    if (map) {
        // Add driver's location marker
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const { latitude, longitude } = position.coords;
                
                AppState.mapManager.addMarker('driver_location', [latitude, longitude], {
                    icon: AppState.mapManager.getDriverIcon('online'),
                    popup: `Your Location<br>${AppState.user?.name || 'Driver'}`
                });
                
                AppState.mapManager.centerMap([latitude, longitude]);
            });
        }
    }
}

async function loadDriverData() {
    if (!AppState.user) return;
    
    try {
        // Use the existing API from app.js
        const driverData = await API.request(`/drivers/${AppState.user._id}`);
        
        // Update earnings display
        updateEarningsDisplay(driverData);
        
        // Load deliveries
        loadDriverDeliveries();
        
    } catch (error) {
        console.error('Failed to load driver data:', error);
    }
}

function updateEarningsDisplay(driver) {
    const todayEarnings = document.getElementById('todayEarnings');
    const todayTrips = document.getElementById('todayTrips');
    
    if (todayEarnings) {
        todayEarnings.textContent = `R ${(driver.todayEarnings || 0).toFixed(2)}`;
    }
    
    if (todayTrips) {
        todayTrips.textContent = driver.todayTrips || 0;
    }
}

async function loadDriverDeliveries() {
    try {
        const deliveries = await API.request(`/trips?driverId=${AppState.user._id}`);
        renderDriverDeliveries(deliveries);
    } catch (error) {
        console.error('Failed to load deliveries:', error);
    }
}

function renderDriverDeliveries(deliveries) {
    const container = document.getElementById('driverDeliveriesList');
    if (!container) return;
    
    if (!deliveries || deliveries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box"></i>
                <p>No deliveries yet</p>
                <small>Go online to receive deliveries</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = deliveries.slice(0, 5).map(delivery => `
        <div class="delivery-item">
            <div class="delivery-info">
                <strong>${delivery.pickup?.address?.substring(0, 30) || 'Pickup'}...</strong>
                <small>${delivery.status} • ${delivery.distance ? delivery.distance.toFixed(1) + 'km' : ''}</small>
            </div>
            <div class="delivery-fare">R ${delivery.fare?.total?.toFixed(2) || '0.00'}</div>
        </div>
    `).join('');
}

function setupDriverListeners() {
    // Online/Offline buttons
    const onlineBtn = document.getElementById('goOnlineBtn');
    const offlineBtn = document.getElementById('goOfflineBtn');
    
    if (onlineBtn) {
        onlineBtn.addEventListener('click', () => {
            showNotification('You are now online', 'success');
            // Call driverManager if it exists
            if (window.driverManager && typeof driverManager.goOnline === 'function') {
                driverManager.goOnline();
            }
        });
    }
    
    if (offlineBtn) {
        offlineBtn.addEventListener('click', () => {
            showNotification('You are now offline', 'info');
            if (window.driverManager && typeof driverManager.goOffline === 'function') {
                driverManager.goOffline();
            }
        });
    }
    
    // Center on my location
    const centerBtn = document.getElementById('centerOnMeBtn');
    if (centerBtn) {
        centerBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(position => {
                    const { latitude, longitude } = position.coords;
                    if (AppState.mapManager) {
                        AppState.mapManager.centerMap([latitude, longitude]);
                    }
                });
            }
        });
    }
}

// Export functions to global scope
window.initDriverPage = initDriverPage;