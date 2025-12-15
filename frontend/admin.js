// ===== ADMIN PAGE SPECIFIC FUNCTIONS =====

// Wait for app.js to load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Admin page loading...');
    
    // Wait for app.js to initialize
    setTimeout(async () => {
        // Check if we have an admin logged in
        if (!AppState.user || AppState.user.userType !== 'admin') {
            console.log('Not logged in as admin, redirecting...');
            showNotification('Admin access required', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        // Initialize admin page
        initAdminPage();
    }, 500);
});

function initAdminPage() {
    console.log('Initializing admin page for:', AppState.user?.name);
    
    // Update UI with admin info
    updateAdminUI();
    
    // Initialize map
    initAdminMap();
    
    // Load admin data
    loadAdminData();
    
    // Setup admin event listeners
    setupAdminListeners();
}

function updateAdminUI() {
    const admin = AppState.user;
    if (!admin) return;
    
    // Update display elements
    const nameElements = document.querySelectorAll('.admin-name-display');
    nameElements.forEach(el => {
        if (el) el.textContent = admin.name;
    });
}

function initAdminMap() {
    const mapElement = document.getElementById('adminMap');
    if (!mapElement) return;
    
    // Use the MapManager from app.js
    if (AppState.mapManager) {
        AppState.mapManager.destroy(); // Clean up old map
    }
    
    AppState.mapManager = new MapManager('adminMap', {
        center: APP_CONFIG.MAP_CONFIG.defaultCenter,
        zoom: 12,
        scrollWheelZoom: false
    });
    
    const map = AppState.mapManager.initialize();
    
    if (map) {
        // Load and display drivers on map
        loadDriversForMap();
    }
}

async function loadDriversForMap() {
    try {
        const drivers = await API.request('/drivers?status=online,busy');
        
        drivers.forEach(driver => {
            if (driver.currentLocation) {
                AppState.mapManager.addMarker(
                    `driver_${driver._id}`,
                    [driver.currentLocation.lat, driver.currentLocation.lng],
                    {
                        icon: AppState.mapManager.getDriverIcon(driver.status),
                        popup: `<strong>${driver.name}</strong><br>Status: ${driver.status}<br>Vehicle: ${driver.vehicle?.type || 'N/A'}`
                    }
                );
            }
        });
        
        // Fit map to show all drivers
        const markers = Array.from(AppState.mapManager.markers.values());
        if (markers.length > 0) {
            AppState.mapManager.fitBounds(markers);
        }
        
    } catch (error) {
        console.error('Failed to load drivers for map:', error);
    }
}

async function loadAdminData() {
    try {
        // Load quick stats
        const stats = await API.request('/admin/stats');
        updateAdminStats(stats);
        
        // Load drivers list
        const drivers = await API.request('/drivers');
        renderDriversList(drivers);
        
        // Load recent deliveries
        const deliveries = await API.request('/trips/recent');
        renderRecentDeliveries(deliveries);
        
    } catch (error) {
        console.error('Failed to load admin data:', error);
    }
}

function updateAdminStats(stats) {
    const totalDrivers = document.getElementById('totalDrivers');
    const activeDeliveries = document.getElementById('activeDeliveries');
    const todayRevenue = document.getElementById('todayRevenue');
    
    if (totalDrivers) totalDrivers.textContent = stats.totalDrivers || 0;
    if (activeDeliveries) activeDeliveries.textContent = stats.activeDeliveries || 0;
    if (todayRevenue) todayRevenue.textContent = `R ${(stats.todayRevenue || 0).toFixed(2)}`;
}

function renderDriversList(drivers) {
    const container = document.getElementById('adminDriversList');
    if (!container) return;
    
    if (!drivers || drivers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-motorcycle"></i>
                <p>No drivers registered</p>
            </div>
        `;
        return;
    }
    
    // Show first 5 drivers
    container.innerHTML = drivers.slice(0, 5).map(driver => `
        <div class="driver-card" data-driver-id="${driver._id}">
            <div class="driver-avatar">
                <div class="driver-img">${driver.name.charAt(0)}</div>
                <div class="driver-status status-${driver.status}"></div>
            </div>
            <div class="driver-details">
                <h4>${driver.name}</h4>
                <p>${driver.phone || 'No phone'}</p>
                <p>${driver.vehicle?.type || 'No vehicle'}</p>
                <span class="driver-status-text">${driver.status}</span>
            </div>
            <div class="driver-actions">
                <button class="action-btn" onclick="trackDriver('${driver._id}')">
                    <i class="fas fa-map-marker-alt"></i> Track
                </button>
            </div>
        </div>
    `).join('');
}

function renderRecentDeliveries(deliveries) {
    const container = document.getElementById('recentDeliveriesList');
    if (!container) return;
    
    if (!deliveries || deliveries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box"></i>
                <p>No recent deliveries</p>
            </div>
        `;
        return;
    }
    
    // Show first 5 deliveries
    container.innerHTML = deliveries.slice(0, 5).map(delivery => `
        <div class="delivery-item">
            <div class="delivery-info">
                <strong>Trip #${delivery.tripId?.substring(0, 8) || 'N/A'}</strong>
                <small>${delivery.pickup?.address?.substring(0, 25) || 'Pickup'}...</small>
                <span class="status-badge badge-${delivery.status}">${delivery.status}</span>
            </div>
            <div class="delivery-fare">R ${delivery.fare?.total?.toFixed(2) || '0.00'}</div>
        </div>
    `).join('');
}

function setupAdminListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshAdminBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAdminData();
            showNotification('Data refreshed', 'success');
        });
    }
    
    // Refresh map button
    const refreshMapBtn = document.getElementById('refreshMapBtn');
    if (refreshMapBtn) {
        refreshMapBtn.addEventListener('click', () => {
            loadDriversForMap();
            showNotification('Map refreshed', 'success');
        });
    }
}

// Export functions to global scope
window.initAdminPage = initAdminPage;