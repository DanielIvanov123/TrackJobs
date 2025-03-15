/**
 * app.js - Main entry point for TrackJobs application
 */

// Define script paths in load order
const scripts = [
    '/js/core.js',
    '/js/status-management.js',
    '/js/modal.js',
    '/js/job-display.js',
    '/js/search.js',
    '/js/scraper.js',
    '/js/inline-scripts.js'  // Load this last
];

// Function to load scripts in sequence
function loadScripts(scriptPaths, index = 0) {
    if (index >= scriptPaths.length) {
        console.log('All scripts loaded successfully');
        return;
    }
    
    const script = document.createElement('script');
    script.src = scriptPaths[index];
    script.async = false; // Ensure scripts load in order
    
    script.onload = () => {
        console.log(`Loaded: ${scriptPaths[index]}`);
        loadScripts(scriptPaths, index + 1);
    };
    
    script.onerror = (e) => {
        console.error(`Error loading ${scriptPaths[index]}:`, e);
        // Show alert for script loading error
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger';
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '10px';
        alertDiv.style.right = '10px';
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `Error loading script: ${scriptPaths[index]}`;
        document.body.appendChild(alertDiv);
        
        // Continue loading other scripts
        setTimeout(() => {
            loadScripts(scriptPaths, index + 1);
        }, 500);
    };
    
    document.body.appendChild(script);
}

// Check if the window object is available before starting
if (window) {
    // Initialize global state object
    window.trackjobs = window.trackjobs || {
        currentJobs: [],
        initialized: false
    };
    
    // Start loading scripts when the document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Loading TrackJobs application scripts...');
            loadScripts(scripts);
        });
    } else {
        // Document already loaded
        console.log('Document already loaded, starting script loading...');
        loadScripts(scripts);
    }
}