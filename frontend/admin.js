// Admin Dashboard JavaScript
console.log('Admin Dashboard Loading...');

// Security Check - MUST BE FIRST
(function() {
    const user = localStorage.getItem('swiftride_user');
    const isAdmin = localStorage.getItem('is_admin');
    
    if (!user || !isAdmin) {
        alert('Access Denied. Please login as admin first.');
        window.location.href = 'login.html';
        return;
    }
    
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
    
    console.log('Admin authenticated successfully');
})();

// Initialize Admin Dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Admin Dashboard...');
    
    // Load admin user info
    const user = JSON.parse(localStorage.getItem('swiftride_user') || '{}');
    if (user.name) {
        const adminInfo = document.getElementById('adminUserInfo');
        if (adminInfo) {
            adminInfo.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: #F8F9FF; border-radius: 10px;">
                    <div style="width: 40px; height: 40px; background: #6C63FF; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                        ${user.name.charAt(0)}
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #333;">${user.name}</div>
                        <div style="font-size: 0.85rem; color: #666;">Admin Account</div>
                    </div>
                </div>
            `;
        }
    }
    
    // Initialize map
    setTimeout(() => {
        initAdminMap();
        loadDashboardData();
        setupEventListeners();
    }, 500);
    
    // Hide loading screen
    setTimeout(() => {
        const loading = document.getElementById('loadingScreen');
        if (loading) loading.style.display = 'none';
    }, 1000);
});

// Initialize Admin Map
function initAdminMap() {
    try {
        const mapElement = document.getElementById('adminMap');
        if (!mapElement) return;
        
        // Clear existing map
        if (window.currentMap) {
            window.currentMap.remove();
        }
        
        // Create new map
        window.currentMap = new MapManager('adminMap', {
            center: window.CONFIG.MAP_CENTER,
            zoom: 12
        }).initialize();
        
        if (window.currentMap) {
            // Add sample drivers
            const drivers = [
                {
                    id: 'driver1',
                    name: 'John Driver',
                    status: 'online',
                    location: [-26.195246, 28.034088],
                    vehicle: 'Motorcycle'
                },
                {
                    id: 'driver2',
                    name: 'Mike Rider',
                    status: 'busy',
                    location: [-26.185246, 28.044088],
                    vehicle: 'Car'
                },
                {
                    id: 'driver3',
                    name: 'Sarah Courier',
                    status: 'online',
                    location: [-26.205246, 28.024088],
                    vehicle: 'Motorcycle'
                }
            ];
            
            drivers.forEach(driver => {
                const iconColor = driver.status === 'online' ? '#4CAF50' : 
                                 driver.status === 'busy' ? '#FF9800' : '#9E9E9E';
                
                window.currentMap.addMarker(driver.id, driver.location, {
                    popup: `
                        <div style="padding: 10px; min-width: 200px;">
                            <h4 style="margin: 0 0 5px 0; color: #333;">${driver.name}</h4>
                            <p style="margin: 0 0 5px 0; color: #666;">
                                <strong>Status:</strong> ${driver.status}
                            </p>
                            <p style="margin: 0 0 5px 0; color: #666;">
                                <strong>Vehicle:</strong> ${driver.vehicle}
                            </p>
                            <button onclick="trackDriver('${driver.id}')" style="
                                background: #6C63FF;
                                color: white;
                                border: none;
                                padding: 5px 15px;
                                border-radius: 5px;
                                cursor: pointer;
                                margin-top: 5px;
                                width: 100%;
                            ">
                                <i class="fas fa-map-marker-alt"></i> Track Driver
                            </button>
                        </div>
                    `
                });
            });
            
            console.log('Admin map initialized with drivers');
        }
    } catch (error) {
        console.error('Failed to initialize admin map:', error);
    }
}

// Load Dashboard Data
function loadDashboardData() {
    // Update stats
    updateStats();
    
    // Load drivers table
    loadDriversTable();
    
    // Load recent activity
    loadRecentActivity();
    
    // Load active drivers
    loadActiveDrivers();
}

function updateStats() {
    document.getElementById('totalDrivers').textContent = '12';
    document.getElementById('activeDeliveries').textContent = '8';
    document.getElementById('todayRevenue').textContent = 'R 2,450.00';
    document.getElementById('completionRate').textContent = '94%';
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
                <span style="
                    background: ${driver.status === 'Online' ? '#4CAF50' : '#FF9800'};
                    color: white;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 500;
                ">
                    ${driver.status}
                </span>
            </td>
            <td>${driver.rating} ⭐</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button onclick="viewDriver('${driver.id}')" style="
                        background: #2196F3;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.85rem;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    ">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button onclick="trackDriver('${driver.id}')" style="
                        background: #6C63FF;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 0.85rem;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    ">
                        <i class="fas fa-map-marker-alt"></i> Track
                    </button>
                </div>
            </td>
        </tr>
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
        <div style="padding: 12px; border-bottom: 1px solid #E8EAF2;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: #666; font-size: 0.9rem;">${activity.time}</span>
                <span style="color: #6C63FF; font-size: 0.9rem;">${activity.trip}</span>
            </div>
            <p style="margin: 0; font-size: 0.95rem;">
                <strong>${activity.driver}</strong> ${activity.action}
            </p>
        </div>
    `).join('');
}

