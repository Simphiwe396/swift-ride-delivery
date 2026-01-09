// ===== ADMIN PAGE SPECIFIC FUNCTIONS =====

let allDrivers = [];
let allTrips = [];
let onlineDrivers = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize admin dashboard
    const userData = localStorage.getItem('swiftride_user');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        if (user.type !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
        
    } catch (error) {
        window.location.href = 'index.html';
        return;
    }
    
    // Initialize map if on overview section
    if (document.getElementById('adminMap')) {
        if (typeof window.initMap === 'function') {
            window.initMap('adminMap');
        }
    }
    
    // Load data
    await loadDashboardData();
    await loadAllDrivers();
    await loadAllTrips();
    
    // Setup socket listeners for real-time updates
    setupSocketListeners();
    
    // Hide loading screen
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 1000);
});

function setupSocketListeners() {
    if (window.AppState && window.AppState.socket) {
        // Listen for driver status changes
        window.AppState.socket.on('driver-status', (data) => {
            console.log('🔄 Admin: Driver status:', data);
            updateOnlineDriverList(data);
            
            if (data.name) {
                showNotification(`Driver ${data.name} is now ${data.status}`, 'info');
            }
        });
        
        // Listen for driver location updates
        window.AppState.socket.on('driver-update', (data) => {
            console.log('📍 Admin: Driver location:', data);
            updateOnlineDriverList(data);
            
            // Update on map
            if (window.AppState && window.AppState.map && data.lat && data.lng) {
                updateDriverOnMap(data);
            }
        });
        
        // Listen for driver online
        window.AppState.socket.on('driver-online', (data) => {
            console.log('🟢 Admin: Driver online:', data);
            updateOnlineDriverList({ ...data, status: 'online' });
            
            if (data.name) {
                showNotification(`Driver ${data.name} is now online`, 'success');
            }
        });
        
        // Listen for driver offline
        window.AppState.socket.on('driver-offline', (data) => {
            console.log('🔴 Admin: Driver offline:', data);
            onlineDrivers = onlineDrivers.filter(d => d.driverId !== data.driverId);
            updateOnlineDriversUI();
            removeMarker(`driver_${data.driverId}`);
            
            if (data.name) {
                showNotification(`Driver ${data.name} went offline`, 'warning');
            }
        });
        
        // Listen for trip updates
        window.AppState.socket.on('trip-updated', (data) => {
            console.log('📦 Trip updated:', data);
            
            // Refresh trip list
            setTimeout(loadAllTrips, 1000);
            
            if (data.status === 'completed') {
                showNotification(`Trip completed by ${data.driverName || 'driver'}`, 'success');
            }
        });
        
        // Request initial online drivers
        setTimeout(() => {
            if (window.AppState.socket) {
                window.AppState.socket.emit('get-online-drivers');
            }
        }, 2000);
        
        // Receive online drivers list
        window.AppState.socket.on('online-drivers-list', (drivers) => {
            console.log('👥 Online drivers list received:', drivers.length);
            onlineDrivers = drivers.map(d => ({
                driverId: d.driverId,
                name: d.name,
                status: d.status,
                lat: d.location?.lat,
                lng: d.location?.lng,
                lastUpdate: d.lastUpdate
            }));
            
            updateOnlineDriversUI();
            
            // Add all to map
            drivers.forEach(driver => {
                if (driver.location && driver.status !== 'offline') {
                    updateDriverOnMap({
                        driverId: driver.driverId,
                        name: driver.name,
                        lat: driver.location.lat,
                        lng: driver.location.lng,
                        status: driver.status
                    });
                }
            });
        });
    }
}

