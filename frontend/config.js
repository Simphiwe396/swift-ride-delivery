// Use this for your deployed app
const CONFIG = {
    // REPLACE WITH YOUR ACTUAL BACKEND RENDER URL
    API_BASE_URL: 'https://swiftride-backend-jcyl.onrender.com',
    
    // Function to get Mapbox token from backend (more secure)
    getMapboxToken: async () => {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/config/mapbox-token`);
            const data = await response.json();
            return data.token;
        } catch (error) {
            console.error('Failed to fetch Mapbox token:', error);
            return null; // You might have a fallback token
        }
    }
};

window.CONFIG = CONFIG;