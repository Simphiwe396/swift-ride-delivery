// ===== ADMIN PAGE SPECIFIC FUNCTIONS =====

let allDrivers = [];
let allTrips = [];
let onlineDrivers = [];
let trackingHistory = [];

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
    await loadDriverFilterOptions();
    
    // Setup socket listeners
    setupSocketListeners();
    
    // Hide loading screen
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 1000);
});

// Replace the setupSocketListeners function in admin.js with this:

function setupSocketListeners() {
    if (window.AppState && window.AppState.socket) {
        window.AppState.socket.on('driver-connected', (data) => {
            console.log('🟢 Admin: Driver connected:', data);
            updateOnlineDriverList({ ...data, status: 'online' });
            updateDriverOnMap(data);
            showNotification(`Driver ${data.name} is now online`, 'success');
        });
        
        window.AppState.socket.on('driver-update', (data) => {
            console.log('📍 Admin: Driver location:', data);
            updateOnlineDriverList(data);
            updateDriverOnMap(data);
        });
        
        window.AppState.socket.on('driver-status', (data) => {
            console.log('🔄 Admin: Driver status:', data);
            updateOnlineDriverList(data);
        });
        
        window.AppState.socket.on('driver-offline', (data) => {
            console.log('🔴 Admin: Driver offline:', data);
            onlineDrivers = onlineDrivers.filter(d => d.driverId !== data.driverId);
            updateOnlineDriversUI();
            removeMarker(`driver_${data.driverId}`);
            showNotification(`Driver ${data.name} went offline`, 'warning');
        });
        
        window.AppState.socket.on('online-drivers', (drivers) => {
            console.log('👥 Admin received online drivers:', drivers.length);
            onlineDrivers = drivers;
            updateOnlineDriversUI();
            
            drivers.forEach(driver => {
                if (driver.lat && driver.lng) {
                    updateDriverOnMap({
                        driverId: driver.driverId,
                        name: driver.name,
                        lat: driver.lat,
                        lng: driver.lng,
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
        onlineDrivers = onlineDrivers.filter(d => d.driverId !== driverId);
    } else if (existingIndex >= 0) {
        onlineDrivers[existingIndex] = {
            ...onlineDrivers[existingIndex],
            name: name || onlineDrivers[existingIndex].name,
            status: status || onlineDrivers[existingIndex].status,
            lat: lat || onlineDrivers[existingIndex].lat,
            lng: lng || onlineDrivers[existingIndex].lng,
            lastUpdate: new Date()
        };
    } else if (status === 'online' || status === 'busy' || status === 'available') {
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
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.classList.remove('active');
    });
    
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
    
    event.target.closest('li').classList.add('active');
    
    if (sectionId === 'tracking') {
        setTimeout(() => {
            initTrackingMap();
        }, 100);
    } else if (sectionId === 'history') {
        setTimeout(() => {
            loadTrackingHistory();
        }, 100);
    }
}

async function loadDashboardData() {
    try {
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
                        <td colspan="9" style="text-align: center; padding: 2rem; color: #666;">
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
                    <td>${driver.vehicleType || 'N/A'} (${driver.vehicleNumber || 'N/A'})</td>
                    <td>
                        <span class="trip-status status-${driver.status || 'offline'}">
                            ${driver.status || 'offline'}
                        </span>
                    </td>
                    <td>${driver.totalTrips || 0}</td>
                    <td>R ${driver.totalEarnings?.toFixed(2) || '0.00'}</td>
                    <td>${driver.rating || '5.0'}</td>
                    <td>
                        <button class="btn" onclick="viewDriverDetails('${driver._id || driver.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem; margin: 0.2rem;">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn" onclick="trackDriver('${driver._id || driver.id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem; margin: 0.2rem;">
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

async function loadTrackingHistory() {
    try {
        const driverId = document.getElementById('historyDriverFilter')?.value;
        const date = document.getElementById('historyDateFilter')?.value;
        
        let url = 'https://swift-ride.onrender.com/api/tracking/history?limit=100';
        if (driverId && driverId !== 'all') url += `&driverId=${driverId}`;
        if (date) url += `&date=${date}`;
        
        const response = await fetch(url);
        trackingHistory = await response.json();
        
        const tableBody = document.getElementById('trackingHistoryTable');
        if (!tableBody) return;
        
        if (trackingHistory.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #666;">
                        No tracking history found
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = trackingHistory.map(track => `
            <tr>
                <td>${new Date(track.timestamp).toLocaleString()}</td>
                <td><strong>${track.driverName}</strong></td>
                <td>${track.location?.lat?.toFixed(4)}, ${track.location?.lng?.toFixed(4)}</td>
                <td>${track.speed || 0} km/h</td>
                <td><span class="trip-status status-${track.status}">${track.status}</span></td>
                <td>${track.batteryLevel || 100}%</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading tracking history:', error);
        showNotification('Failed to load tracking history', 'error');
    }
}

async function loadDriverFilterOptions() {
    try {
        const drivers = await window.apiRequest('/drivers/all');
        const filterSelect = document.getElementById('historyDriverFilter');
        
        if (filterSelect && drivers.length > 0) {
            // Keep "All Drivers" option
            const allOption = filterSelect.querySelector('option[value="all"]');
            filterSelect.innerHTML = '';
            filterSelect.appendChild(allOption);
            
            // Add driver options
            drivers.forEach(driver => {
                const option = document.createElement('option');
                option.value = driver._id || driver.id;
                option.textContent = driver.name || `Driver ${(driver._id || driver.id).substring(0, 8)}`;
                filterSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading driver filter options:', error);
    }
}

window.showAddDriverModal = function() {
    const modal = document.getElementById('addDriverModal');
    if (modal) {
        modal.classList.add('active');
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
};

window.saveDriver = async function() {
    // Get all form values
    const driverData = {
        name: document.getElementById('driverNameInput').value.trim(),
        email: document.getElementById('driverEmailInput').value.trim(),
        phone: document.getElementById('driverPhoneInput').value.trim(),
        idNumber: document.getElementById('driverIdInput').value.trim(),
        vehicleType: document.getElementById('driverVehicleInput').value,
        vehicleNumber: document.getElementById('driverVehicleNoInput').value.trim(),
        ratePerKm: parseInt(document.getElementById('driverRateInput').value),
        rating: parseFloat(document.getElementById('driverRatingInput').value),
        address: document.getElementById('driverAddressInput').value.trim(),
        emergencyContact: document.getElementById('driverEmergencyInput').value.trim(),
        notes: document.getElementById('driverNotesInput').value.trim(),
        status: 'offline'
    };
    
    // Validation
    if (!driverData.name || !driverData.email || !driverData.phone || !driverData.idNumber || 
        !driverData.vehicleType || !driverData.vehicleNumber || !driverData.ratePerKm) {
        showNotification('Please fill in all required fields (*)', 'error');
        return;
    }
    
    if (!driverData.email.includes('@')) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    if (driverData.phone.length < 10) {
        showNotification('Please enter a valid phone number', 'error');
        return;
    }
    
    try {
        showNotification('Adding driver...', 'info');
        
        const response = await fetch('https://swift-ride.onrender.com/api/drivers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(driverData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification('Driver added successfully!', 'success');
            closeModal('addDriverModal');
            
            // Clear form
            document.getElementById('driverNameInput').value = '';
            document.getElementById('driverEmailInput').value = '';
            document.getElementById('driverPhoneInput').value = '';
            document.getElementById('driverIdInput').value = '';
            document.getElementById('driverVehicleInput').value = '';
            document.getElementById('driverVehicleNoInput').value = '';
            document.getElementById('driverAddressInput').value = '';
            document.getElementById('driverEmergencyInput').value = '';
            document.getElementById('driverNotesInput').value = '';
            
            // Reload drivers list
            await loadAllDrivers();
            await loadDriverFilterOptions();
            
        } else {
            showNotification(result.error || 'Failed to add driver', 'error');
        }
        
    } catch (error) {
        console.error('Failed to add driver:', error);
        showNotification('Failed to add driver: ' + error.message, 'error');
    }
};

window.viewDriverDetails = async function(driverId) {
    try {
        const driver = allDrivers.find(d => (d._id || d.id) === driverId);
        if (!driver) {
            showNotification('Driver not found', 'error');
            return;
        }
        
        const modal = document.getElementById('viewDriverModal');
        const content = document.getElementById('driverDetailsContent');
        
        content.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="color: #333; margin-bottom: 1rem;">${driver.name}</h3>
                <div style="display: flex; gap: 2rem; margin-bottom: 1rem;">
                    <div>
                        <p><strong>Status:</strong> <span class="trip-status status-${driver.status || 'offline'}">${driver.status || 'offline'}</span></p>
                        <p><strong>Phone:</strong> ${driver.phone || 'N/A'}</p>
                        <p><strong>Email:</strong> ${driver.email || 'N/A'}</p>
                    </div>
                    <div>
                        <p><strong>Vehicle:</strong> ${driver.vehicleType || 'N/A'} (${driver.vehicleNumber || 'N/A'})</p>
                        <p><strong>Rate:</strong> R${driver.ratePerKm || 10}/km</p>
                        <p><strong>Rating:</strong> ${driver.rating || '5.0'}/5.0</p>
                    </div>
                </div>
                
                <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <p><strong>Performance Stats:</strong></p>
                    <div style="display: flex; gap: 1.5rem;">
                        <div>
                            <p style="color: #666;">Total Trips</p>
                            <p style="font-size: 1.5rem; font-weight: bold; color: #6C63FF;">${driver.totalTrips || 0}</p>
                        </div>
                        <div>
                            <p style="color: #666;">Total Earnings</p>
                            <p style="font-size: 1.5rem; font-weight: bold; color: #4CAF50;">R${driver.totalEarnings?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div>
                            <p style="color: #666;">Joined Date</p>
                            <p style="font-size: 1rem; color: #666;">${new Date(driver.joinedDate).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
                
                ${driver.address ? `<p><strong>Address:</strong> ${driver.address}</p>` : ''}
                ${driver.emergencyContact ? `<p><strong>Emergency Contact:</strong> ${driver.emergencyContact}</p>` : ''}
                ${driver.notes ? `<p><strong>Notes:</strong> ${driver.notes}</p>` : ''}
            </div>
        `;
        
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Error viewing driver details:', error);
        showNotification('Failed to load driver details', 'error');
    }
};

window.exportTrackingHistory = function() {
    if (trackingHistory.length === 0) {
        showNotification('No tracking history to export', 'warning');
        return;
    }
    
    const csv = convertTrackingToCSV(trackingHistory);
    downloadCSV(csv, `swiftride_tracking_${new Date().toISOString().split('T')[0]}.csv`);
    showNotification('Tracking history exported to CSV', 'success');
};

function convertTrackingToCSV(data) {
    const headers = ['Timestamp', 'Driver Name', 'Driver ID', 'Latitude', 'Longitude', 'Speed (km/h)', 'Status', 'Battery Level'];
    const rows = data.map(track => [
        new Date(track.timestamp).toLocaleString(),
        track.driverName,
        track.driverId,
        track.location?.lat || 0,
        track.location?.lng || 0,
        track.speed || 0,
        track.status,
        track.batteryLevel || 100
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Keep existing functions for tracking, trips, etc.
window.trackDriver = function(driverId) {
    const driver = allDrivers.find(d => (d._id || d.id) === driverId) || 
                  onlineDrivers.find(d => d.driverId === driverId);
    
    if (driver) {
        showSection('tracking');
        
        setTimeout(() => {
            initTrackingMap();
            
            if (driver.currentLocation || (driver.lat && driver.lng)) {
                const lat = driver.currentLocation?.lat || driver.lat;
                const lng = driver.currentLocation?.lng || driver.lng;
                
                if (window.AppState && window.AppState.map) {
                    window.AppState.map.setView([lat, lng], 15);
                }
                
                showDriverDetails(driver);
            } else {
                if (window.AppState && window.AppState.map) {
                    window.AppState.map.setView(APP_CONFIG.MAP_CENTER, 15);
                }
                showDriverDetails(driver);
            }
        }, 100);
    } else {
        showNotification('Driver not found', 'warning');
    }
};

window.initTrackingMap = function() {
    const mapElement = document.getElementById('trackingMap');
    if (!mapElement) return;
    
    if (window.AppState && window.AppState.map && mapElement._leaflet_id) {
        window.AppState.map.remove();
    }
    
    if (typeof window.initMap === 'function') {
        window.initMap('trackingMap');
    }
    
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
            
            if (marker) {
                marker.on('click', () => {
                    showDriverDetails(driver);
                });
            }
        }
    });
    
    if (window.AppState && window.AppState.map && Object.keys(window.AppState.markers).length > 0) {
        const markers = Object.values(window.AppState.markers);
        const group = new L.featureGroup(markers);
        window.AppState.map.fitBounds(group.getBounds().pad(0.1));
    }
};

window.centerAllDrivers = function() {
    if (window.AppState && window.AppState.map && Object.keys(window.AppState.markers).length > 0) {
        const markers = Object.values(window.AppState.markers);
        const group = new L.featureGroup(markers);
        window.AppState.map.fitBounds(group.getBounds().pad(0.1));
    }
};

window.showDriverDetails = function(driver) {
    const infoElement = document.getElementById('selectedDriverInfo');
    if (!infoElement) return;
    
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
        <p><strong>Last Update:</strong> ${new Date(driver.lastActive || Date.now()).toLocaleTimeString()}</p>
        
        <div style="margin-top: 1rem;">
            <button class="btn" onclick="viewDriverDetails('${driver._id || driver.id}')">
                <i class="fas fa-eye"></i> Full Details
            </button>
            <button class="btn" onclick="sendMessageToDriver('${driver._id || driver.id}')">
                <i class="fas fa-comment"></i> Message
            </button>
        </div>
    `;
};

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
Created: ${new Date(trip.createdAt).toLocaleString()}
${trip.tripDuration ? `\nDuration: ${trip.tripDuration} minutes` : ''}`);
    }
};

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
};

window.exportTrips = function() {
    if (allTrips.length === 0) {
        showNotification('No trips to export', 'warning');
        return;
    }
    
    const csv = convertToCSV(allTrips);
    downloadCSV(csv, 'swiftride_trips.csv');
    showNotification('Trips exported to CSV', 'success');
};

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

window.refreshData = function() {
    loadDashboardData();
    loadAllDrivers();
    loadAllTrips();
    loadTrackingHistory();
    showNotification('All data refreshed', 'success');
};

window.logout = function() {
    localStorage.removeItem('swiftride_user');
    showNotification('Logged out successfully', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
};

// Make functions globally available
window.updateOnlineDriversUI = updateOnlineDriversUI;