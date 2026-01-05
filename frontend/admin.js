// ===== ADMIN PAGE SECURITY CHECK =====
(function() {
    // Check if user is logged in as admin
    const user = localStorage.getItem('swiftride_user');
    const isAdmin = localStorage.getItem('is_admin');
    
    if (!user || !isAdmin) {
        // Not authorized - redirect to login
        alert('Access denied. Please login as admin first.');
        window.location.href = 'login.html';
        return;
    }
    
    // Parse user data
    try {
        const userData = JSON.parse(user);
        if (userData.userType !== 'admin') {
            alert('Admin access required.');
            window.location.href = 'login.html';
            return;
        }
    } catch (e) {
        alert('Invalid session. Please login again.');
        window.location.href = 'login.html';
        return;
    }
    
    // User is authorized - continue loading page
    console.log('Admin user authenticated');
})();

// ===== ADMIN PAGE SPECIFIC FUNCTIONS =====

// Wait for app.js to load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Admin page loading...');
    
    // Wait for app.js to initialize
    setTimeout(async () => {
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
        // Get drivers from localStorage or use mock data
        let drivers = JSON.parse(localStorage.getItem('swiftride_drivers') || '[]');
        
        if (drivers.length === 0) {
            // Mock drivers data for demo
            drivers = [
                {
                    id: 'driver1',
                    name: 'John Driver',
                    status: 'online',
                    currentLocation: { lat: -26.195246, lng: 28.034088 },
                    vehicle: { type: 'motorcycle', model: 'Honda 125' }
                },
                {
                    id: 'driver2',
                    name: 'Mike Rider',
                    status: 'busy',
                    currentLocation: { lat: -26.185246, lng: 28.044088 },
                    vehicle: { type: 'car', model: 'Toyota Corolla' }
                },
                {
                    id: 'driver3',
                    name: 'Sarah Courier',
                    status: 'online',
                    currentLocation: { lat: -26.205246, lng: 28.024088 },
                    vehicle: { type: 'motorcycle', model: 'Yamaha 150' }
                }
            ];
        }
        
        drivers.forEach(driver => {
            if (driver.currentLocation) {
                AppState.mapManager.addMarker(
                    `driver_${driver.id}`,
                    [driver.currentLocation.lat, driver.currentLocation.lng],
                    {
                        icon: AppState.mapManager.getDriverIcon(driver.status),
                        popup: `<strong>${driver.name}</strong><br>Status: ${driver.status}<br>Vehicle: ${driver.vehicle?.type || 'N/A'}<br>
                               <button class="track-btn" onclick="trackDriver('${driver.id}')" style="margin-top: 5px; padding: 5px 10px; background: #6C63FF; color: white; border: none; border-radius: 5px; cursor: pointer;">
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
    
    // Get data from localStorage
    const drivers = JSON.parse(localStorage.getItem('swiftride_drivers') || '[]');
    const onlineDrivers = drivers.filter(d => d.status === 'online').length;
    
    if (totalDrivers) totalDrivers.textContent = drivers.length;
    if (activeDeliveries) activeDeliveries.textContent = onlineDrivers;
    if (todayRevenue) todayRevenue.textContent = 'R 2,450.00';
    if (completionRate) completionRate.textContent = '94%';
}

function loadActiveDrivers() {
    const container = document.getElementById('activeDriversList');
    if (!container) return;
    
    const drivers = JSON.parse(localStorage.getItem('swiftride_drivers') || '[]');
    
    if (drivers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-motorcycle"></i>
                <p>No drivers added yet</p>
                <button class="btn btn-primary" onclick="showModal('addDriverModal')">
                    Add First Driver
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = drivers.map(driver => `
        <div class="driver-card" style="background: white; border-radius: 10px; padding: 15px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="driver-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: #6C63FF; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                    ${driver.name.charAt(0)}
                </div>
                <div>
                    <h4 style="margin: 0;">${driver.name}</h4>
                    <p style="margin: 5px 0; color: #666; font-size: 14px;">${driver.vehicle?.type || 'No vehicle'} • ${driver.phone || 'No phone'}</p>
                    <span class="driver-status" style="background: ${driver.status === 'online' ? '#4CAF50' : driver.status === 'busy' ? '#FF9800' : '#9E9E9E'}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;">
                        ${driver.status || 'offline'}
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
    
    const drivers = JSON.parse(localStorage.getItem('swiftride_drivers') || '[]');
    
    if (drivers.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-motorcycle" style="font-size: 3rem; color: #E8EAF2; margin-bottom: 1rem; display: block;"></i>
                    <p>No drivers added yet</p>
                    <button class="btn btn-primary" onclick="showModal('addDriverModal')">
                        Add First Driver
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = drivers.map(driver => `
        <tr>
            <td>${driver.id || 'DRV' + Date.now().toString().slice(-4)}</td>
            <td>${driver.name}</td>
            <td>${driver.phone || 'N/A'}</td>
            <td>${driver.vehicle?.type || 'N/A'}</td>
            <td>
                <span class="status-badge" style="background: ${driver.status === 'online' ? '#4CAF50' : driver.status === 'busy' ? '#FF9800' : '#9E9E9E'}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px;">
                    ${driver.status || 'offline'}
                </span>
            </td>
            <td>${driver.rating || '5.0'} ⭐</td>
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
    if (typeof io !== 'undefined') {
        try {
            const socket = io('https://swiftride-backend-jcyl.onrender.com', {
                transports: ['websocket', 'polling']
            });
            
            socket.on('connect', () => {
                console.log('✅ Socket connected for admin');
            });
            
            socket.on('admin:driverUpdate', (data) => {
                console.log('Driver update received:', data);
                showNotification(`Driver ${data.name} location updated`, 'info');
            });
        } catch (error) {
            console.log('Socket connection not available');
        }
    }
}

function setupSectionSwitching() {
    const sections = {
        'overview': document.getElementById('overviewSection'),
        'drivers': document.getElementById('driversSection'),
        'deliveries': document.getElementById('deliveriesSection'),
        'tracking': document.getElementById('trackingSection'),
        'customers': document.getElementById('customersSection'),
        'reports': document.getElementById('reportsSection'),
        'settings': document.getElementById('settingsSection')
    };
    
    const links = document.querySelectorAll('.sidebar-link');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            
            // Update active link
            links.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Update section title
            const sectionTitle = document.getElementById('sectionTitle');
            if (sectionTitle) {
                const titleMap = {
                    'overview': 'Admin Dashboard',
                    'drivers': 'Driver Management',
                    'deliveries': 'Delivery Management',
                    'tracking': 'Live Tracking',
                    'customers': 'Customer Management',
                    'reports': 'Analytics & Reports',
                    'settings': 'System Settings'
                };
                sectionTitle.textContent = titleMap[target] || 'Admin Dashboard';
            }
            
            // Show target section, hide others
            Object.values(sections).forEach(section => {
                if (section) section.style.display = 'none';
            });
            
            if (sections[target]) {
                sections[target].style.display = 'block';
                
                // Load specific section data
                switch(target) {
                    case 'drivers':
                        loadDriversTable();
                        break;
                    case 'deliveries':
                        loadDeliveriesTable();
                        break;
                    case 'tracking':
                        initTrackingMap();
                        break;
                }
            }
        });
    });
}

// Admin Actions
function addDriver(event) {
    event.preventDefault();
    
    const driver = {
        id: 'drv_' + Date.now(),
        name: document.getElementById('driverName').value,
        phone: document.getElementById('driverPhone').value,
        email: document.getElementById('driverEmail').value || '',
        vehicleType: document.getElementById('vehicleType').value,
        vehicleDetails: document.getElementById('vehicleDetails').value,
        licensePlate: document.getElementById('licensePlate').value,
        ratePerKm: parseInt(document.getElementById('driverRate').value),
        status: 'offline',
        rating: 5.0,
        joinedDate: new Date().toISOString().split('T')[0],
        currentLocation: {
            lat: -26.195246 + (Math.random() * 0.02 - 0.01),
            lng: 28.034088 + (Math.random() * 0.02 - 0.01)
        }
    };
    
    // Store in localStorage
    let drivers = JSON.parse(localStorage.getItem('swiftride_drivers') || '[]');
    drivers.push(driver);
    localStorage.setItem('swiftride_drivers', JSON.stringify(drivers));
    
    showNotification(`Driver ${driver.name} added successfully!`, 'success');
    hideModal('addDriverModal');
    
    // Clear form
    document.getElementById('addDriverForm').reset();
    
    // Refresh drivers list
    loadDriversTable();
    loadActiveDrivers();
    updateAdminStats();
}

function viewDriver(driverId) {
    const drivers = JSON.parse(localStorage.getItem('swiftride_drivers') || '[]');
    const driver = drivers.find(d => d.id === driverId);
    
    if (!driver) {
        showNotification('Driver not found', 'error');
        return;
    }
    
    document.getElementById('driverDetailsContent').innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
            <div class="driver-avatar" style="width: 80px; height: 80px; border-radius: 50%; background: #6C63FF; color: white; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold;">
                ${driver.name.charAt(0)}
            </div>
            <div>
                <h3 style="margin: 0 0 10px 0;">${driver.name}</h3>
                <p style="color: #666; margin: 5px 0;">${driver.email}</p>
                <p style="color: #666; margin: 5px 0;">${driver.phone}</p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div>
                <strong>Vehicle Type</strong>
                <p>${driver.vehicleType || 'Not specified'}</p>
            </div>
            <div>
                <strong>License Plate</strong>
                <p>${driver.licensePlate || 'Not specified'}</p>
            </div>
            <div>
                <strong>Rate per km</strong>
                <p>R ${driver.ratePerKm || 10}/km</p>
            </div>
            <div>
                <strong>Status</strong>
                <p>
                    <span class="status-badge" style="background: ${driver.status === 'online' ? '#4CAF50' : driver.status === 'busy' ? '#FF9800' : '#9E9E9E'}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px;">
                        ${driver.status || 'offline'}
                    </span>
                </p>
            </div>
            <div>
                <strong>Join Date</strong>
                <p>${driver.joinedDate || 'Not specified'}</p>
            </div>
            <div>
                <strong>Rating</strong>
                <p>${driver.rating || '5.0'} ⭐</p>
            </div>
        </div>
        
        <div style="margin-top: 20px; display: flex; gap: 10px;">
            <button class="btn btn-primary" onclick="editDriver('${driver.id}')">
                <i class="fas fa-edit"></i> Edit Driver
            </button>
            <button class="btn btn-secondary" onclick="sendMessageToDriver('${driver.id}')">
                <i class="fas fa-envelope"></i> Send Message
            </button>
        </div>
    `;
    
    showModal('driverDetailsModal');
}

function trackDriver(driverId) {
    // Store driver ID for tracking
    localStorage.setItem('trackingDriverId', driverId);
    alert(`Tracking driver ${driverId}. This would open the tracking page.`);
    // window.location.href = `tracking.html?driver=${driverId}`;
}

function viewDelivery(deliveryId) {
    showNotification(`Viewing delivery ${deliveryId}`, 'info');
}

function filterDrivers() {
    const filter = document.getElementById('driverStatusFilter').value;
    showNotification(`Filtering drivers by: ${filter}`, 'info');
}

function filterDeliveries() {
    const filter = document.getElementById('deliveryStatusFilter').value;
    showNotification(`Filtering deliveries by: ${filter}`, 'info');
}

function exportDeliveries() {
    showNotification('Exporting deliveries data...', 'info');
}

function refreshMap() {
    if (AppState.mapManager) {
        AppState.mapManager.destroy();
        initAdminMap();
        showNotification('Map refreshed', 'success');
    }
}

function centerMap() {
    if (AppState.mapManager) {
        AppState.mapManager.centerMap(APP_CONFIG.MAP_CONFIG.defaultCenter, 12);
        showNotification('Map centered', 'info');
    }
}

function toggleSatellite() {
    showNotification('Satellite view toggled', 'info');
}

function initTrackingMap() {
    const mapElement = document.getElementById('trackingMap');
    if (!mapElement) return;
    
    // Create new map for tracking
    const trackingMap = L.map('trackingMap').setView(
        APP_CONFIG.MAP_CONFIG.defaultCenter,
        12
    );
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(trackingMap);
    
    // Add drivers to tracking map
    const drivers = JSON.parse(localStorage.getItem('swiftride_drivers') || '[]');
    drivers.forEach(driver => {
        if (driver.currentLocation) {
            L.marker([driver.currentLocation.lat, driver.currentLocation.lng], {
                icon: L.divIcon({
                    html: `<div style="
                        background: ${driver.status === 'online' ? '#4CAF50' : driver.status === 'busy' ? '#FF9800' : '#9E9E9E'};
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 0 5px rgba(0,0,0,0.3);
                    "></div>`,
                    iconSize: [20, 20]
                })
            })
            .addTo(trackingMap)
            .bindPopup(`<strong>${driver.name}</strong><br>Status: ${driver.status}`);
        }
    });
}

function refreshTracking() {
    const mapElement = document.getElementById('trackingMap');
    if (mapElement) {
        mapElement.innerHTML = '';
        initTrackingMap();
        showNotification('Tracking map refreshed', 'success');
    }
}

function centerAllDrivers() {
    showNotification('Centering map on all drivers', 'info');
}

function toggleHeatmap() {
    showNotification('Heatmap toggled', 'info');
}

function showNotifications() {
    document.getElementById('notificationsList').innerHTML = `
        <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
            <strong>New driver registered</strong>
            <p style="margin: 5px 0; color: #666;">John Driver just joined the platform</p>
            <small style="color: #999;">Just now</small>
        </div>
        <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
            <strong>Delivery completed</strong>
            <p style="margin: 5px 0; color: #666;">Trip #TRIP-1234 completed successfully</p>
            <small style="color: #999;">30 minutes ago</small>
        </div>
        <div style="padding: 10px 0;">
            <strong>Payment received</strong>
            <p style="margin: 5px 0; color: #666;">R 120.00 received for delivery</p>
            <small style="color: #999;">1 hour ago</small>
        </div>
    `;
    showModal('notificationsModal');
}

// Initialize on load
window.onload = function() {
    // Check if we're on admin page
    if (document.body.dataset.page === 'admin') {
        setTimeout(initAdminPage, 100);
    }
};