function updateOnlineDriverList(data) {
    const { driverId, name, status, lat, lng } = data;
    
    const existingIndex = onlineDrivers.findIndex(d => d.driverId === driverId);
    
    if (status === 'offline') {
        // Remove from list
        onlineDrivers = onlineDrivers.filter(d => d.driverId !== driverId);
    } else if (existingIndex >= 0) {
        // Update existing
        onlineDrivers[existingIndex] = {
            ...onlineDrivers[existingIndex],
            name: name || onlineDrivers[existingIndex].name,
            status: status || onlineDrivers[existingIndex].status,
            lat: lat || onlineDrivers[existingIndex].lat,
            lng: lng || onlineDrivers[existingIndex].lng,
            lastUpdate: new Date()
        };
    } else if (status === 'online' || status === 'busy' || status === 'available') {
        // Add new
        onlineDrivers.push({
            driverId,
            name: name || `Driver ${driverId?.substring(0, 6) || 'Unknown'}`,
            status: status || 'online',
            lat,
            lng,
            lastUpdate: new Date()
        });
    }
    
    updateOnlineDriversUI();
}

function updateOnlineDriversUI() {
    const listElement = document.getElementById('onlineDriversList');
    if (!listElement) return;
    
    if (onlineDrivers.length === 0) {
        listElement.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <i class="fas fa-motorcycle" style="font-size: 3rem; opacity: 0.3;"></i>
                <p>No drivers online</p>
                <small>Have drivers click "Go Online" in driver dashboard</small>
            </div>
        `;
        return;
    }
    
    listElement.innerHTML = onlineDrivers.map(driver => `
        <div class="driver-item" data-driver-id="${driver.driverId}" onclick="trackDriver('${driver.driverId}')" style="cursor: pointer;">
            <div class="driver-avatar" style="background: ${driver.status === 'online' ? '#4CAF50' : driver.status === 'busy' ? '#FF9800' : '#666'};">
                ${driver.name?.charAt(0) || 'D'}
            </div>
            <div>
                <strong>${driver.name || 'Unknown Driver'}</strong>
                <p style="font-size: 0.9rem; color: #666;">
                    ${driver.status || 'offline'} • ${driver.lat ? '📍 Live' : 'No location'}
                </p>
            </div>
            <div class="driver-status status-${driver.status || 'offline'}"></div>
        </div>
    `).join('');
}

window.showSection = function(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from all menu items
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
    
    // Add active class to clicked menu item
    event.target.closest('li').classList.add('active');
    
    // Initialize map if showing tracking
    if (sectionId === 'tracking') {
        setTimeout(() => {
            initTrackingMap();
        }, 100);
    }
}

async function loadDashboardData() {
    try {
        // Load stats
        if (typeof window.apiRequest === 'function') {
            const stats = await window.apiRequest('/admin/stats');
            
            if (document.getElementById('totalDrivers')) {
                document.getElementById('totalDrivers').textContent = stats.totalDrivers || '0';
            }
            if (document.getElementById('activeTrips')) {
                document.getElementById('activeTrips').textContent = stats.activeDeliveries || '0';
            }
            if (document.getElementById('dailyRevenue')) {
                document.getElementById('dailyRevenue').textContent = 'R' + (stats.todayRevenue || 0).toFixed(2);
            }
            if (document.getElementById('totalCustomers')) {
                document.getElementById('totalCustomers').textContent = stats.totalCustomers || '0';
            }
        }
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

async function loadAllDrivers() {
    try {
        if (typeof window.apiRequest === 'function') {
            const drivers = await window.apiRequest('/drivers/all');
            allDrivers = drivers;
            
            const tableBody = document.getElementById('driversTable');
            if (!tableBody) return;
            
            if (drivers.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                            No drivers registered
                        </td>
                    </tr>
                `;
                return;
            }
            
            tableBody.innerHTML = drivers.map(driver => `
                <tr>
                    <td>${(driver._id || driver.id)?.substring(0, 8) || 'N/A'}</td>
                    <td><strong>${driver.name || 'Unknown'}</strong></td>
                    <td>${driver.phone || 'N/A'}</td>
                    <td>${driver.vehicleType || 'N/A'}</td>
                    <td>
                        <span class="trip-status status-${driver.status || 'offline'}">
                            ${driver.status || 'offline'}
                        </span>
                    </td>
                    <td>${driver.totalTrips || 0}</td>
                    <td>R ${driver.totalEarnings?.toFixed(2) || '0.00'}</td>
                    <td>
                        <button class="btn" onclick="trackDriver('${driver._id || driver.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">
                            <i class="fas fa-map-marker-alt"></i> Track
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
    } catch (error) {
        console.error('Failed to load all drivers:', error);
    }
}

async function loadAllTrips() {
    try {
        if (typeof window.apiRequest === 'function') {
            const trips = await window.apiRequest('/trips');
            allTrips = trips;
            
            const tableBody = document.getElementById('tripsTable');
            if (!tableBody) return;
            
            if (trips.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 2rem; color: #666;">
                            No trips yet
                        </td>
                    </tr>
                `;
                return;
            }
            
            tableBody.innerHTML = trips.map(trip => `
                <tr>
                    <td>${trip.tripId?.substring(0, 8) || 'N/A'}</td>
                    <td>${trip.customerName || 'Customer'}</td>
                    <td>${trip.driverName || 'Not assigned'}</td>
                    <td>
                        ${(trip.pickup?.address || 'N/A').substring(0, 15)}... → 
                        ${(trip.destination?.address || 'N/A').substring(0, 15)}...
                    </td>
                    <td>${trip.distance || 0} km</td>
                    <td>R ${trip.fare?.toFixed(2) || '0.00'}</td>
                    <td><span class="trip-status status-${trip.status}">${trip.status}</span></td>
                    <td>${new Date(trip.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td>
                        <button class="btn" onclick="viewTripDetails('${trip._id || trip.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
    } catch (error) {
        console.error('Failed to load trips:', error);
    }
}

window.filterTrips = function() {
    const filter = document.getElementById('tripFilter')?.value;
    if (!filter || filter === 'all') {
        loadAllTrips();
        return;
    }
    
    const tableBody = document.getElementById('tripsTable');
    if (!tableBody) return;
    
    if (allTrips.length === 0) return;
    
    let filteredTrips = allTrips;
    
    if (filter === 'today') {
        const today = new Date().toDateString();
        filteredTrips = allTrips.filter(trip => 
            new Date(trip.createdAt).toDateString() === today
        );
    } else if (filter && filter !== 'all') {
        filteredTrips = allTrips.filter(trip => trip.status === filter);
    }
    
    tableBody.innerHTML = filteredTrips.map(trip => `
        <tr>
            <td>${trip.tripId?.substring(0, 8) || 'N/A'}</td>
            <td>${trip.customerName || 'Customer'}</td>
            <td>${trip.driverName || 'Not assigned'}</td>
            <td>
                ${(trip.pickup?.address || 'N/A').substring(0, 15)}... → 
                ${(trip.destination?.address || 'N/A').substring(0, 15)}...
            </td>
            <td>${trip.distance || 0} km</td>
            <td>R ${trip.fare?.toFixed(2) || '0.00'}</td>
            <td><span class="trip-status status-${trip.status}">${trip.status}</span></td>
            <td>${new Date(trip.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
            <td>
                <button class="btn" onclick="viewTripDetails('${trip._id || trip.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">
                    <i class="fas fa-eye"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

window.trackDriver = function(driverId) {
    console.log(`Tracking driver: ${driverId}`);
    
    // Find driver
    const driver = allDrivers.find(d => (d._id || d.id) === driverId) || 
                  onlineDrivers.find(d => d.driverId === driverId);
    
    if (driver) {
        showSection('tracking');
        
        setTimeout(() => {
            initTrackingMap();
            
            // Center on driver if location exists
            if (driver.currentLocation || (driver.lat && driver.lng)) {
                const lat = driver.currentLocation?.lat || driver.lat;
                const lng = driver.currentLocation?.lng || driver.lng;
                
                if (window.AppState && window.AppState.map) {
                    window.AppState.map.setView([lat, lng], 15);
                }
                
                // Show driver details
                showDriverDetails(driver);
            } else {
                // Show warehouse as default
                if (window.AppState && window.AppState.map) {
                    window.AppState.map.setView(APP_CONFIG.MAP_CENTER, 15);
                }
                showDriverDetails(driver);
            }
        }, 100);
    } else {
        showNotification('Driver not found', 'warning');
    }
}

window.initTrackingMap = function() {
    const mapElement = document.getElementById('trackingMap');
    if (!mapElement) return;
    
    // Remove existing map instance
    if (window.AppState && window.AppState.map && mapElement._leaflet_id) {
        window.AppState.map.remove();
    }
    
    // Initialize new map
    if (typeof window.initMap === 'function') {
        window.initMap('trackingMap');
    }
    
    // Add all drivers to map
    const allDriversToShow = [...allDrivers, ...onlineDrivers.map(od => ({
        _id: od.driverId,
        id: od.driverId,
        name: od.name,
        status: od.status,
        currentLocation: od.lat && od.lng ? { lat: od.lat, lng: od.lng } : null
    }))];
    
    allDriversToShow.forEach(driver => {
        if ((driver.currentLocation || (driver.lat && driver.lng)) && typeof window.addMarker === 'function') {
            const lat = driver.currentLocation?.lat || driver.lat;
            const lng = driver.currentLocation?.lng || driver.lng;
            
            const marker = window.addMarker(`track_${driver._id || driver.id}`, 
                [lat, lng],
                {
                    title: `${driver.name} (${driver.status})`,
                    icon: L.divIcon({
                        html: `<div style="background: ${driver.status === 'online' || driver.status === 'available' ? 'green' : 
                               driver.status === 'busy' ? 'orange' : 'gray'}; 
                               width: 30px; height: 30px; border-radius: 50%; border: 3px solid white;
                               display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">
                               ${driver.name?.charAt(0) || 'D'}</div>`,
                        className: 'tracking-marker'
                    })
                }
            );
            
            // Add click event to show driver details
            if (marker) {
                marker.on('click', () => {
                    showDriverDetails(driver);
                });
            }
        }
    });
    
    // Fit map to show all drivers
    if (window.AppState && window.AppState.map && Object.keys(window.AppState.markers).length > 0) {
        const markers = Object.values(window.AppState.markers);
        const group = new L.featureGroup(markers);
        window.AppState.map.fitBounds(group.getBounds().pad(0.1));
    }
}

window.centerAllDrivers = function() {
    if (window.AppState && window.AppState.map && Object.keys(window.AppState.markers).length > 0) {
        const markers = Object.values(window.AppState.markers);
        const group = new L.featureGroup(markers);
        window.AppState.map.fitBounds(group.getBounds().pad(0.1));
    }
}

window.showDriverDetails = function(driver) {
    const infoElement = document.getElementById('selectedDriverInfo');
    if (!infoElement) return;
    
    // Find if driver is online
    const onlineDriver = onlineDrivers.find(d => d.driverId === (driver._id || driver.id));
    
    infoElement.innerHTML = `
        <h4>${driver.name || 'Unknown Driver'}</h4>
        <p><strong>Status:</strong> <span class="trip-status status-${onlineDriver?.status || driver.status || 'offline'}">
            ${onlineDriver?.status || driver.status || 'offline'}
        </span></p>
        <p><strong>Phone:</strong> ${driver.phone || 'N/A'}</p>
        <p><strong>Vehicle:</strong> ${driver.vehicleType || 'N/A'}</p>
        <p><strong>Total Trips:</strong> ${driver.totalTrips || 0}</p>
        <p><strong>Total Earnings:</strong> R${driver.totalEarnings?.toFixed(2) || '0.00'}</p>
        <p><strong>Current Location:</strong> ${(driver.currentLocation || (driver.lat && driver.lng)) ? '📍 Live Tracking' : 'Not available'}</p>
        <p><strong>Last Update:</strong> ${new Date(driver.lastUpdate || Date.now()).toLocaleTimeString()}</p>
        
        <div style="margin-top: 1rem;">
            <button class="btn" onclick="sendMessageToDriver('${driver._id || driver.id}')">
                <i class="fas fa-comment"></i> Send Message
            </button>
            <button class="btn" onclick="viewDriverTrips('${driver._id || driver.id}')">
                <i class="fas fa-history"></i> View Trips
            </button>
        </div>
    `;
}

window.showAddDriverModal = function() {
    const modal = document.getElementById('addDriverModal');
    if (modal) {
        modal.classList.add('active');
    }
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

window.saveDriver = async function() {
    const driverData = {
        name: document.getElementById('driverNameInput').value,
        email: document.getElementById('driverEmailInput').value,
        phone: document.getElementById('driverPhoneInput').value,
        vehicleType: document.getElementById('driverVehicleInput').value,
        vehicleNumber: document.getElementById('driverVehicleNoInput').value,
        ratePerKm: parseInt(document.getElementById('driverRateInput').value),
        status: 'offline'
    };
    
    if (!driverData.name || !driverData.email || !driverData.phone) {
        showNotification('Please fill all required fields', 'error');
        return;
    }
    
    try {
        if (typeof window.apiRequest === 'function') {
            await window.apiRequest('/drivers', {
                method: 'POST',
                body: JSON.stringify(driverData)
            });
            
            showNotification('Driver added successfully', 'success');
            closeModal('addDriverModal');
            
            // Clear form
            document.getElementById('driverNameInput').value = '';
            document.getElementById('driverEmailInput').value = '';
            document.getElementById('driverPhoneInput').value = '';
            document.getElementById('driverVehicleNoInput').value = '';
            
            // Reload drivers list
            await loadAllDrivers();
        }
        
    } catch (error) {
        console.error('Failed to add driver:', error);
        showNotification('Failed to add driver', 'error');
    }
}

window.viewTripDetails = function(tripId) {
    const trip = allTrips.find(t => (t._id || t.id) === tripId);
    if (trip) {
        alert(`Trip Details:\n
ID: ${trip.tripId}\n
Customer: ${trip.customerName}\n
Driver: ${trip.driverName || 'Not assigned'}\n
From: ${trip.pickup?.address || 'N/A'}\n
To: ${trip.destination?.address || 'N/A'}\n
Distance: ${trip.distance} km\n
Fare: R${trip.fare?.toFixed(2)}\n
Status: ${trip.status}\n
Created: ${new Date(trip.createdAt).toLocaleString()}`);
    }
}

window.sendMessageToDriver = function(driverId) {
    const message = prompt('Enter message to send to driver:');
    if (message) {
        showNotification(`Message sent to driver: "${message}"`, 'success');
    }
}

window.viewDriverTrips = function(driverId) {
    const driverTrips = allTrips.filter(trip => trip.driverId === driverId);
    
    let message = `Driver Trips (${driverTrips.length}):\n\n`;
    driverTrips.forEach((trip, index) => {
        message += `${index + 1}. ${trip.tripId}: ${trip.status} - R${trip.fare?.toFixed(2)}\n`;
    });
    
    alert(message);
}

window.refreshData = function() {
    loadDashboardData();
    loadAllDrivers();
    loadAllTrips();
    showNotification('Data refreshed', 'success');
}

window.exportTrips = function() {
    if (allTrips.length === 0) {
        showNotification('No trips to export', 'warning');
        return;
    }
    
    const csv = convertToCSV(allTrips);
    downloadCSV(csv, 'swiftride_trips.csv');
    showNotification('Trips exported to CSV', 'success');
}

function convertToCSV(data) {
    const headers = ['Trip ID', 'Customer', 'Driver', 'Pickup', 'Destination', 'Distance', 'Fare', 'Status', 'Date'];
    const rows = data.map(trip => [
        trip.tripId,
        trip.customerName,
        trip.driverName || 'N/A',
        trip.pickup?.address || 'N/A',
        trip.destination?.address || 'N/A',
        trip.distance,
        trip.fare,
        trip.status,
        new Date(trip.createdAt).toLocaleDateString()
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

window.logout = function() {
    localStorage.removeItem('swiftride_user');
    showNotification('Logged out successfully', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
};

// Make functions globally available
window.updateOnlineDriversUI = updateOnlineDriversUI;