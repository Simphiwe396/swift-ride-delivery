// Customer Dashboard JavaScript
console.log('Customer Dashboard Loading...');

// Check if user is customer
(function() {
    const user = localStorage.getItem('swiftride_user');
    if (!user) {
        alert('Please login as customer first');
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const userData = JSON.parse(user);
        if (userData.userType !== 'customer') {
            alert('Customer access required');
            window.location.href = 'index.html';
            return;
        }
    } catch (e) {
        alert('Invalid session');
        window.location.href = 'index.html';
        return;
    }
})();

// Initialize Customer Dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Customer Dashboard...');
    
    // Load customer info
    const user = JSON.parse(localStorage.getItem('swiftride_user') || '{}');
    if (user.name) {
        const customerName = document.getElementById('customerName');
        if (customerName) {
            customerName.textContent = user.name;
        }
    }
    
    // Setup event listeners
    setTimeout(() => {
        setupCustomerEventListeners();
        updateFareEstimate();
        loadActiveDeliveries();
    }, 500);
    
    // Hide loading screen
    setTimeout(() => {
        const loading = document.getElementById('loadingScreen');
        if (loading) loading.style.display = 'none';
    }, 1000);
});

// Setup Event Listeners
function setupCustomerEventListeners() {
    // Delivery option selection
    document.querySelectorAll('.delivery-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.delivery-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            this.classList.add('selected');
            
            const rate = this.dataset.rate || 'standard';
            localStorage.setItem('selectedRate', rate);
            updateFareEstimate();
        });
    });
    
    // Request delivery button
    const requestBtn = document.querySelector('[onclick="requestDelivery()"]');
    if (requestBtn) {
        requestBtn.onclick = requestDelivery;
    }
    
    // Order now button
    const orderBtn = document.querySelector('[onclick="orderNow()"]');
    if (orderBtn) {
        orderBtn.onclick = orderNow;
    }
}

// Update Fare Estimate
function updateFareEstimate() {
    const selectedOption = document.querySelector('.delivery-option.selected');
    const rate = selectedOption ? (selectedOption.dataset.rate || 'standard') : 'standard';
    const distance = 8.5; // Example distance in km
    
    const fare = calculateFare(distance, 
        rate === 'economy' ? 5 : 
        rate === 'express' ? 20 : 10
    );
    
    document.getElementById('distanceFare').textContent = `R ${fare.distance}`;
    document.getElementById('serviceFee').textContent = `R ${fare.serviceFee}`;
    document.getElementById('totalFare').textContent = `R ${fare.total}`;
}

// Request Delivery
function requestDelivery() {
    const pickup = document.getElementById('pickupLocation');
    const delivery = document.getElementById('deliveryLocation');
    
    if (!pickup.value || !delivery.value) {
        showNotification('Please enter both pickup and delivery locations', 'error');
        return;
    }
    
    showNotification('Looking for available drivers...', 'info');
    
    // Simulate finding driver
    setTimeout(() => {
        showNotification('Driver found! Your delivery is on the way.', 'success');
        
        // Add to active deliveries
        const activeDeliveries = document.getElementById('activeDeliveries');
        if (activeDeliveries) {
            activeDeliveries.innerHTML = `
                <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span style="background: #4CAF50; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 500;">
                            Active
                        </span>
                        <span style="font-size: 1.3rem; font-weight: 700; color: #6C63FF;">
                            R 120.00
                        </span>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <i class="fas fa-map-marker-alt" style="color: #4CAF50;"></i>
                            <div style="color: #666;">${pickup.value}</div>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                            <i class="fas fa-flag-checkered" style="color: #FF6584;"></i>
                            <div style="color: #666;">${delivery.value}</div>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 15px; color: #666; font-size: 0.9rem;">
                            <span><i class="fas fa-motorcycle"></i> John D</span>
                            <span><i class="fas fa-clock"></i> 5 min away</span>
                            <span><i class="fas fa-route"></i> 8.5 km</span>
                        </div>
                    </div>
                    
                    <button onclick="trackDelivery()" style="
                        background: #6C63FF;
                        color: white;
                        border: none;
                        width: 100%;
                        padding: 12px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    ">
                        <i class="fas fa-map"></i> Track Delivery
                    </button>
                </div>
            `;
        }
        
        // Clear form
        pickup.value = '';
        delivery.value = '';
        document.getElementById('packageDescription').value = '';
    }, 2000);
}

// Load Active Deliveries
function loadActiveDeliveries() {
    const container = document.getElementById('activeDeliveries');
    if (!container) return;
    
    // Check if there are any active deliveries
    const hasActiveDelivery = false; // Change based on actual data
    
    if (!hasActiveDelivery) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No active deliveries</p>
                <button onclick="scrollToOrder()" style="
                    background: #6C63FF;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-top: 10px;
                ">
                    Order Your First Delivery
                </button>
            </div>
        `;
    }
}

// Utility Functions
function orderNow() {
    const orderSection = document.getElementById('orderSection');
    if (orderSection) {
        orderSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function scrollToOrder() {
    const orderSection = document.getElementById('orderSection');
    if (orderSection) {
        orderSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function trackDelivery() {
    showNotification('Opening live tracking map...', 'info');
    // In real app, this would open tracking page
}

// Make functions globally available
window.requestDelivery = requestDelivery;
window.orderNow = orderNow;
window.scrollToOrder = scrollToOrder;
window.trackDelivery = trackDelivery;