// ===== ADMIN PAGE SPECIFIC FUNCTIONS =====

let allDrivers = [];
let allTrips = [];

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
        
        // Update admin name
        document.getElementById('customerName').textContent = user.name;
        
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
        
        // Load online drivers
        await loadOnlineDrivers();
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        if (typeof window.showNotification === 'function') {
            window.showNotification('Failed to load dashboard data', 'error');
        }
    }
}

async function loadOnlineDrivers() {
    try {
        if (typeof window.getAvailableDrivers === 'function') {
            const drivers = await window.getAvailableDrivers();
            const listElement = document.getElementById('onlineDriversList');
            
            if (!listElement) return;
            
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
                <div class="driver-item" data-driver-id="${driver._id || driver.id}">
                    <div class="driver-avatar">${driver.name?.charAt(0) || 'D'}</div>
                    <div>
                        <strong>${driver.name || 'Unknown Driver'}</strong>
                        <p style="font-size: 0.9rem; color: #666;">${driver.vehicleType || 'Vehicle'}</p>
                    </div>
                    <div class="driver-status status-${driver.status || 'offline'}"></div>
                </div>
            `).join('');
            
            // Add markers to map if map exists
            if (window.AppState && window.AppState.map) {
                drivers.forEach(driver => {
                    if (driver.currentLocation && typeof window.addMarker === 'function') {
                        window.addMarker(`driver_${driver._id || driver.id}`, 
                            [driver.currentLocation.lat, driver.currentLocation.lng],
                            {
                                title: driver.name || 'Driver',
                                icon: L.divIcon({
                                    html: `<div style="background: ${driver.status === 'available' ? 'green' : 'orange'}; 
                                           width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
                                    className: 'driver-marker'
                                })
                            }
                        );
                    }
                });
            }
        }
        
    } catch (error) {
        console.error('Failed to load online drivers:', error);
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

function filterTrips() {
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

// Define trackDriver function
function trackDriver(driverId) {
    console.log(`Tracking driver: ${driverId}`);
    const driver = allDrivers.find(d => (d._id || d.id) === driverId);
    
    if (driver && driver.currentLocation) {
        showSection('tracking');
        
        setTimeout(() => {
            initTrackingMap();
            
            if (driver.currentLocation) {
                // Center map on driver
                if (window.AppState && window.AppState.map) {
                    window.AppState.map.setView([driver.currentLocation.lat, driver.currentLocation.lng], 15);
                }
                
                // Show driver details
                showDriverDetails(driver);
            }
        }, 100);
    } else {
        if (typeof window.showNotification === 'function') {
            window.showNotification('Driver location not available', 'warning');
        }
    }
}

function initTrackingMap() {
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
    allDrivers.forEach(driver => {
        if (driver.currentLocation && typeof window.addMarker === 'function') {
            const marker = window.addMarker(`track_${driver._id || driver.id}`, 
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

function centerAllDrivers() {
    if (window.AppState && window.AppState.map && Object.keys(window.AppState.markers).length > 0) {
        const markers = Object.values(window.AppState.markers);
        const group = new L.featureGroup(markers);
        window.AppState.map.fitBounds(group.getBounds().pad(0.1));
    }
}

function showDriverDetails(driver) {
    const infoElement = document.getElementById('selectedDriverInfo');
    if (!infoElement) return;
    
    infoElement.innerHTML = `
        <h4>${driver.name || 'Unknown Driver'}</h4>
        <p><strong>Status:</strong> <span class="trip-status status-${driver.status || 'offline'}">${driver.status || 'offline'}</span></p>
        <p><strong>Phone:</strong> ${driver.phone || 'N/A'}</p>
        <p><strong>Vehicle:</strong> ${driver.vehicleType || 'N/A'} (${driver.vehicleNumber || 'N/A'})</p>
        <p><strong>Rate:</strong> R${driver.ratePerKm || 10}/km</p>
        <p><strong>Total Trips:</strong> ${driver.totalTrips || 0}</p>
        <p><strong>Total Earnings:</strong> R${driver.totalEarnings?.toFixed(2) || '0.00'}</p>
        <p><strong>Last Active:</strong> ${new Date(driver.lastActive || Date.now()).toLocaleTimeString()}</p>
        
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

function showAddDriverModal() {
    const modal = document.getElementById('addDriverModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
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
        if (typeof window.showNotification === 'function') {
            window.showNotification('Please fill all required fields', 'error');
        }
        return;
    }
    
    try {
        if (typeof window.apiRequest === 'function') {
            await window.apiRequest('/drivers', {
                method: 'POST',
                body: JSON.stringify(driverData)
            });
            
            if (typeof window.showNotification === 'function') {
                window.showNotification('Driver added successfully', 'success');
            }
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
        if (typeof window.showNotification === 'function') {
            window.showNotification('Failed to add driver', 'error');
        }
    }
}

function viewTripDetails(tripId) {
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

function sendMessageToDriver(driverId) {
    const message = prompt('Enter message to send to driver:');
    if (message && typeof window.showNotification === 'function') {
        window.showNotification(`Message sent to driver: "${message}"`, 'success');
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
    if (typeof window.showNotification === 'function') {
        window.showNotification('Data refreshed', 'success');
    }
}

function exportTrips() {
    if (allTrips.length === 0) {
        if (typeof window.showNotification === 'function') {
            window.showNotification('No trips to export', 'warning');
        }
        return;
    }
    
    const csv = convertToCSV(allTrips);
    downloadCSV(csv, 'swiftride_trips.csv');
    if (typeof window.showNotification === 'function') {
        window.showNotification('Trips exported to CSV', 'success');
    }
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

// Make trackDriver available globally
window.trackDriver = trackDriver;