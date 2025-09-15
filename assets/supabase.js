// Supabase Configuration - FIXED VERSION
const SUPABASE_URL = 'https://scvdrbdyafyvaefikLno.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdmRyYmR5YWZ5dmFlZmlrbG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3NjY1MjEsImV4cCI6MjA3MzM0MjUyMX0.bqBzFk-i7SYB-KP2DEUDck2MqUwhL15kDyM96TwVPdI';

// Global variable to hold Supabase client
let supabaseClient = null;

// Initialize Supabase client when DOM is ready
function initializeSupabase() {
    try {
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            // Make it globally available
            window.supabase = supabaseClient;

            console.log('Supabase initialized successfully');
            return true;
        } else {
            console.error('Supabase library not loaded');
            return false;
        }
    } catch (error) {
        console.error('Supabase initialization error:', error);
        return false;
    }
}

// Test connection
async function testSupabaseConnection() {
    try {
        if (!supabaseClient) {
            console.error('Supabase not initialized');
            return false;
        }

        const { data, error } = await supabaseClient
            .from('zones')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Supabase connection error:', error);
            return false;
        }

        console.log('Supabase connected successfully');
        return true;
    } catch (error) {
        console.error('Supabase connection failed:', error);
        return false;
    }
}

// Zone detection helper
const chennaiZones = {
    1: { name: "Thiruvottriyur", latMin: 13.20, latMax: 13.25, lngMin: 80.30, lngMax: 80.35 },
    2: { name: "Manali", latMin: 13.25, latMax: 13.30, lngMin: 80.35, lngMax: 80.40 },
    3: { name: "Madhavaram", latMin: 13.15, latMax: 13.20, lngMin: 80.25, lngMax: 80.30 },
    4: { name: "Tondiarpet", latMin: 13.10, latMax: 13.15, lngMin: 80.25, lngMax: 80.30 },
    5: { name: "Royapuram", latMin: 13.12, latMax: 13.17, lngMin: 80.28, lngMax: 80.33 },
    6: { name: "Thiru-Vi-Ka Nagar", latMin: 13.08, latMax: 13.13, lngMin: 80.22, lngMax: 80.27 },
    7: { name: "Ambattur", latMin: 13.08, latMax: 13.13, lngMin: 80.15, lngMax: 80.20 },
    8: { name: "Anna Nagar", latMin: 13.05, latMax: 13.10, lngMin: 80.20, lngMax: 80.25 },
    9: { name: "Teynampet", latMin: 13.03, latMax: 13.08, lngMin: 80.24, lngMax: 80.29 },
    10: { name: "Kodambakkam", latMin: 13.00, latMax: 13.05, lngMin: 80.22, lngMax: 80.27 },
    11: { name: "Valasaravakkam", latMin: 12.98, latMax: 13.03, lngMin: 80.18, lngMax: 80.23 },
    12: { name: "Alandur", latMin: 12.95, latMax: 13.00, lngMin: 80.20, lngMax: 80.25 },
    13: { name: "Adyar", latMin: 12.98, latMax: 13.03, lngMin: 80.25, lngMax: 80.30 },
    14: { name: "Perungudi", latMin: 12.95, latMax: 13.00, lngMin: 80.23, lngMax: 80.28 },
    15: { name: "Sholinganallur", latMin: 12.90, latMax: 12.95, lngMin: 80.22, lngMax: 80.27 }
};

function detectZoneFromCoordinates(latitude, longitude) {
    for (let zoneId in chennaiZones) {
        const zone = chennaiZones[zoneId];
        if (latitude >= zone.latMin && latitude <= zone.latMax &&
            longitude >= zone.lngMin && longitude <= zone.lngMax) {
            return {
                id: parseInt(zoneId),
                name: zone.name
            };
        }
    }
    return null; // Zone not detected
}

// Image compression utility
function compressImage(file, maxSizeKB = 100) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = function() {
            // Calculate new dimensions maintaining aspect ratio
            const maxWidth = 800;
            const maxHeight = 600;
            let { width, height } = img;

            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);

            // Try different quality levels to achieve target size
            let quality = 0.8;
            let dataURL;

            do {
                dataURL = canvas.toDataURL('image/jpeg', quality);
                quality -= 0.1;
            } while (dataURL.length > maxSizeKB * 1024 && quality > 0.1);

            // Convert to blob
            canvas.toBlob(resolve, 'image/jpeg', quality + 0.1);
        };

        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Upload image to Supabase Storage
async function uploadImage(file, bucket = 'waste-photos') {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase not initialized');
        }

        const compressedFile = await compressImage(file);
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;

        const { data, error } = await supabaseClient.storage
            .from(bucket)
            .upload(fileName, compressedFile);

        if (error) {
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(fileName);

        return publicUrl;
    } catch (error) {
        console.error('Image upload error:', error);
        throw error;
    }
}

// Get current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });
}

// Wait for Supabase library to load, then initialize
function waitForSupabase() {
    return new Promise((resolve) => {
        if (typeof supabase !== 'undefined') {
            initializeSupabase();
            resolve();
        } else {
            // Wait up to 5 seconds for Supabase to load
            let attempts = 0;
            const maxAttempts = 50;

            const checkInterval = setInterval(() => {
                attempts++;
                if (typeof supabase !== 'undefined') {
                    clearInterval(checkInterval);
                    initializeSupabase();
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.error('Supabase library failed to load');
                    resolve();
                }
            }, 100);
        }
    });
}
