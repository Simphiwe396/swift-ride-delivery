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
    
    // Setup section switching
    setupSectionSwitching();
}

function updateAdminUI() {
    const admin = AppState.user;
    if (!admin) return;
    
    // Update display elements
    const adminInfo = document.getElementById('adminUserInfo');
    if (adminInfo) {
        adminInfo.innerHTML = `
            <div class="user-avatar">${admin.name.charAt(0)}</div>
            <div>
                <strong>${admin.name}</strong>
                <small>Admin Account</small>
            </div>
        `;
    }
    
    const sectionTitle = document.getElementById('sectionTitle');
    if (sectionTitle) {
        sectionTitle.textContent = 'Admin Dashboard';
    }
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
        scrollWheelZoom: true
    });
    
    const map = AppState.mapManager.initialize();
    
    if (map) {
        // Load and display drivers on map
        loadDriversForMap();
    }
}

async function loadDriversForMap() {
    try {
        // Mock drivers data
        const drivers = [
            {
                _id: 'driver1',
                name: 'John Driver',
                status: 'online',
                currentLocation: { lat: -26.195246, lng: 28.034088 },
                vehicle: { type: 'motorcycle', model: 'Honda 125' }
            },
            {
                _id: 'driver2',
                name: 'Mike Rider',
                status: 'busy',
                currentLocation: { lat: -26.185246, lng: 28.044088 },
                vehicle: { type: 'car', model: 'Toyota Corolla' }
            },
            {
                _id: 'driver3',
                name: 'Sarah Courier',
                status: 'online',
                currentLocation: { lat: -26.205246, lng: 28.024088 },
                vehicle: { type: 'motorcycle', model: 'Yamaha 150' }
            }
        ];
        
        drivers.forEach(driver => {
            if (driver.currentLocation) {
                AppState.mapManager.addMarker(
                    `driver_${driver._id}`,
                    [driver.currentLocation.lat, driver.currentLocation.lng],
                    {
                        icon: AppState.mapManager.getDriverIcon(driver.status),
                        popup: `<strong>${driver.name}</strong><br>Status: ${driver.status}<br>Vehicle: ${driver.vehicle?.type || 'N/A'}<br>
                               <button class="track-btn" onclick="trackDriver('${driver._id}')" style="margin-top: 5px; padding: 5px 10px; background: #6C63FF; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                   <i class="fas fa-map-marker-alt"></i> Track
                               </button>`
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
        // Update quick stats
        updateAdminStats();
        
        // Load active drivers list
        loadActiveDrivers();
        
        // Load recent activity
        loadRecentActivity();
        
        // Load drivers table
        loadDriversTable();
        
        // Load deliveries table
        loadDeliveriesTable();
        
    } catch (error) {
        console.error('Failed to load admin data:', error);
    }
}

function updateAdminStats() {
    const totalDrivers = document.getElementById('totalDrivers');
    const activeDeliveries = document.getElementById('activeDeliveries');
    const todayRevenue = document.getElementById('todayRevenue');
    const completionRate = document.getElementById('completionRate');
    
    if (totalDrivers) totalDrivers.textContent = '12';
    if (activeDeliveries) activeDeliveries.textContent = '8';
    if (todayRevenue) todayRevenue.textContent = 'R 2,450.00';
    if (completionRate) completionRate.textContent = '94%';
}

function loadActiveDrivers() {
    const container = document.getElementById('activeDriversList');
    if (!container) return;
    
    const drivers = [
        { id: '1', name: 'John D', status: 'online', vehicle: 'Motorcycle', rating: 4.8, phone: '082 123 4567' },
        { id: '2', name: 'Mike R', status: 'busy', vehicle: 'Car', rating: 4.6, phone: '083 987 6543' },
        { id: '3', name: 'Sarah C', status: 'online', vehicle: 'Motorcycle', rating: 4.9, phone: '084 555 1212' },
        { id: '4', name: 'David T', status: 'offline', vehicle: 'Van', rating: 4.7, phone: '081 777 8888' }
    ];
    
    container.innerHTML = drivers.map(driver => `
        <div class="driver-card" style="background: white; border-radius: 10px; padding: 15px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="driver-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: #6C63FF; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                    ${driver.name.charAt(0)}
                </div>
                <div>
                    <h4 style="margin: 0;">${driver.name}</h4>
                    <p style="margin: 5px 0; color: #666; font-size: 14px;">${driver.vehicle} • ${driver.phone}</p>
                    <span class="driver-status" style="background: ${driver.status === 'online' ? '#4CAF50' : driver.status === 'busy' ? '#FF9800' : '#9E9E9E'}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;">
                        ${driver.status}
                    </span>
                </div>
            </div>
            <div>
                <button class="track-btn" onclick="trackDriver('${driver.id}')" style="background: #6C63FF; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">
                    <i class="fas fa-map-marker-alt"></i> Track
                </button>
            </div>
        </div>
    `).join('');
}

function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    const activities = [
        { time: '10:30 AM', driver: 'John D', action: 'Completed delivery', trip: '#TRIP-1234' },
        { time: '10:15 AM', driver: 'Mike R', action: 'Started trip', trip: '#TRIP-1235' },
        { time: '09:45 AM', driver: 'Sarah C', action: 'Went online', trip: '-' },
        { time: '09:30 AM', driver: 'David T', action: 'Went offline', trip: '-' }
    ];
    
    container.innerHTML = activities.map(activity => `
        <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #666;">${activity.time}</span>
                <span style="color: #6C63FF;">${activity.trip}</span>
            </div>
            <p style="margin: 5px 0;">
                <strong>${activity.driver}</strong> ${activity.action}
            </p>
        </div>
    `).join('');
}

function loadDriversTable() {
    const container = document.getElementById('driversTable');
    if (!container) return;
    
    const drivers = [
        { id: 'DRV001', name: 'John Driver', contact: 'john@example.com', vehicle: 'Motorcycle', status: 'Online', rating: 4.8 },
        { id: 'DRV002', name: 'Mike Rider', contact: 'mike@example.com', vehicle: 'Car', status: 'Busy', rating: 4.6 },
        { id: 'DRV003', name: 'Sarah Courier', contact: 'sarah@example.com', vehicle: 'Motorcycle', status: 'Online', rating: 4.9 }
    ];
    
    container.innerHTML = drivers.map(driver => `
        <tr>
            <td>${driver.id}</td>
            <td>${driver.name}</td>
            <td>${driver.contact}</td>
            <td>${driver.vehicle}</td>
            <td>
                <span class="status-badge" style="background: ${driver.status === 'Online' ? '#4CAF50' : '#FF9800'}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px;">
                    ${driver.status}
                </span>
            </td>
            <td>${driver.rating} ⭐</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewDriver('${driver.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="action-btn track" onclick="trackDriver('${driver.id}')" style="background: #6C63FF; color: white;">
                        <i class="fas fa-map-marker-alt"></i> Track
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function loadDeliveriesTable() {
    const container = document.getElementById('deliveriesTable');
    if (!container) return;
    
    const deliveries = [
        { id: 'TRIP-1234', customer: 'Sarah Customer', driver: 'John Driver', route: 'Main St → Oak Ave', distance: '8.5 km', fare: 'R 120.00', status: 'Completed' },
        { id: 'TRIP-1235', customer: 'Mike Smith', driver: 'Mike Rider', route: 'Market St → Pine Rd', distance: '12.3 km', fare: 'R 180.00', status: 'In Progress' }
    ];
    
    container.innerHTML = deliveries.map(delivery => `
        <tr>
            <td>${delivery.id}</td>
            <td>${delivery.customer}</td>
            <td>${delivery.driver}</td>
            <td>${delivery.route}</td>
            <td>${delivery.distance}</td>
            <td>${delivery.fare}</td>
            <td>
                <span class="status-badge" style="background: ${delivery.status === 'Completed' ? '#4CAF50' : '#FF9800'}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px;">
                    ${delivery.status}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewDelivery('${delivery.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function setupAdminListeners() {
    // Socket listeners for real-time updates
    if (AppState.socket) {
        AppState.socket.on('admin:driverUpdate', (data) => {
            console.log('Driver update received:', data);
            showNotification(`Driver ${data.name} location updated`, 'info');
        });
        
        AppState.socket.on('driver:status', (data) => {
            console.log('Driver status update:', data);
            showNotification(`Driver ${data.name} is now ${