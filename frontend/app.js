// ===== SWIFTRIDE APP.JS - WORKING VERSION =====
const APP_CONFIG = {
    API_BASE_URL: 'https://swiftride-backend-jcyl.onrender.com/api',
    MAP_CONFIG: {
        defaultCenter: [-26.195246, 28.034088],
        defaultZoom: 14
    }
};

let AppState = { user: null, token: null };

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const loading = document.getElementById('loadingScreen');
        if (loading) loading.style.display = 'none';
    }, 1000);
});

// ===== FIXED FUNCTIONS =====
window.trackDriver = function(driverId) {
    console.log('Tracking driver:', driverId);
    localStorage.setItem('trackDriverId', driverId);
    window.location.href = 'tracking.html?driver=' + driverId;
    return false;
};

window.logout = function() {
    localStorage.clear();
    window.location.href = 'index.html';
};

window.redirectTo = function(page) {
    window.location.href = page + '.html';
};

window.showNotification = function(msg, type) {
    console.log(type + ':', msg);
};

// ===== TEST LOGINS =====
window.loginAsAdmin = function() {
    localStorage.setItem('user', JSON.stringify({
        _id: 'admin1',
        name: 'Admin User',
        email: 'admin@test.com',
        userType: 'admin',
        phone: '0111234567'
    }));
    localStorage.setItem('token', 'test_admin_token');
    window.location.href = 'admin.html';
};

window.loginAsDriver = function() {
    localStorage.setItem('user', JSON.stringify({
        _id: 'driver1',
        name: 'John Driver',
        email: 'driver@test.com',
        userType: 'driver',
        phone: '0821234567'
    }));
    localStorage.setItem('token', 'test_driver_token');
    window.location.href = 'driver.html';
};

window.loginAsCustomer = window.loginAsDriver;
