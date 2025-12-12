// ===== ADMIN DASHBOARD FUNCTIONS =====

// Global variables for admin dashboard
let adminMap = null;
let driverMarkers = new Map();
let revenueChart = null;
let deliveryChart = null;

// Initialize admin dashboard
async function loadDashboardData() {
    try {
        // Load quick stats
        const stats = await API.request('/admin/stats');
        updateQuickStats(stats);
        
        // Load active drivers
        const drivers = await API.request('/drivers?status=active');
        renderActiveDrivers(drivers);
        
        // Load recent activity
        const activity = await API.request('/admin/activity');
        renderRecentActivity(activity);
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

function updateQuickStats(stats) {
    document.getElementById('totalDrivers').textContent = stats.totalDrivers || 0;
    document.getElementById('activeDeliveries').textContent = stats.activeDeliveries || 0;
    document.getElementById('todayRevenue').textContent = `R${(stats.todayRevenue || 0).toFixed(2)}`;
    document.getElementById('completionRate').textContent = `${(stats.completionRate || 0)}%`;
}

function renderActiveDrivers(drivers) {
    const container = document.getElementById('activeDriversList');
    if (!container) return;
    
    if (!drivers || drivers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-motorcycle"></i>
                <p>No active drivers</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = drivers.map(driver => `
        <div class="driver-card" data-driver-id="${driver._id}">
            <div class="driver-avatar">
                <div class="driver-img">${driver.name.charAt(0)}</div>
                <div class="driver-status status-${driver.status}"></div>
            </div>
            <div class="driver-details">
                <h4>${driver.name}</h4>
                <div class="driver-meta">
                    <span class="driver-rating">
                        <i class="fas fa-star"></i> ${driver.rating?.toFixed(1) || '5.0'}
                    </span>
                    <span class="driver-vehicle">
                        <i class="fas fa-motorcycle"></i> ${driver.vehicle?.type || 'Vehicle'}
                    </span>
                    <span class="driver-status-text">${driver.status || 'offline'}</span>
                </div>
                <p>📍 ${driver.currentLocation?.address || 'Location unknown'}</p>
            </div>
            <div class="driver-actions">
                <button class="action-btn primary" onclick="trackDriver('${driver._id}')">
                    <i class="fas fa-map-marker-alt"></i> Track
                </button>
                <button class="action-btn secondary" onclick="viewDriverDetails('${driver._id}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </div>
        </div>
    `).join('');
}

function renderRecentActivity(activities) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    if (!activities || activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = activities.map(activity => `
        <div class="activity-item" style="padding: 0.8rem 0; border-bottom: 1px solid var(--gray-light);">
            <div style="display: flex; justify-content: space-between;">
                <strong>${activity.description}</strong>
                <small style="color: var(--gray);">${formatTimeAgo(activity.timestamp)}</small>
            </div>
            <small style="color: var(--gray);">${activity.details}</small>
        </div>
    `).join('');
}

// Map Functions
function initTrackingMap() {
    if (!adminMap && document.getElementById('adminMap')) {
        adminMap = L.map('adminMap').setView([-26.195246, 28.034088], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(adminMap);
        
        console.log('🗺️ Admin map initialized');
    }
}

function refreshMap() {
    if (adminMap) {
        adminMap.invalidateSize();
        showNotification('Map refreshed', 'success');
    }
}

function centerMap() {
    if (adminMap) {
        adminMap.setView([-26.195246, 28.034088], 12);
    }
}

function toggleSatellite() {
    showNotification('Satellite view coming soon', 'info');
}

// Driver Management
async function loadDriversTable() {
    try {
        const drivers = await API.request('/drivers');
        renderDriversTable(drivers);
    } catch (error) {
        console.error('Failed to load drivers:', error);
        showNotification('Failed to load drivers', 'error');
    }
}

function renderDriversTable(drivers) {
    const tbody = document.getElementById('driversTable');
    if (!tbody) return;
    
    if (!drivers || drivers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem; color: var(--gray);">
                    <i class="fas fa-motorcycle" style="font-size: 2rem; opacity: 0.5; margin-bottom: 1rem; display: block;"></i>
                    <p>No drivers found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = drivers.map(driver => `
        <tr>
            <td><strong>${driver.driverId || driver._id.substring(0, 8)}</strong></td>
            <td>${driver.name}</td>
            <td>
                <div>${driver.phone}</div>
                <small>${driver.email}</small>
            </td>
            <td>
                <div>${driver.vehicle?.type || 'N/A'}</div>
                <small>${driver.vehicle?.licensePlate || ''}</small>
            </td>
            <td>
                <span class="status-badge badge-${driver.status || 'offline'}">
                    ${driver.status || 'offline'}
                </span>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <i class="fas fa-star" style="color: var(--warning);"></i>
                    <span>${driver.rating?.toFixed(1) || '5.0'}</span>
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewDriverDetails('${driver._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="editDriver('${driver._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteDriver('${driver._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function addDriver(event) {
    event.preventDefault();
    
    const driverData = {
        name: document.getElementById('driverName').value,
        email: document.getElementById('driverEmail').value,
        phone: document.getElementById('driverPhone').value,
        vehicleType: document.getElementById('vehicleType').value,
        vehicleDetails: document.getElementById('vehicleDetails').value,
        licensePlate: document.getElementById('licensePlate').value,
        ratePerKm: parseFloat(document.getElementById('driverRate').value)
    };
    
    try {
        const response = await API.request('/drivers', {
            method: 'POST',
            body: JSON.stringify(driverData)
        });
        
        showNotification('Driver added successfully!', 'success');
        hideModal('addDriverModal');
        event.target.reset();
        
        // Refresh drivers list
        if (document.getElementById('driversSection').style.display !== 'none') {
            loadDriversTable();
        }
        loadDashboardData();
        
    } catch (error) {
        showNotification('Failed to add driver: ' + error.message, 'error');
    }
}

async function viewDriverDetails(driverId) {
    try {
        const driver = await API.request(`/drivers/${driverId}`);
        
        document.getElementById('driverDetailsContent').innerHTML = `
            <div style="display: flex; gap: 1.5rem; margin-bottom: 2rem;">
                <div style="flex-shrink: 0;">
                    <div class="user-avatar" style="width: 80px; height: 80px; font-size: 2rem;">
                        ${driver.name.charAt(0)}
                    </div>
                </div>
                <div style="flex: 1;">
                    <h3>${driver.name}</h3>
                    <p><i class="fas fa-phone"></i> ${driver.phone}</p>
                    <p><i class="fas fa-envelope"></i> ${driver.email}</p>
                    <p><i class="fas fa-motorcycle"></i> ${driver.vehicle?.type || 'No vehicle'}</p>
                    <p><i class="fas fa-tag"></i> R${driver.ratePerKm}/km</p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div style="background: var(--light); padding: 1rem; border-radius: var(--radius-md);">
                    <strong>Total Trips</strong>
                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">
                        ${driver.totalTrips || 0}
                    </div>
                </div>
                <div style="background: var(--light); padding: 1rem; border-radius: var(--radius-md);">
                    <strong>Total Earnings</strong>
                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">
                        R${(driver.totalEarnings || 0).toFixed(2)}
                    </div>
                </div>
                <div style="background: var(--light); padding: 1rem; border-radius: var(--radius-md);">
                    <strong>Rating</strong>
                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--warning);">
                        ${driver.rating?.toFixed(1) || '5.0'} <i class="fas fa-star"></i>
                    </div>
                </div>
                <div style="background: var(--light); padding: 1rem; border-radius: var(--radius-md);">
                    <strong>Status</strong>
                    <div>
                        <span class="status-badge badge-${driver.status || 'offline'}">
                            ${driver.status || 'offline'}
                        </span>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem;">
                <h4>Recent Trips</h4>
                ${driver.recentTrips && driver.recentTrips.length > 0 ? 
                    driver.recentTrips.map(trip => `
                        <div style="padding: 0.8rem; background: var(--light); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>${trip.pickup} → ${trip.destination}</span>
                                <strong>R${trip.fare}</strong>
                            </div>
                            <small style="color: var(--gray);">${new Date(trip.date).toLocaleDateString()}</small>
                        </div>
                    `).join('') : 
                    '<p style="color: var(--gray); text-align: center;">No recent trips</p>'
                }
            </div>
            
            <div class="btn-group" style="margin-top: 2rem;">
                <button class="btn btn-primary" onclick="messageDriver('${driver._id}')">
                    <i class="fas fa-comment"></i> Send Message
                </button>
                <button class="btn btn-secondary" onclick="hideModal('driverDetailsModal')">
                    Close
                </button>
            </div>
        `;
        
        showModal('driverDetailsModal');
        
    } catch (error) {
        showNotification('Failed to load driver details', 'error');
    }
}

function editDriver(driverId) {
    // Implementation for editing driver
    showNotification('Edit feature coming soon', 'info');
}

async function deleteDriver(driverId) {
    if (!confirm('Are you sure you want to delete this driver?')) {
        return;
    }
    
    try {
        await API.request(`/drivers/${driverId}`, {
            method: 'DELETE'
        });
        
        showNotification('Driver deleted successfully', 'success');
        loadDriversTable();
        loadDashboardData();
        
    } catch (error) {
        showNotification('Failed to delete driver', 'error');
    }
}

function filterDrivers() {
    const status = document.getElementById('driverStatusFilter').value;
    // Implementation would filter the displayed drivers
    showNotification(`Filtering drivers by: ${status}`, 'info');
}

// Delivery Management
async function loadDeliveriesTable() {
    try {
        const deliveries = await API.request('/trips');
        renderDeliveriesTable(deliveries);
    } catch (error) {
        console.error('Failed to load deliveries:', error);
        showNotification('Failed to load deliveries', 'error');
    }
}

function renderDeliveriesTable(deliveries) {
    const tbody = document.getElementById('deliveriesTable');
    if (!tbody) return;
    
    if (!deliveries || deliveries.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem; color: var(--gray);">
                    <i class="fas fa-box" style="font-size: 2rem; opacity: 0.5; margin-bottom: 1rem; display: block;"></i>
                    <p>No deliveries found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = deliveries.map(delivery => `
        <tr>
            <td><strong>${delivery.tripId || delivery._id.substring(0, 8)}</strong></td>
            <td>${delivery.customer?.name || 'Customer'}</td>
            <td>${delivery.driver?.name || 'Unassigned'}</td>
            <td>
                <div>${delivery.pickup?.address?.substring(0, 20) || 'Pickup'}...</div>
                <div>→ ${delivery.destinations?.[0]?.address?.substring(0, 20) || 'Destination'}...</div>
            </td>
            <td>${delivery.distance ? delivery.distance.toFixed(1) + 'km' : 'N/A'}</td>
            <td><strong>R${delivery.fare?.total?.toFixed(2) || '0.00'}</strong></td>
            <td>
                <span class="status-badge badge-${delivery.status || 'pending'}">
                    ${delivery.status || 'pending'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewDeliveryDetails('${delivery._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="assignDelivery('${delivery._id}')">
                        <i class="fas fa-user-check"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function viewDeliveryDetails(deliveryId) {
    try {
        const delivery = await API.request(`/trips/${deliveryId}`);
        
        document.getElementById('deliveryDetailsContent').innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h4>Trip ID: ${delivery.tripId || delivery._id.substring(0, 8)}</h4>
                <div style="display: flex; gap: 2rem; margin-top: 1rem;">
                    <div>
                        <strong>Status:</strong>
                        <span class="status-badge badge-${delivery.status}" style="margin-left: 0.5rem;">
                            ${delivery.status}
                        </span>
                    </div>
                    <div>
                        <strong>Fare:</strong>
                        <span style="margin-left: 0.5rem; font-weight: bold; color: var(--primary);">
                            R${delivery.fare?.total?.toFixed(2) || '0.00'}
                        </span>
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                <div>
                    <h5>Pickup Details</h5>
                    <div style="background: var(--light); padding: 1rem; border-radius: var(--radius-md);">
                        <p><strong>Address:</strong> ${delivery.pickup?.address || 'N/A'}</p>
                        <p><strong>Contact:</strong> ${delivery.pickup?.contactName || 'N/A'} (${delivery.pickup?.contactPhone || 'N/A'})</p>
                        <p><strong>Instructions:</strong> ${delivery.pickup?.instructions || 'None'}</p>
                    </div>
                </div>
                
                <div>
                    <h5>Delivery Details</h5>
                    ${delivery.destinations?.map((dest, index) => `
                        <div style="background: var(--light); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                            <p><strong>Destination ${index + 1}:</strong> ${dest.address || 'N/A'}</p>
                            <p><strong>Recipient:</strong> ${dest.recipientName || 'N/A'} (${dest.recipientPhone || 'N/A'})</p>
                            <p><strong>Status:</strong> 
                                <span class="status-badge badge-${dest.status}">${dest.status}</span>
                            </p>
                            ${dest.deliveredAt ? 
                                `<p><strong>Delivered:</strong> ${new Date(dest.deliveredAt).toLocaleString()}</p>` : 
                                ''
                            }
                        </div>
                    `).join('') || '<p>No destinations</p>'}
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 2rem;">
                <div>
                    <h5>Customer</h5>
                    <p>${delivery.customer?.name || 'N/A'}</p>
                    <p>${delivery.customer?.phone || 'N/A'}</p>
                </div>
                
                <div>
                    <h5>Driver</h5>
                    ${delivery.driver ? `
                        <p>${delivery.driver.name}</p>
                        <p>${delivery.driver.phone || 'N/A'}</p>
                        <p>${delivery.driver.vehicle?.type || 'N/A'}</p>
                    ` : '<p>Not assigned</p>'}
                </div>
                
                <div>
                    <h5>Trip Info</h5>
                    <p><strong>Distance:</strong> ${delivery.distance ? delivery.distance.toFixed(1) + 'km' : 'N/A'}</p>
                    <p><strong>Requested:</strong> ${new Date(delivery.requestedAt).toLocaleString()}</p>
                    ${delivery.completedAt ? 
                        `<p><strong>Completed:</strong> ${new Date(delivery.completedAt).toLocaleString()}</p>` : 
                        ''
                    }
                </div>
            </div>
            
            <div class="btn-group">
                <button class="btn btn-primary" onclick="trackDelivery('${delivery._id}')">
                    <i class="fas fa-map-marker-alt"></i> Track on Map
                </button>
                <button class="btn btn-secondary" onclick="hideModal('deliveryDetailsModal')">
                    Close
                </button>
            </div>
        `;
        
        showModal('deliveryDetailsModal');
        
    } catch (error) {
        showNotification('Failed to load delivery details', 'error');
    }
}

function assignDelivery(deliveryId) {
    // Implementation for assigning delivery to driver
    showNotification('Assignment feature coming soon', 'info');
}

function filterDeliveries() {
    const status = document.getElementById('deliveryStatusFilter').value;
    // Implementation would filter the displayed deliveries
    showNotification(`Filtering deliveries by: ${status}`, 'info');
}

function exportDeliveries() {
    showNotification('Export feature coming soon', 'info');
}

// Live Tracking
function initLiveTracking() {
    if (document.getElementById('trackingMap')) {
        // Initialize tracking map
        const trackingMap = L.map('trackingMap').setView([-26.195246, 28.034088], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(trackingMap);
        
        // Load active drivers for tracking
        loadDriversForTracking(trackingMap);
    }
}

async function loadDriversForTracking(map) {
    try {
        const drivers = await API.request('/drivers?status=online,busy');
        
        drivers.forEach(driver => {
            if (driver.currentLocation) {
                const marker = L.marker([driver.currentLocation.lat, driver.currentLocation.lng], {
                    icon: L.divIcon({
                        html: `
                            <div style="
                                background: ${driver.status === 'busy' ? '#FF9800' : '#4CAF50'};
                                width: 40px;
                                height: 40px;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: white;
                                border: 3px solid white;
                                box-shadow: 0 0 15px ${driver.status === 'busy' ? '#FF980080' : '#4CAF5080'};
                            ">
                                <i class="fas fa-motorcycle"></i>
                            </div>
                        `,
                        iconSize: [40, 40],
                        className: 'pulse'
                    })
                }).addTo(map);
                
                marker.bindPopup(`
                    <div style="min-width: 200px;">
                        <h4 style="margin: 0 0 10px 0;">${driver.name}</h4>
                        <p><strong>Status:</strong> ${driver.status}</p>
                        <p><strong>Vehicle:</strong> ${driver.vehicle?.type || 'N/A'}</p>
                        <p><strong>Rating:</strong> ${driver.rating?.toFixed(1) || '5.0'} ⭐</p>
                        <button onclick="trackDriver('${driver._id}')" 
                                style="width: 100%; padding: 8px; background: #6C63FF; color: white; border: none; border-radius: 4px; margin-top: 10px;">
                            View Details
                        </button>
                    </div>
                `);
                
                driverMarkers.set(driver._id, marker);
            }
        });
        
        // Fit map to show all drivers
        if (drivers.length > 0) {
            const bounds = L.latLngBounds(drivers.map(d => 
                [d.currentLocation?.lat, d.currentLocation?.lng]
            ).filter(loc => loc[0] && loc[1]));
            
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
        
    } catch (error) {
        console.error('Failed to load drivers for tracking:', error);
    }
}

function refreshTracking() {
    const mapElement = document.getElementById('trackingMap');
    if (mapElement) {
        mapElement.innerHTML = '';
        initLiveTracking();
        showNotification('Tracking refreshed', 'success');
    }
}

function centerAllDrivers() {
    // Implementation to center map on all drivers
    showNotification('Centering on drivers', 'info');
}

function toggleHeatmap() {
    showNotification('Heatmap feature coming soon', 'info');
}

function trackDriver(driverId) {
    window.location.href = `tracking.html?driverId=${driverId}`;
}

// Customer Management
async function loadCustomersTable() {
    try {
        const customers = await API.request('/admin/customers');
        renderCustomersTable(customers);
    } catch (error) {
        console.error('Failed to load customers:', error);
        showNotification('Failed to load customers', 'error');
    }
}

function renderCustomersTable(customers) {
    const tbody = document.getElementById('customersTable');
    if (!tbody) return;
    
    // Similar implementation to drivers table
    tbody.innerHTML = customers.map(customer => `
        <tr>
            <td>${customer._id.substring(0, 8)}</td>
            <td>${customer.name}</td>
            <td>${customer.email}</td>
            <td>${customer.phone}</td>
            <td>${customer.totalTrips || 0}</td>
            <td>R${(customer.totalSpent || 0).toFixed(2)}</td>
            <td>${customer.lastTrip ? new Date(customer.lastTrip).toLocaleDateString() : 'Never'}</td>
            <td>
                <button class="action-btn view" onclick="viewCustomerDetails('${customer._id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Reports
function loadReports() {
    // Initialize charts
    initRevenueChart();
    initDeliveryChart();
}

function initRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Daily Revenue (R)',
                data: [1250, 1890, 2100, 1800, 2400, 3200, 2800],
                borderColor: '#6C63FF',
                backgroundColor: 'rgba(108, 99, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            }
        }
    });
}

function initDeliveryChart() {
    const ctx = document.getElementById('deliveryChart');
    if (!ctx) return;
    
    deliveryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'In Progress', 'Pending', 'Cancelled'],
            datasets: [{
                data: [65, 15, 10, 10],
                backgroundColor: [
                    '#4CAF50',
                    '#FF9800',
                    '#2196F3',
                    '#F44336'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function generateReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    
    if (!startDate || !endDate) {
        showNotification('Please select both start and end dates', 'error');
        return;
    }
    
    showNotification(`Generating report for ${startDate} to ${endDate}...`, 'info');
    // Implementation would generate and download report
}

// Settings
async function loadSettings() {
    try {
        const settings = await API.request('/admin/settings');
        
        document.getElementById('companyName').value = settings.companyName || '';
        document.getElementById('defaultRate').value = settings.defaultRate || 10;
        document.getElementById('serviceFee').value = settings.serviceFee || 10;
        document.getElementById('minimumFare').value = settings.minimumFare || 25;
        document.getElementById('supportPhone').value = settings.supportPhone || '';
        document.getElementById('supportEmail').value = settings.supportEmail || '';
        
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

async function saveSettings(event) {
    event.preventDefault();
    
    const settings = {
        companyName: document.getElementById('companyName').value,
        defaultRate: parseFloat(document.getElementById('defaultRate').value),
        serviceFee: parseFloat(document.getElementById('serviceFee').value),
        minimumFare: parseFloat(document.getElementById('minimumFare').value),
        supportPhone: document.getElementById('supportPhone').value,
        supportEmail: document.getElementById('supportEmail').value
    };
    
    try {
        await API.request('/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
        
        showNotification('Settings saved successfully', 'success');
        
    } catch (error) {
        showNotification('Failed to save settings', 'error');
    }
}

function resetSettings() {
    if (confirm('Reset all settings to default values?')) {
        document.getElementById('settingsForm').reset();
    }
}

// Utility Functions
function formatTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diff = now - past;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
}

// Notifications
function showNotifications() {
    document.getElementById('notificationsList').innerHTML = `
        <div style="padding: 1rem; border-bottom: 1px solid var(--gray-light);">
            <strong>New driver registered</strong>
            <p>Michael Rodriguez has completed registration</p>
            <small style="color: var(--gray);">10 minutes ago</small>
        </div>
        <div style="padding: 1rem; border-bottom: 1px solid var(--gray-light);">
            <strong>Delivery completed</strong>
            <p>Trip #TRP-789 has been delivered successfully</p>
            <small style="color: var(--gray);">1 hour ago</small>
        </div>
        <div style="padding: 1rem;">
            <strong>System update available</strong>
            <p>New version 1.2.0 is ready for deployment</p>
            <small style="color: var(--gray);">1 day ago</small>
        </div>
    `;
    
    showModal('notificationsModal');
}

// Export functions to global scope
window.switchSection = switchSection;
window.addDriver = addDriver;
window.viewDriverDetails = viewDriverDetails;
window.editDriver = editDriver;
window.deleteDriver = deleteDriver;
window.filterDrivers = filterDrivers;
window.viewDeliveryDetails = viewDeliveryDetails;
window.assignDelivery = assignDelivery;
window.filterDeliveries = filterDeliveries;
window.exportDeliveries = exportDeliveries;
window.refreshTracking = refreshTracking;
window.centerAllDrivers = centerAllDrivers;
window.toggleHeatmap = toggleHeatmap;
window.trackDriver = trackDriver;
window.generateReport = generateReport;
window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.showNotifications = showNotifications;