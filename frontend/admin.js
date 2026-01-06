let allDrivers = [];
let allTrips = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize admin dashboard
    if (!AppState.user || AppState.user.type !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    // Initialize map
    initMap('adminMap');
    
    // Load data
    await loadDashboardData();
    await loadAllDrivers();
    await loadAllTrips();
    
    // Start live updates
    startLiveUpdates();
});

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from all menu items
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).style.display = 'block';
    
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
        const stats = await apiRequest('/trips/stats/daily');
        
        document.getElementById('totalDrivers').textContent = '25';
        document.getElementById('activeTrips').textContent = stats.pending || 0;
        document.getElementById('dailyRevenue').textContent = 'R' + (stats.revenue || 0).toFixed(2);
        document.getElementById('totalCustomers').textContent = '150';
        
        // Load online drivers
        await loadOnlineDrivers();
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

async function loadOnlineDrivers() {
    try {
        const drivers = await getAvailableDrivers();
        const listElement = document.getElementById('onlineDriversList');
        
        if (drivers.length === 0) {
            listElement.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #666;">
                    <i class="fas fa-motorcycle" style="font-size: 3rem; opacity: 0.3;"></i>
                    <p>No drivers online</p>
                </div>
            `;
            return;
        }
        
        listElement.innerHTML = drivers.map(driver => `
            <div class="driver-item">
                <div class="driver-avatar">${driver.name?.charAt(0) || 'D'}</div>
                <div>
                    <strong>${driver.name}</strong>
                    <p style="font-size: 0.9rem; color: #666;">${driver.vehicleType || 'Vehicle'}</p>
                </div>
                <div class="driver-status status-${driver.status || 'offline'}"></div>
            </div>
        `).join('');
        
        // Add markers to map
        drivers.forEach(driver => {
            if (driver.currentLocation) {
                addMarker(`driver_${driver._id}`, 
                    [driver.currentLocation.lat, driver.currentLocation.lng],
                    {
                        title: driver.name,
                        icon: L.divIcon({
                            html: `<div style="background: ${driver.status === 'available' ? 'green' : 'orange'}; 
                                   width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
                            className: 'driver-marker'
                        })
                    }
                );
            }
        });
        
        // Fit map to show all drivers
        const markers = Object.values(AppState.markers);
        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            AppState.map.fitBounds(group.getBounds().pad(0.1));
        }
        
    } catch (error) {
        console.error('Failed to load online drivers:', error);
    }
}

async function loadAllDrivers() {
    try {
        const drivers = await apiRequest('/drivers/all');
        allDrivers = drivers;
        
        const tableBody = document.getElementById('driversTable');
        
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
                <td>${driver._id?.substring(0, 8) || 'N/A'}</td>
                <td><strong>${driver.name}</strong></td>
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
                    <button class="btn" onclick="trackDriver('${driver._id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">
                        <i class="fas fa-map-marker-alt"></i> Track
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load all drivers:', error);
    }
}

