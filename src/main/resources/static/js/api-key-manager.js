/**
 * api-key-manager.js - Handles API key management functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize API key management
    initApiKeyManagement();
});

/**
 * Initialize API key management functionality
 */
function initApiKeyManagement() {
    // Cache DOM elements
    const apiKeyModal = document.getElementById('apiKeyModal');
    const apiKeyForm = document.getElementById('apiKeyForm');
    const apiKeyName = document.getElementById('apiKeyName');
    const apiKeyValue = document.getElementById('apiKeyValue');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
    const apiKeyError = document.getElementById('apiKeyError');
    const apiKeySuccess = document.getElementById('apiKeySuccess');
    const currentApiKeyInfo = document.getElementById('currentApiKeyInfo');
    const apiKeyLastUsed = document.getElementById('apiKeyLastUsed');
    const deleteApiKeyBtn = document.getElementById('deleteApiKeyBtn');
    
    // Load API key info when modal is opened
    if (apiKeyModal) {
        apiKeyModal.addEventListener('show.bs.modal', function(event) {
            // Get key name from button that triggered the modal
            const button = event.relatedTarget;
            const keyName = button.getAttribute('data-key-name');
            
            if (keyName) {
                apiKeyName.value = keyName;
                apiKeyName.readOnly = true;
                loadApiKeyInfo(keyName);
            } else {
                apiKeyName.value = '';
                apiKeyName.readOnly = false;
                resetApiKeyForm();
            }
        });
    }
    
    // Handle API key form submission
    if (apiKeyForm) {
        apiKeyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Reset error and success messages
            apiKeyError.classList.add('d-none');
            apiKeySuccess.classList.add('d-none');
            
            // Get form values
            const keyName = apiKeyName.value.trim();
            const keyValue = apiKeyValue.value.trim();
            
            // Validate form
            if (!keyName) {
                apiKeyError.textContent = 'Please enter a key name';
                apiKeyError.classList.remove('d-none');
                return;
            }
            
            if (!keyValue) {
                apiKeyError.textContent = 'Please enter a key value';
                apiKeyError.classList.remove('d-none');
                return;
            }
            
            // Get CSRF token
            const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
            const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
            
            // Save API key
            fetch('/api/apikey/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [csrfHeader]: csrfToken
                },
                body: JSON.stringify({
                    keyName: keyName,
                    keyValue: keyValue
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    apiKeySuccess.textContent = data.message || 'API key saved successfully';
                    apiKeySuccess.classList.remove('d-none');
                    
                    // Clear key value field for security
                    apiKeyValue.value = '';
                    
                    // Update key info
                    if (data.apiKey) {
                        updateApiKeyInfo(data.apiKey);
                    }
                    
                    // Hide success message after a delay
                    setTimeout(function() {
                        apiKeySuccess.classList.add('d-none');
                    }, 3000);
                } else {
                    throw new Error(data.message || 'Failed to save API key');
                }
            })
            .catch(error => {
                apiKeyError.textContent = error.message;
                apiKeyError.classList.remove('d-none');
            });
        });
    }
    
    // Handle API key deletion
    if (deleteApiKeyBtn) {
        deleteApiKeyBtn.addEventListener('click', function() {
            if (!confirm('Are you sure you want to delete this API key?')) {
                return;
            }
            
            // Get API key ID from button data attribute
            const keyId = this.dataset.keyId;
            if (!keyId) {
                return;
            }
            
            // Get CSRF token
            const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
            const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
            
            // Delete API key
            fetch(`/api/apikey/${keyId}`, {
                method: 'DELETE',
                headers: {
                    [csrfHeader]: csrfToken
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    apiKeySuccess.textContent = data.message || 'API key deleted successfully';
                    apiKeySuccess.classList.remove('d-none');
                    
                    // Reset form
                    resetApiKeyForm();
                    
                    // Hide success message after a delay
                    setTimeout(function() {
                        apiKeySuccess.classList.add('d-none');
                    }, 3000);
                } else {
                    throw new Error(data.message || 'Failed to delete API key');
                }
            })
            .catch(error => {
                apiKeyError.textContent = error.message;
                apiKeyError.classList.remove('d-none');
            });
        });
    }
    
    /**
     * Load API key information from the server
     * @param {string} keyName - Name of the API key to load
     */
    function loadApiKeyInfo(keyName) {
        // Reset UI
        resetApiKeyForm();
        
        // Get CSRF token
        const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
        
        // Get API key info
        fetch(`/api/apikey/${keyName}`, {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.hasKey && data.apiKey) {
                    updateApiKeyInfo(data.apiKey);
                }
            } else {
                apiKeyError.textContent = data.message || 'Error loading API key information';
                apiKeyError.classList.remove('d-none');
            }
        })
        .catch(error => {
            apiKeyError.textContent = 'Error loading API key information: ' + error.message;
            apiKeyError.classList.remove('d-none');
        });
    }
    
    /**
     * Update API key information in the UI
     * @param {Object} apiKey - API key data
     */
    function updateApiKeyInfo(apiKey) {
        if (currentApiKeyInfo) {
            // Format date
            const lastUsed = apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleString() : 'Never';
            
            // Update last used text
            if (apiKeyLastUsed) {
                apiKeyLastUsed.textContent = lastUsed;
            }
            
            // Set key ID for delete button
            if (deleteApiKeyBtn) {
                deleteApiKeyBtn.dataset.keyId = apiKey.id;
            }
            
            // Show API key info section
            currentApiKeyInfo.classList.remove('d-none');
        }
    }
    
    /**
     * Reset API key form
     */
    function resetApiKeyForm() {
        // Hide messages
        apiKeyError.classList.add('d-none');
        apiKeySuccess.classList.add('d-none');
        
        // Clear key value field
        if (apiKeyValue) {
            apiKeyValue.value = '';
        }
        
        // Hide API key info section
        if (currentApiKeyInfo) {
            currentApiKeyInfo.classList.add('d-none');
        }
    }
}

/**
 * Check if user has Claude API key
 * @returns {Promise<boolean>} Promise that resolves to true if user has Claude API key
 */
function checkClaudeApiKey() {
    return new Promise((resolve, reject) => {
        // Get CSRF token
        const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
        
        // Check if user has Claude API key
        fetch('/api/apikey/claude/check', {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                resolve(data.hasKey);
            } else {
                reject(new Error(data.message || 'Error checking Claude API key'));
            }
        })
        .catch(error => {
            reject(error);
        });
    });
}