/**
 * scraper.js - LinkedIn scraper functionality
 * Handles job scraping configuration and execution
 */

// Reference DOM elements when document is ready
let scrapeButton, keywordsInput, locationInput, pagesToScrapeInput;
let remoteOnlyCheckbox, jobTypeSelect, daysOldSelect;
let loadingIndicator, progressBar, progressBarText, statusUpdatesList;
let experienceLevelProgress, pageProgress, recentScrapedJobsContainer;
let saveConfigBtn, saveConfigModalEl;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing scraper functionality');
    
    // Scraper tab elements
    scrapeButton = document.getElementById('scrapeButton');
    keywordsInput = document.getElementById('keywords');
    locationInput = document.getElementById('location');
    pagesToScrapeInput = document.getElementById('pagesToScrape');
    remoteOnlyCheckbox = document.getElementById('remoteOnly');
    jobTypeSelect = document.getElementById('jobType');
    daysOldSelect = document.getElementById('daysOld');
    loadingIndicator = document.getElementById('loadingIndicator');
    recentScrapedJobsContainer = document.getElementById('recentScrapedJobs');
    
    // Progress elements
    progressBar = document.getElementById('scrapeProgressBar');
    progressBarText = document.getElementById('progressBarText');
    statusUpdatesList = document.getElementById('statusUpdatesList');
    experienceLevelProgress = document.getElementById('experienceLevelProgress');
    pageProgress = document.getElementById('pageProgress');
    
    // Save config elements
    saveConfigBtn = document.getElementById('saveConfigBtn');
    saveConfigModalEl = document.getElementById('saveConfigModal');
    
    // Initialize Bootstrap modal
    let saveConfigModal;
    if (saveConfigModalEl && typeof bootstrap !== 'undefined') {
        try {
            saveConfigModal = new bootstrap.Modal(saveConfigModalEl);
            console.log('Modal initialized successfully');
        } catch (error) {
            console.error('Error initializing modal:', error);
        }
    }
    
    // Add event listeners
    if (scrapeButton) {
        scrapeButton.addEventListener('click', function() {
            if (!validateScraperForm()) {
                showAlert('Please fill in all required fields', 'warning');
                return false;
            }
            scrapeJobs();
        });
        console.log('Scrape button listener attached');
    } else {
        console.error('Scrape button not found');
    }
    
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', openSaveConfigModal);
        console.log('Save config button listener attached');
    }
    
    // Add event listener to save config button
    const saveConfigConfirmBtn = document.getElementById('saveConfigConfirmBtn');
    if (saveConfigConfirmBtn) {
        saveConfigConfirmBtn.addEventListener('click', saveCurrentConfig);
    }
    
    // Load saved configurations
    loadSavedConfigs();
    
    // Advanced options toggle
    const advancedToggle = document.getElementById('advancedToggle');
    if (advancedToggle) {
        advancedToggle.addEventListener('click', function() {
            const icon = this.querySelector('i');
            if (icon.classList.contains('bi-chevron-down')) {
                icon.classList.remove('bi-chevron-down');
                icon.classList.add('bi-chevron-up');
            } else {
                icon.classList.remove('bi-chevron-up');
                icon.classList.add('bi-chevron-down');
            }
        });
    }
    
    // Setup experience level selection buttons
    const selectAllIncludeBtn = document.getElementById('selectAllInclude');
    if (selectAllIncludeBtn) {
        selectAllIncludeBtn.addEventListener('click', function() {
            document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
                checkbox.checked = true;
            });
        });
    }

    const clearAllIncludeBtn = document.getElementById('clearAllInclude');
    if (clearAllIncludeBtn) {
        clearAllIncludeBtn.addEventListener('click', function() {
            document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        });
    }
    
    // Set default experience levels if no config is loaded
    if (!document.querySelector('input[name="expInclude"]:checked')) {
        setDefaultExperienceLevels();
    }
});

/**
 * Validate scraper form
 */
