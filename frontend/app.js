const APP_CONFIG = {
    API_BASE_URL: 'https://swiftride-backend-jcyl.onrender.com/api',
    MAP_CONFIG: { defaultCenter: [-26.195246, 28.034088], defaultZoom: 14 }
};

let AppState = { user: null, token: null };

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const loading = document.getElementById('loadingScreen');
        if (loading) loading.style.display = 'none';
    }, 1000);
    
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
        AppState.token = token;
        AppState.user = JSON.parse(user);
        console.log('User:', AppState.user.name);
    }
});

function showNotification(msg, type='info') {
    console.log(`${type}: ${msg}`);
}

function logout() {
    localStorage.clear();
    location.href = 'index.html';
}

window.showNotification = showNotification;
window.logout = logout;
window.redirectTo = (page) => location.href = page + '.html';

window.trackDriver = (id) => {
    console.log('Track driver:', id);
    localStorage.setItem('trackDriverId', id);
    location.href = 'tracking.html?driver=' + id;
};

window.loginAsAdmin = () => {
    localStorage.setItem('user', JSON.stringify({
        _id: 'admin1', name: 'Admin User', email: 'admin@test.com',
        userType: 'admin', phone: '0111234567'
    }));
    localStorage.setItem('token', 'test_admin_token');
    location.href = 'admin.html';
};

window.loginAsDriver = () => {
    localStorage.setItem('user', JSON.stringify({
        _id: 'driver1', name: 'John Driver', email: 'driver@test.com',
        userType: 'driver', phone: '0821234567'
    }));
    localStorage.setItem('token', 'test_driver_token');
    location.href = 'driver.html';
};

window.loginAsCustomer = () => window.loginAsDriver();