function loadActiveDrivers() {
    const container = document.getElementById('activeDriversList');
    if (!container) return;
    
    const drivers = [
        { id: '1', name: 'John D', status: 'online', vehicle: 'Motorcycle', rating: 4.8, phone: '082 123 4567' },
        { id: '2', name: 'Mike R', status: 'busy', vehicle: 'Car', rating: 4.6, phone: '083 987 6543' },
        { id: '3', name: 'Sarah C', status: 'online', vehicle: 'Motorcycle', rating: 4.9, phone: '084 555 1212' }
    ];
    
    container.innerHTML = drivers.map(driver => `
        <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="width: 45px; height: 45px; border-radius: 50%; background: #6C63FF; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem;">
                    ${driver.name.charAt(0)}
                </div>
                <div>
                    <h4 style="margin: 0 0 5px 0; color: #333;">${driver.name}</h4>
                    <p style="margin: 0 0 5px 0; color: #666; font-size: 0.9rem;">${driver.vehicle} • ${driver.phone}</p>
                    <span style="
                        background: ${driver.status === 'online' ? '#4CAF50' : driver.status === 'busy' ? '#FF9800' : '#9E9E9E'};
                        color: white;
                        padding: 3px 10px;
                        border-radius: 12px;
                        font-size: 0.8rem;
                        font-weight: 500;
                    ">
                        ${driver.status}
                    </span>
                </div>
            </div>
            <button onclick="trackDriver('${driver.id}')" style="
                background: #6C63FF;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <i class="fas fa-map-marker-alt"></i> Track
            </button>
        </div>
    `).join('');
}

// Admin Actions
function trackDriver(driverId) {
    showNotification(`Tracking driver ${driverId}...`, 'info');
    // In real app, this would show driver on map
}

function viewDriver(driverId) {
    showNotification(`Viewing driver ${driverId} details`, 'info');
}

function addNewDriver() {
    const name = prompt("Enter driver name:");
    const phone = prompt("Enter driver phone:");
    const vehicle = prompt("Enter vehicle type (Motorcycle/Car/Van):");
    
    if (name && phone && vehicle) {
        showNotification(`Driver ${name} added successfully!`, 'success');
        // Refresh drivers list
        setTimeout(() => {
            loadDriversTable();
            loadActiveDrivers();
        }, 500);
    }
}

function refreshMap() {
    initAdminMap();
    showNotification('Map refreshed', 'success');
}

// Setup Event Listeners
function setupEventListeners() {
    // Add driver button
    const addDriverBtn = document.querySelector('[onclick="addNewDriver()"]');
    if (addDriverBtn) {
        addDriverBtn.onclick = addNewDriver;
    }
    
    // Refresh map button
    const refreshBtn = document.querySelector('[onclick="refreshMap()"]');
    if (refreshBtn) {
        refreshBtn.onclick = refreshMap;
    }
    
    // Logout button
    const logoutBtn = document.querySelector('[onclick="logout()"]');
    if (logoutBtn) {
        logoutBtn.onclick = window.logout;
    }
}

// Make functions globally available
window.trackDriver = trackDriver;
window.viewDriver = viewDriver;
window.addNewDriver = addNewDriver;
window.refreshMap = refreshMap;