function validateScraperForm() {
    let isValid = true;
    
    // Reset previous validation styling
    if (keywordsInput) keywordsInput.classList.remove('is-invalid');
    if (locationInput) locationInput.classList.remove('is-invalid');
    
    // Check keywords
    if (keywordsInput && !keywordsInput.value.trim()) {
        keywordsInput.classList.add('is-invalid');
        if (!document.getElementById('keywords-feedback')) {
            const feedbackDiv = document.createElement('div');
            feedbackDiv.id = 'keywords-feedback';
            feedbackDiv.className = 'invalid-feedback';
            feedbackDiv.textContent = 'Please enter job keywords';
            keywordsInput.parentNode.appendChild(feedbackDiv);
        }
        isValid = false;
    }
    
    // Check location
    if (locationInput && !locationInput.value.trim()) {
        locationInput.classList.add('is-invalid');
        if (!document.getElementById('location-feedback')) {
            const feedbackDiv = document.createElement('div');
            feedbackDiv.id = 'location-feedback';
            feedbackDiv.className = 'invalid-feedback';
            feedbackDiv.textContent = 'Please enter a location';
            locationInput.parentNode.appendChild(feedbackDiv);
        }
        isValid = false;
    }
    
    return isValid;
}

/**
 * Get selected experience level filters
 */
function getExperienceLevelFilters() {
    // Get experience level include checkboxes
    const experienceLevelInclude = Array.from(document.querySelectorAll('input[name="expInclude"]:checked'))
        .map(checkbox => checkbox.value);
    
    // Log the selections for debugging
    console.log('Experience Levels to Search:', experienceLevelInclude);
    
    return {
        include: experienceLevelInclude
    };
}

/**
 * Set default experience level checkboxes
 */
function setDefaultExperienceLevels() {
    console.log('Setting default experience levels');
    
    // Default to including entry to mid-senior levels
    document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
        const value = checkbox.value;
        if (value === 'Entry level' || value === 'Associate' || 
            value === 'Mid-Senior level' || value === 'Not specified') {
            checkbox.checked = true;
        } else {
            checkbox.checked = false;
        }
    });
}

/**
 * Scrape jobs from LinkedIn
 */
function scrapeJobs() {
    console.log('Starting LinkedIn scrape');
    
    // Get CSRF token from meta tag
    const csrfToken = getCsrfToken();
    const csrfHeader = getCsrfHeader();
    
    if (!csrfToken || !csrfHeader) {
        showAlert('Error: Security tokens not found', 'danger');
        return;
    }

    // Get form values
    const keywords = keywordsInput.value.trim();
    const location = locationInput.value.trim();
    const pagesToScrape = parseInt(pagesToScrapeInput.value);
    const remoteOnly = remoteOnlyCheckbox.checked;
    const jobType = jobTypeSelect.value;
    const daysOld = parseInt(daysOldSelect.value);
    
    // Get advanced filters
    const titleIncludeWords = document.getElementById('titleIncludeWords')?.value?.trim() || '';
    const titleExcludeWords = document.getElementById('titleExcludeWords')?.value?.trim() || '';
    const companyExcludeWords = document.getElementById('companyExcludeWords')?.value?.trim() || '';
    const descriptionExcludeWords = document.getElementById('descriptionExcludeWords')?.value?.trim() || '';
    
    // Get experience level filters
    const experienceLevels = getExperienceLevelFilters();
    
    // Validate required fields
    if (!keywords || !location) {
        showAlert('Please enter both keywords and location', 'danger');
        return;
    }
    
    // Create request payload
    const payload = {
        keywords: keywords,
        location: location,
        pagesToScrape: pagesToScrape,
        remoteOnly: remoteOnly,
        jobType: jobType,
        daysOld: daysOld,
        titleIncludeWords: titleIncludeWords ? titleIncludeWords.split(',') : [],
        titleExcludeWords: titleExcludeWords ? titleExcludeWords.split(',') : [],
        companyExcludeWords: companyExcludeWords ? companyExcludeWords.split(',') : [],
        descriptionExcludeWords: descriptionExcludeWords ? descriptionExcludeWords.split(',') : [],
        experienceLevelInclude: experienceLevels.include
    };
    
    console.log('Scraper payload:', payload);

    // Reset and show loading UI
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', '0');
        progressBarText.textContent = 'Starting scrape...';
    }
    
    if (statusUpdatesList) {
        statusUpdatesList.innerHTML = '';
        addStatusUpdate('Initializing scrape for "' + keywords + '" in "' + location + '"');
    }

    if (experienceLevelProgress) {
        experienceLevelProgress.textContent = 'Preparing...';
    }

    if (pageProgress) {
        pageProgress.textContent = 'Pages: 0/0';
    }
    
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
    
    if (scrapeButton) {
        scrapeButton.disabled = true;
    }
    
    // Define polling variables
    let pollInterval = null;
    const connectionTimeout = setTimeout(() => {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        addStatusUpdate('Connection timeout. Scraping may still be running in the background.');
        showAlert('Connection timeout. The scrape is still running in the background.', 'warning');
        hideLoadingIndicator();
    }, 3 * 60 * 1000); // 3 minute timeout
    
    // Send scrape request
    fetch('/api/jobs/scrape', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            [csrfHeader]: csrfToken
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Start polling for progress with the scrapeId
            const scrapeId = data.scrapeId;
            addStatusUpdate('Scrape started successfully. ID: ' + scrapeId);
            
            // Clear any existing interval
            if (window.pollInterval) {
                clearInterval(window.pollInterval);
            }
            
            // Poll for progress updates every 1 second
            window.pollInterval = setInterval(() => {
                pollScrapeProgress(scrapeId, csrfToken, csrfHeader, connectionTimeout);
            }, 1000);
        } else {
            clearTimeout(connectionTimeout);
            addStatusUpdate(`Error: ${data.message}`);
            showAlert(`Error: ${data.message}`, 'danger');
            hideLoadingIndicator();
        }
    })
    .catch(error => {
        clearTimeout(connectionTimeout);
        console.error('Error:', error);
        addStatusUpdate(`Error: ${error.message}`);
        showAlert(`Error: ${error.message}`, 'danger');
        hideLoadingIndicator();
    });
}