async function loadAllTrips() {
    try {
        const trips = await apiRequest('/trips');
        allTrips = trips;
        
        const tableBody = document.getElementById('tripsTable');
        
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
        
        // Filter for today if needed
        let filteredTrips = trips;
        const filter = document.getElementById('tripFilter')?.value;
        if (filter === 'today') {
            const today = new Date().toDateString();
            filteredTrips = trips.filter(trip => 
                new Date(trip.createdAt).toDateString() === today
            );
        } else if (filter && filter !== 'all') {
            filteredTrips = trips.filter(trip => trip.status === filter);
        }
        
        tableBody.innerHTML = filteredTrips.map(trip => `
            <tr>
                <td>${trip.tripId?.substring(0, 8) || 'N/A'}</td>
                <td>${trip.customerName || 'Customer'}</td>
                <td>${trip.driverName || 'Not assigned'}</td>
                <td>
                    ${trip.pickup?.address?.substring(0, 15) || 'N/A'}... → 
                    ${trip.destination?.address?.substring(0, 15) || 'N/A'}...
                </td>
                <td>${trip.distance || 0} km</td>
                <td>R ${trip.fare?.toFixed(2) || '0.00'}</td>
                <td><span class="trip-status status-${trip.status}">${trip.status}</span></td>
                <td>${new Date(trip.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td>
                    <button class="btn" onclick="viewTripDetails('${trip._id}')" style="padding: 0.3rem 0.8rem; font-size: 0.9rem;">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load trips:', error);
    }
}

function filterTrips() {
    loadAllTrips();
}

function initTrackingMap() {
    const mapElement = document.getElementById('trackingMap');
    if (!mapElement) return;
    
    // Remove existing map instance
    if (AppState.map && mapElement._leaflet_id) {
        AppState.map.remove();
    }
    
    // Initialize new map
    initMap('trackingMap');
    
    // Add all drivers to map
    allDrivers.forEach(driver => {
        if (driver.currentLocation) {
            const marker = addMarker(`track_${driver._id}`, 
                [driver.currentLocation.lat, driver.currentLocation.lng],
                {
                    title: `${driver.name} (${driver.status})`,
                    icon: L.divIcon({
                        html: `<div style="background: ${driver.status === 'available' ? 'green' : 
                               driver.status === 'busy' ? 'orange' : 'gray'}; 
                               width: 25px; height: 25px; border-radius: 50%; border: 3px solid white;
                               display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                               ${driver.name?.charAt(0) || 'D'}</div>`,
                        className: 'tracking-marker'
                    })
                }
            );
            
            // Add click event to show driver details
            marker.on('click', () => {
                showDriverDetails(driver);
            });
        }
    });
    
    // Fit map to show all drivers
    const markers = Object.values(AppState.markers);
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        AppState.map.fitBounds(group.getBounds().pad(0.1));
    }
}

function centerAllDrivers() {
    const markers = Object.values(AppState.markers);
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        AppState.map.fitBounds(group.getBounds().pad(0.1));
    }
}

function showDriverDetails(driver) {
    const infoElement = document.getElementById('selectedDriverInfo');
    
    infoElement.innerHTML = `
        <h4>${driver.name}</h4>
        <p><strong>Status:</strong> <span class="trip-status status-${driver.status}">${driver.status}</span></p>
        <p><strong>Phone:</strong> ${driver.phone || 'N/A'}</p>
        <p><strong>Vehicle:</strong> ${driver.vehicleType || 'N/A'} (${driver.vehicleNumber || 'N/A'})</p>
        <p><strong>Rate:</strong> R${driver.ratePerKm || 10}/km</p>
        <p><strong>Total Trips:</strong> ${driver.totalTrips || 0}</p>
        <p><strong>Total Earnings:</strong> R${driver.totalEarnings?.toFixed(2) || '0.00'}</p>
        <p><strong>Last Active:</strong> ${new Date(driver.lastActive).toLocaleTimeString()}</p>
        
        <div style="margin-top: 1rem;">
            <button class="btn" onclick="sendMessageToDriver('${driver._id}')">
                <i class="fas fa-comment"></i> Send Message
            </button>
            <button class="btn" onclick="viewDriverTrips('${driver._id}')">
                <i class="fas fa-history"></i> View Trips
            </button>
        </div>
    `;
}

function trackDriver(driverId) {
    const driver = allDrivers.find(d => d._id === driverId);
    if (driver && driver.currentLocation) {
        showSection('tracking');
        
        setTimeout(() => {
            if (AppState.map) {
                AppState.map.setView([driver.currentLocation.lat, driver.currentLocation.lng], 15);
                showDriverDetails(driver);
            }
        }, 100);
    }
}

function showAddDriverModal() {
    document.getElementById('addDriverModal').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function saveDriver() {
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
        await apiRequest('/drivers', {
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
        
    } catch (error) {
        showNotification('Failed to add driver: ' + error.message, 'error');
    }
}

function viewTripDetails(tripId) {
    const trip = allTrips.find(t => t._id === tripId);
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

function sendMessageToDriver(driverId) {
    const message = prompt('Enter message to send to driver:');
    if (message) {
        showNotification(`Message sent to driver: "${message}"`, 'success');
    }
}

function viewDriverTrips(driverId) {
    const driverTrips = allTrips.filter(trip => trip.driverId === driverId);
    
    let message = `Driver Trips (${driverTrips.length}):\n\n`;
    driverTrips.forEach((trip, index) => {
        message += `${index + 1}. ${trip.tripId}: ${trip.status} - R${trip.fare?.toFixed(2)}\n`;
    });
    
    alert(message);
}

function refreshData() {
    loadDashboardData();
    loadAllDrivers();
    loadAllTrips();
    showNotification('Data refreshed', 'success');
}

function exportTrips() {
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
    a.click();
    window.URL.revokeObjectURL(url);
}

function startLiveUpdates() {
    // Listen for real-time updates
    if (AppState.socket) {
        AppState.socket.on('driver-update', (data) => {
            // Update driver on map
            updateDriverOnMap(data);
            
            // Update driver in list if showing
            const driverItem = document.querySelector(`[data-driver-id="${data.driverId}"]`);
            if (driverItem) {
                const statusElement = driverItem.querySelector('.driver-status');
                if (statusElement) {
                    statusElement.className = `driver-status status-${data.status}`;
                }
            }
        });
        
        AppState.socket.on('trip-updated', (data) => {
            // Refresh trips if showing
            if (document.getElementById('trips').style.display !== 'none') {
                loadAllTrips();
            }
        });
    }
}