/**
 * Poll for scrape progress updates
 */
function pollScrapeProgress(scrapeId, csrfToken, csrfHeader, connectionTimeout) {
    fetch(`/api/jobs/scrape/progress?scrapeId=${scrapeId}`, {
        headers: {
            [csrfHeader]: csrfToken
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(progress => {
        console.log('Progress update:', progress);
        
        // Update the progress bar
        updateProgress(progress.percentComplete);
        
        // Update progress text
        if (progressBarText) {
            progressBarText.textContent = progress.status;
        }
        
        // Add status updates for significant events
        // Avoid spamming with too many similar updates by checking if it's different from last status
        const lastStatusUpdate = document.querySelector('#statusUpdatesList li:last-child');
        if (progress.status && 
            (!lastStatusUpdate || !lastStatusUpdate.textContent.includes(progress.status))) {
            addStatusUpdate(progress.status);
        }
        
        // Add experience level information if available
        if (progress.currentExperienceLevel && progress.totalExperienceLevels > 0) {
            const expText = `Experience level ${progress.experienceLevelIndex + 1}/${progress.totalExperienceLevels}: ${progress.currentExperienceLevel}`;
            if (experienceLevelProgress) {
                experienceLevelProgress.textContent = expText;
            }
        }
        
        // Update page progress
        if (pageProgress && progress.totalPages > 0) {
            pageProgress.textContent = `Pages: ${progress.currentPage}/${progress.totalPages}`;
        }
        
        // Special error case (marked with negative progress)
        if (progress.percentComplete < 0) {
            clearInterval(window.pollInterval);
            clearTimeout(connectionTimeout);
            
            addStatusUpdate(`Error: ${progress.status}`);
            showAlert(`Error: ${progress.status}`, 'danger');
            hideLoadingIndicator();
            return;
        }
        
        // If scraping is complete (100%), stop polling and load results
        if (progress.percentComplete >= 100) {
            clearInterval(window.pollInterval);
            clearTimeout(connectionTimeout);
            
            addStatusUpdate('Scraping completed successfully!');

            fetchRecentlyScrapedJobs(csrfToken, csrfHeader);
            
            // Also update the main search results if on search tab
            setTimeout(() => {
                if (document.getElementById('searchTabContent').style.display !== 'none') {
                    if (typeof searchJobs === 'function') {
                        searchJobs();
                    }
                }
                hideLoadingIndicator();
                showAlert('Scraping completed successfully!', 'success');
            }, 1000);
            return;
        }
    })
    .catch(error => {
        console.error('Error polling for progress:', error);
        
        // Don't automatically stop on the first error, might just be a temporary issue
        // Instead, add warning but continue polling
        addStatusUpdate(`Warning: Progress update failed: ${error.message}`);
    });
}

/**
 * Helper function to hide the loading indicator and re-enable the button
 */
function hideLoadingIndicator() {
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    if (scrapeButton) {
        scrapeButton.disabled = false;
    }
    
    // Clear any existing polling interval
    if (window.pollInterval) {
        clearInterval(window.pollInterval);
        window.pollInterval = null;
    }
}

/**
 * Update the progress bar
 */
function updateProgress(percent) {
    if (!progressBar || !progressBarText) return;
    
    // Handle error case (negative percent)
    if (percent < 0) {
        progressBar.style.width = '100%';
        progressBar.setAttribute('aria-valuenow', 100);
        progressBar.classList.remove('bg-success', 'bg-info', 'bg-warning');
        progressBar.classList.add('bg-danger');
        return;
    }
    
    // Normal progress update
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', percent);
    
    // Update progress bar color based on completion
    progressBar.classList.remove('bg-danger');
    if (percent < 30) {
        progressBar.classList.add('bg-info');
        progressBar.classList.remove('bg-warning', 'bg-success');
    } else if (percent < 70) {
        progressBar.classList.add('bg-warning');
        progressBar.classList.remove('bg-info', 'bg-success');
    } else {
        progressBar.classList.add('bg-success');
        progressBar.classList.remove('bg-info', 'bg-warning');
    }
}

/**
 * Add a status update to the list
 */
function addStatusUpdate(message) {
    if (!statusUpdatesList) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item small';
    
    // Highlight experience level updates
    if (message.includes('experience level')) {
        listItem.className += ' list-group-item-info';
    } else if (message.includes('Error') || message.includes('error')) {
        listItem.className += ' list-group-item-danger';
    } else if (message.includes('completed successfully')) {
        listItem.className += ' list-group-item-success';
    }
    
    listItem.innerHTML = `<span class="text-muted">[${timestamp}]</span> ${message}`;
    
    statusUpdatesList.appendChild(listItem);
    
    // Auto-scroll to bottom
    statusUpdatesList.scrollTop = statusUpdatesList.scrollHeight;
}

/**
 * Fetch recently scraped jobs
 */
function fetchRecentlyScrapedJobs(csrfToken, csrfHeader) {
    addStatusUpdate('Fetching recently scraped jobs...');
    
    // Use the search API with "recent" flag to get the most recently scraped jobs
    fetch('/api/jobs/search?daysOld=1', {
        headers: {
            [csrfHeader]: csrfToken
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(jobs => {
        // Display the recent jobs
        if (typeof displayRecentScrapedJobs === 'function') {
            displayRecentScrapedJobs(jobs);
        } else {
            console.error('displayRecentScrapedJobs function not found');
        }
        addStatusUpdate(`Found ${jobs.length} recently scraped jobs.`);
    })
    .catch(error => {
        console.error('Error fetching recent jobs:', error);
        addStatusUpdate(`Error fetching recent jobs: ${error.message}`);
    });
}

/**
 * Open the save configuration modal
 */
function openSaveConfigModal() {
    console.log('openSaveConfigModal function called');
    
    const configNameInput = document.getElementById('configName');
    const saveConfigError = document.getElementById('saveConfigError');
    
    // Reset modal
    if (configNameInput) {
        configNameInput.value = '';
    }
    
    if (saveConfigError) {
        saveConfigError.classList.add('d-none');
        saveConfigError.textContent = '';
    }
    
    // Show modal
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        try {
            console.log('Attempting to show modal using Bootstrap');
            const modal = new bootstrap.Modal(document.getElementById('saveConfigModal'));
            modal.show();
        } catch (error) {
            console.error('Error showing modal with Bootstrap:', error);
            
            // Fallback approach
            const modalEl = document.getElementById('saveConfigModal');
            if (modalEl) {
                modalEl.classList.add('show');
                modalEl.style.display = 'block';
                
                // Add backdrop
                let backdrop = document.querySelector('.modal-backdrop');
                if (!backdrop) {
                    backdrop = document.createElement('div');
                    backdrop.className = 'modal-backdrop fade show';
                    document.body.appendChild(backdrop);
                }
            }
        }
    } else {
        console.error('Bootstrap is not available');
        
        // Manual fallback
        const modalEl = document.getElementById('saveConfigModal');
        if (modalEl) {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
            
            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            document.body.appendChild(backdrop);
        }
    }
}

/**
 * Save the current scraper configuration
 */
function saveCurrentConfig() {
    console.log('saveCurrentConfig function called');
    
    const configNameInput = document.getElementById('configName');
    const saveConfigError = document.getElementById('saveConfigError');
    
    if (!configNameInput || !saveConfigError) {
        console.error('Required modal elements not found');
        return;
    }
    
    const configName = configNameInput.value.trim();
    
    if (!configName) {
        saveConfigError.textContent = 'Please enter a configuration name';
        saveConfigError.classList.remove('d-none');
        return;
    }
    
    // Get current form values
    const keywords = keywordsInput.value.trim();
    const location = locationInput.value.trim();
    const pagesToScrape = parseInt(pagesToScrapeInput.value);
    const remoteOnly = remoteOnlyCheckbox.checked;
    const jobType = jobTypeSelect.value;
    const daysOld = parseInt(daysOldSelect.value);
    
    // Get advanced filters
    const titleIncludeWords = document.getElementById('titleIncludeWords')?.value?.trim() || '';
    const titleExcludeWords = document.getElementById('titleExcludeWords')?.value?.trim() || '';
    const companyExcludeWords = document.getElementById('companyExcludeWords')?.value?.trim() || '';
    const descriptionExcludeWords = document.getElementById('descriptionExcludeWords')?.value?.trim() || '';
    
    // Get experience level filters
    const experienceLevels = getExperienceLevelFilters();
    
    // Create request payload
    const payload = {
        configName: configName,
        keywords: keywords,
        location: location,
        pagesToScrape: pagesToScrape,
        remoteOnly: remoteOnly,
        jobType: jobType,
        daysOld: daysOld,
        titleIncludeWords: titleIncludeWords ? titleIncludeWords.split(',') : [],
        titleExcludeWords: titleExcludeWords ? titleExcludeWords.split(',') : [],
        companyExcludeWords: companyExcludeWords ? companyExcludeWords.split(',') : [],
        descriptionExcludeWords: descriptionExcludeWords ? descriptionExcludeWords.split(',') : [],
        experienceLevelInclude: experienceLevels.include
    };
    
    console.log('Saving config payload:', payload);
    
    // Get CSRF token from meta tag
    const csrfToken = getCsrfToken();
    const csrfHeader = getCsrfHeader();
    
    if (!csrfToken || !csrfHeader) {
        saveConfigError.textContent = 'Error: Security tokens not found';
        saveConfigError.classList.remove('d-none');
        return;
    }
    
    // Send save request
    fetch('/api/configs/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            [csrfHeader]: csrfToken
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Close modal using Bootstrap if available
            try {
                const modal = document.getElementById('saveConfigModal');
                if (modal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) {
                        bsModal.hide();
                    } else {
                        const newModal = new bootstrap.Modal(modal);
                        newModal.hide();
                    }
                } else {
                    // Fallback close
                    modal.classList.remove('show');
                    modal.style.display = 'none';
                    document.querySelector('.modal-backdrop')?.remove();
                }
            } catch (e) {
                console.error('Error closing modal:', e);
            }
            
            // Show success message
            showAlert(`Configuration "${data.configName}" saved successfully`, 'success');
            
            // Refresh saved configs list
            loadSavedConfigs();
        } else {
            saveConfigError.textContent = data.message;
            saveConfigError.classList.remove('d-none');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        saveConfigError.textContent = `Error saving configuration: ${error.message}`;
        saveConfigError.classList.remove('d-none');
    });
}

/**
 * Load saved configurations
 */
function loadSavedConfigs() {
    console.log("Loading saved configurations...");
    
    const savedConfigsList = document.getElementById('savedConfigsList');
    if (!savedConfigsList) {
        console.error('Saved configs list element not found');
        return;
    }
    
    // Get CSRF token from meta tag
    const csrfToken = getCsrfToken();
    const csrfHeader = getCsrfHeader();
    
    if (!csrfToken || !csrfHeader) {
        console.error("CSRF tokens not found in page");
        savedConfigsList.innerHTML = '<li><span class="dropdown-item text-danger">Error: CSRF tokens not found</span></li>';
        return;
    }
    
    console.log("Fetching configurations with CSRF token");
    
    fetch('/api/configs', {
        headers: {
            [csrfHeader]: csrfToken
        }
    })
    .then(response => {
        console.log("Response status:", response.status);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(configs => {
        console.log("Received configurations:", configs);
        
        // Clear configs list
        savedConfigsList.innerHTML = '';
        
        if (!configs || configs.length === 0) {
            savedConfigsList.innerHTML = '<li><span class="dropdown-item text-muted">No saved configurations</span></li>';
            return;
        }
        
        // Add configs to dropdown
        configs.forEach(config => {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'dropdown-item';
            link.href = '#';
            link.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <span>${escapeHtml(config.name)}</span>
                    <button class="btn btn-sm btn-outline-danger delete-config-btn" data-config-id="${config.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <small class="text-muted">${escapeHtml(config.keywords)} in ${escapeHtml(config.location)}</small>
            `;
            
            link.addEventListener('click', function(e) {
                e.preventDefault();
                loadConfig(config.id);
            });
            
            item.appendChild(link);
            savedConfigsList.appendChild(item);
        });
        
        // Add event listeners to delete buttons
        document.querySelectorAll('.delete-config-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                deleteConfig(this.getAttribute('data-config-id'));
            });
        });
    })
    .catch(error => {
        console.error('Error loading configurations:', error);
        savedConfigsList.innerHTML = `<li><span class="dropdown-item text-danger">Error: ${error.message}</span></li>`;
    });
}

/**
 * Load a saved configuration
 */
function loadConfig(configId) {
    // Switch to the scraper tab
    if (typeof showScraperTab === 'function') {
        showScraperTab();
    } else {
        const scraperTabLink = document.getElementById('scraperTabLink');
        if (scraperTabLink) {
            scraperTabLink.click();
        }
    }
    
    // Get CSRF token from meta tag
    const csrfToken = getCsrfToken();
    const csrfHeader = getCsrfHeader();
    
    if (!csrfToken || !csrfHeader) {
        showAlert('Error: Security tokens not found', 'danger');
        return;
    }
    
    fetch(`/api/configs/${configId}`, {
        headers: {
            [csrfHeader]: csrfToken
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(config => {
        console.log('Loaded config:', config);
        
        // Populate form with config values
        if (keywordsInput) keywordsInput.value = config.keywords;
        if (locationInput) locationInput.value = config.location;
        if (pagesToScrapeInput) pagesToScrapeInput.value = config.pagesToScrape;
        if (remoteOnlyCheckbox) remoteOnlyCheckbox.checked = config.remoteOnly;
        if (jobTypeSelect) jobTypeSelect.value = config.jobType || '';
        if (daysOldSelect) daysOldSelect.value = config.daysOld;
        
        // Set advanced filters
        if (document.getElementById('titleIncludeWords')) {
            document.getElementById('titleIncludeWords').value = config.titleIncludeWords.join(',');
        }
        if (document.getElementById('titleExcludeWords')) {
            document.getElementById('titleExcludeWords').value = config.titleExcludeWords.join(',');
        }
        if (document.getElementById('companyExcludeWords')) {
            document.getElementById('companyExcludeWords').value = config.companyExcludeWords.join(',');
        }
        if (document.getElementById('descriptionExcludeWords')) {
            document.getElementById('descriptionExcludeWords').value = config.descriptionExcludeWords.join(',');
        }
        
        // Set experience level checkboxes
        setExperienceLevelCheckboxes(config);
        
        // Show success message
        showAlert('Configuration loaded successfully', 'success');
        
        // Scroll to top of page
        window.scrollTo(0, 0);
        
        // Switch to experience tab to show users the loaded experience levels
        setTimeout(() => {
            const expTab = document.getElementById('experience-filters-tab');
            if (expTab && typeof bootstrap !== 'undefined') {
                const bsTab = new bootstrap.Tab(expTab);
                bsTab.show();
            }
        }, 500);
    })
    .catch(error => {
        console.error('Error loading configuration:', error);
        showAlert(`Error loading configuration: ${error.message}`, 'danger');
    });
}

/**
 * Update experience level checkboxes from loaded config
 */
function setExperienceLevelCheckboxes(config) {
    // First uncheck all boxes to start fresh
    document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Check the ones from the config
    if (config.experienceLevelInclude && config.experienceLevelInclude.length > 0) {
        config.experienceLevelInclude.forEach(level => {
            const checkbox = document.querySelector(`input[name="expInclude"][value="${level}"]`);
            if (checkbox) {
                checkbox.checked = true;
            } else {
                console.warn(`Include checkbox for level "${level}" not found`);
            }
        });
    }
}

/**
 * Delete a saved configuration
 */
function deleteConfig(configId) {
    if (!confirm('Are you sure you want to delete this configuration?')) {
        return;
    }
    
    // Get CSRF token from meta tag
    const csrfToken = getCsrfToken();
    const csrfHeader = getCsrfHeader();
    
    if (!csrfToken || !csrfHeader) {
        showAlert('Error: Security tokens not found', 'danger');
        return;
    }
    
    fetch(`/api/configs/${configId}`, {
        method: 'DELETE',
        headers: {
            [csrfHeader]: csrfToken
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Show success message
            showAlert('Configuration deleted successfully', 'success');
            
            // Refresh saved configs list
            loadSavedConfigs();
        } else {
            showAlert(`Error: ${data.message}`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert(`Error deleting configuration: ${error.message}`, 'danger');
    });
}