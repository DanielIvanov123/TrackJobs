document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements for navigation
    const searchTabLink = document.getElementById('searchTabLink');
    const scraperTabLink = document.getElementById('scraperTabLink');
    const searchTabContent = document.getElementById('searchTabContent');
    const scraperTabContent = document.getElementById('scraperTabContent');
    
    // Search tab elements
    const searchButton = document.getElementById('searchButton');
    const searchKeywordsInput = document.getElementById('searchKeywords');
    const searchLocationInput = document.getElementById('searchLocation');
    const searchExperienceLevelSelect = document.getElementById('searchExperienceLevel');
    const searchJobTypeSelect = document.getElementById('searchJobType');
    const searchDatePostedSelect = document.getElementById('searchDatePosted');
    const searchRemoteOnlyCheckbox = document.getElementById('searchRemoteOnly');
    
    // Scraper tab elements
    const scrapeButton = document.getElementById('scrapeButton');
    const keywordsInput = document.getElementById('keywords');
    const locationInput = document.getElementById('location');
    const pagesToScrapeInput = document.getElementById('pagesToScrape');
    const remoteOnlyCheckbox = document.getElementById('remoteOnly');
    const jobTypeSelect = document.getElementById('jobType');
    const daysOldSelect = document.getElementById('daysOld');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const recentScrapedJobsContainer = document.getElementById('recentScrapedJobs');
    
    // Shared elements
    const jobsContainer = document.getElementById('jobsContainer');
    const jobsCount = document.getElementById('jobsCount');
    const progressBar = document.getElementById('scrapeProgressBar');
    const progressBarText = document.getElementById('progressBarText');
    const statusUpdatesList = document.getElementById('statusUpdatesList');
    const experienceLevelProgress = document.getElementById('experienceLevelProgress');
    const pageProgress = document.getElementById('pageProgress');
    
    // Save config elements
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const saveConfigModalEl = document.getElementById('saveConfigModal');
    let saveConfigModal;
    
    // Only initialize Modal if the element exists
    if (saveConfigModalEl) {
        try {
            saveConfigModal = new bootstrap.Modal(saveConfigModalEl);
            console.log('Modal initialized successfully');
        } catch (error) {
            console.error('Error initializing modal:', error);
        }
    } else {
        console.error('Modal element not found in the DOM');
    }
    
    const saveConfigConfirmBtn = document.getElementById('saveConfigConfirmBtn');
    const configNameInput = document.getElementById('configName');
    const savedConfigsList = document.getElementById('savedConfigsList');
    const saveConfigError = document.getElementById('saveConfigError');

    // Debug console logs
    console.log('Save Config Button found:', !!saveConfigBtn);
    console.log('Save Config Modal found:', !!saveConfigModalEl);
    
    // Add tab navigation event listeners
    if (searchTabLink) {
        searchTabLink.addEventListener('click', function(e) {
            e.preventDefault();
            showSearchTab();
        });
    }
    
    if (scraperTabLink) {
        scraperTabLink.addEventListener('click', function(e) {
            e.preventDefault();
            showScraperTab();
        });
    }
    
    // Tab switching functions
    function showSearchTab() {
        // Update active state in navigation
        searchTabLink.classList.add('active');
        scraperTabLink.classList.remove('active');
        
        // Show/hide content
        searchTabContent.style.display = 'block';
        scraperTabContent.style.display = 'none';
    }
    
    function showScraperTab() {
        // Update active state in navigation
        searchTabLink.classList.remove('active');
        scraperTabLink.classList.add('active');
        
        // Show/hide content
        searchTabContent.style.display = 'none';
        scraperTabContent.style.display = 'block';
    }
    
    // Add event listeners for search functionality
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            searchJobs();
        });
    }
    
    // Add event listeners for scraper functionality
    if (scrapeButton) {
        scrapeButton.addEventListener('click', function() {
            if (!validateScraperForm()) {
                showAlert('Please fill in all required fields', 'warning');
                return false;
            }
            scrapeJobs();
        });
    }
    
    // Add event listeners for config saving
    if (saveConfigBtn) {
        console.log('Adding click event listener to Save Config Button');
        saveConfigBtn.addEventListener('click', function() {
            console.log('Save Config Button clicked');
            openSaveConfigModal();
        });
    }
    
    if (saveConfigConfirmBtn) {
        saveConfigConfirmBtn.addEventListener('click', saveCurrentConfig);
    }

    // Load saved configurations when page loads
    loadSavedConfigs();
    
    // Add event listener to advanced options toggle
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
    
    // Setup the Select All and Clear All buttons for experience levels
    document.getElementById('selectAllInclude')?.addEventListener('click', function() {
        document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
            checkbox.checked = true;
        });
    });

    document.getElementById('clearAllInclude')?.addEventListener('click', function() {
        document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    });
    
    // Set default experience levels if no config is loaded
    if (!document.querySelector('input[name="expInclude"]:checked')) {
        setDefaultExperienceLevels();
    }

    // Add tooltips for the filter options
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    if (tooltipTriggerList.length > 0) {
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    // Save active tab state between sessions
    const scraperFilterTabs = document.getElementById('scraperFilterTabs');
    if (scraperFilterTabs) {
        // Save active tab when switching
        scraperFilterTabs.addEventListener('shown.bs.tab', function (event) {
            localStorage.setItem('activeScraperTab', event.target.id);
        });
        
        // Restore active tab on page load
        const activeTab = localStorage.getItem('activeScraperTab');
        if (activeTab) {
            const tab = document.getElementById(activeTab);
            if (tab) {
                const bsTab = new bootstrap.Tab(tab);
                bsTab.show();
            }
        }
    }

    /**
     * Get selected experience level values
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
     * Set default experience level checkboxes based on common job search patterns
     */
    function setDefaultExperienceLevels() {
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
     * Validate the scraper form for required fields
     */
    function validateScraperForm() {
        let isValid = true;
        const keywords = document.getElementById('keywords');
        const location = document.getElementById('location');
        
        // Reset previous validation styling
        keywords?.classList.remove('is-invalid');
        location?.classList.remove('is-invalid');
        
        // Check keywords
        if (keywords && !keywords.value.trim()) {
            keywords.classList.add('is-invalid');
            if (!document.getElementById('keywords-feedback')) {
                const feedbackDiv = document.createElement('div');
                feedbackDiv.id = 'keywords-feedback';
                feedbackDiv.className = 'invalid-feedback';
                feedbackDiv.textContent = 'Please enter job keywords';
                keywords.parentNode.appendChild(feedbackDiv);
            }
            isValid = false;
        }
        
        // Check location
        if (location && !location.value.trim()) {
            location.classList.add('is-invalid');
            if (!document.getElementById('location-feedback')) {
                const feedbackDiv = document.createElement('div');
                feedbackDiv.id = 'location-feedback';
                feedbackDiv.className = 'invalid-feedback';
                feedbackDiv.textContent = 'Please enter a location';
                location.parentNode.appendChild(feedbackDiv);
            }
            isValid = false;
        }
        
        return isValid;
    }

    /**
     * Open the save configuration modal
     */
    function openSaveConfigModal() {
        console.log('openSaveConfigModal function called');
        
        // Reset modal
        if (configNameInput) {
            configNameInput.value = '';
        }
        
        if (saveConfigError) {
            saveConfigError.classList.add('d-none');
            saveConfigError.textContent = '';
        }
        
        // Show modal
        if (saveConfigModal) {
            try {
                console.log('Attempting to show modal');
                saveConfigModal.show();
            } catch (error) {
                console.error('Error showing modal:', error);
                
                // Fallback: try to use jQuery if Bootstrap's show() method fails
                try {
                    $('#saveConfigModal').modal('show');
                } catch (jqueryError) {
                    console.error('Fallback jQuery method also failed:', jqueryError);
                    
                    // Last resort: direct DOM manipulation
                    const modalEl = document.getElementById('saveConfigModal');
                    if (modalEl) {
                        modalEl.classList.add('show');
                        modalEl.style.display = 'block';
                        document.body.classList.add('modal-open');
                        
                        // Create backdrop
                        const backdrop = document.createElement('div');
                        backdrop.className = 'modal-backdrop fade show';
                        document.body.appendChild(backdrop);
                    }
                }
            }
        } else {
            console.error('Modal not initialized');
            
            // Try to initialize modal again
            const modalEl = document.getElementById('saveConfigModal');
            if (modalEl) {
                try {
                    saveConfigModal = new bootstrap.Modal(modalEl);
                    saveConfigModal.show();
                } catch (error) {
                    console.error('Error re-initializing modal:', error);
                }
            }
        }
    }
    
    /**
     * Function to search jobs from the database
     */
    function searchJobs() {
        console.log('Searching for jobs in database');
        
        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
        
        // Get search form values
        const keywords = searchKeywordsInput.value.trim();
        const location = searchLocationInput.value.trim();
        const experienceLevel = searchExperienceLevelSelect.value;
        const jobType = searchJobTypeSelect.value;
        const daysOld = parseInt(searchDatePostedSelect.value);
        const remoteOnly = searchRemoteOnlyCheckbox.checked;
        
        // Log search parameters for debugging
        console.log('Search parameters:', {
            keywords,
            location,
            experienceLevel,
            jobType,
            daysOld,
            remoteOnly
        });
        
        // Show loading message in jobs container
        jobsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Searching jobs...</p>
            </div>
        `;
        
        // Create query params
        let queryParams = new URLSearchParams();
        if (keywords) queryParams.append('keywords', keywords);
        if (location) queryParams.append('location', location);
        if (experienceLevel) queryParams.append('experienceLevel', experienceLevel);
        if (jobType) queryParams.append('jobType', jobType);
        if (daysOld > 0) queryParams.append('daysOld', daysOld.toString());
        queryParams.append('remoteOnly', remoteOnly.toString());
        
        const queryString = queryParams.toString();
        console.log('Query string:', queryString);
        
        // Make API request to search jobs
        fetch(`/api/jobs/search?${queryString}`, {
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
            console.log(`Received ${jobs.length} jobs from server`);
            
            // Update job count
            if (jobsCount) {
                jobsCount.textContent = jobs.length;
            }
            
            // Display the jobs
            displayJobs(jobs);
            
            // Show success message
            showAlert(`Found ${jobs.length} matching jobs`, 'success');
        })
        .catch(error => {
            console.error('Error searching jobs:', error);
            jobsContainer.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-circle-fill me-2"></i>
                        Error searching jobs: ${error.message}
                    </div>
                </div>
            `;
            showAlert(`Error searching jobs: ${error.message}`, 'danger');
        });
    }
    
    /**
     * Function to scrape jobs from LinkedIn
     */
    function scrapeJobs() {
        console.log('Starting LinkedIn scrape');
        
        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
    
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
        
        loadingIndicator.style.display = 'block';
        scrapeButton.disabled = true;
        
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
                        searchJobs();
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
     * Fetch final scraping results
     */
    function fetchScrapingResults(scrapeId, csrfToken, csrfHeader) {
        fetch(`/api/jobs/scrape/results?scrapeId=${scrapeId}`, {
            headers: {
                [csrfHeader]: csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                addStatusUpdate(`Scraping completed! Found ${data.jobsFound} jobs after filtering.`);
                
                if (data.totalJobsScraped > data.jobsFound) {
                    addStatusUpdate(`Filtered out ${data.totalJobsScraped - data.jobsFound} jobs based on your criteria.`);
                }
                
                if (data.duplicatesSkipped > 0) {
                    addStatusUpdate(`Skipped ${data.duplicatesSkipped} duplicate jobs already in the database.`);
                }
                
                showAlert(`Successfully scraped ${data.jobsFound} jobs!`, 'success');
                
                // Display the recently scraped jobs
                if (data.jobs && data.jobs.length > 0) {
                    displayRecentScrapedJobs(data.jobs);
                } else {
                    showNoRecentJobsMessage();
                }
            } else {
                addStatusUpdate(`Error: ${data.message}`);
                showAlert(`Error: ${data.message}`, 'danger');
            }
            
            // Hide loading indicator and enable the scrape button
            loadingIndicator.style.display = 'none';
            scrapeButton.disabled = false;
        })
        .catch(error => {
            console.error('Error fetching results:', error);
            addStatusUpdate(`Error fetching results: ${error.message}`);
            showAlert(`Error fetching results: ${error.message}`, 'danger');
            
            loadingIndicator.style.display = 'none';
            scrapeButton.disabled = false;
        });
    }
    
    /**
     * Save the current scraper configuration
     */
    function saveCurrentConfig() {
        console.log('saveCurrentConfig function called');
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
        const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
        
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
                // Close modal
                saveConfigModal.hide();
                
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
        
        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]')?.getAttribute('content');
        
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
        showScraperTab();
        
        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
        
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
            keywordsInput.value = config.keywords;
            locationInput.value = config.location;
            pagesToScrapeInput.value = config.pagesToScrape;
            remoteOnlyCheckbox.checked = config.remoteOnly;
            jobTypeSelect.value = config.jobType || '';
            daysOldSelect.value = config.daysOld;
            
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
                if (expTab) {
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
        const csrfToken = document.querySelector('meta[name="_csrf"]').getAttribute('content');
        const csrfHeader = document.querySelector('meta[name="_csrf_header"]').getAttribute('content');
        
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

    /**
     * Get CSRF token from meta tag
     */
    function getCsrfToken() {
        const metaTag = document.querySelector('meta[name="_csrf"]');
        return metaTag ? metaTag.getAttribute('content') : '';
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

    // Helper function to check if text contains a string (for status update filtering)
    if (typeof jQuery !== 'undefined') {
        jQuery.expr[':'].contains = function(a, i, m) {
            return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0;
        };
    }
    
    /**
     * Display jobs in the container - used for search results
     */
    function displayJobs(jobs) {
        // Clear container
        jobsContainer.innerHTML = '';
        
        if (!jobs || jobs.length === 0) {
            showNoJobsMessage();
            return;
        }
        
        // Create a card for each job
        jobs.forEach(job => {
            const jobCard = document.createElement('div');
            jobCard.className = 'col-md-4 mb-4';
            jobCard.innerHTML = `
                <div class="card h-100 job-card">
                    <div class="card-body">
                        <h5 class="card-title">${escapeHtml(job.title)}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">${escapeHtml(job.company)}</h6>
                        <p class="card-text">
                            <i class="bi bi-geo-alt-fill"></i> ${escapeHtml(job.location)}<br>
                            <i class="bi bi-calendar"></i> ${formatDate(job.datePosted)}<br>
                            <i class="bi bi-briefcase-fill"></i> ${escapeHtml(job.experienceLevel || 'Not specified')}<br>
                            <i class="bi bi-clock"></i> ${escapeHtml(job.jobType || 'Not specified')}
                        </p>
                    </div>
                    <div class="card-footer bg-transparent">
                        ${job.url ? `
                            <a href="${escapeHtml(job.url)}" target="_blank" class="btn btn-sm btn-outline-primary w-100">
                                <i class="bi bi-linkedin me-2"></i>View on LinkedIn
                            </a>
                        ` : `
                            <button class="btn btn-sm btn-outline-secondary w-100" disabled>
                                No URL Available
                            </button>
                        `}
                    </div>
                </div>
            `;
            
            jobsContainer.appendChild(jobCard);
        });
    }
    
    /**
     * Display recently scraped jobs
     */
    function displayRecentScrapedJobs(jobs) {
        if (!recentScrapedJobsContainer) return;
        
        // Clear container
        recentScrapedJobsContainer.innerHTML = '';
        
        if (!jobs || jobs.length === 0) {
            showNoRecentJobsMessage();
            return;
        }
        
        // Create a row for the jobs
        const row = document.createElement('div');
        row.className = 'row';
        
        // Create a card for each job (limit to 3)
        const maxJobsToShow = Math.min(jobs.length, 3);
        for (let i = 0; i < maxJobsToShow; i++) {
            const job = jobs[i];
            const jobCard = document.createElement('div');
            jobCard.className = 'col-md-4 mb-4';
            jobCard.innerHTML = `
                <div class="card h-100 job-card">
                    <div class="card-body">
                        <h5 class="card-title">${escapeHtml(job.title)}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">${escapeHtml(job.company)}</h6>
                        <p class="card-text">
                            <i class="bi bi-geo-alt-fill"></i> ${escapeHtml(job.location)}<br>
                            <i class="bi bi-calendar"></i> ${formatDate(job.datePosted)}<br>
                            <i class="bi bi-briefcase-fill"></i> ${escapeHtml(job.experienceLevel || 'Not specified')}
                        </p>
                    </div>
                    <div class="card-footer bg-transparent">
                        ${job.url ? `
                            <a href="${escapeHtml(job.url)}" target="_blank" class="btn btn-sm btn-outline-primary w-100">
                                <i class="bi bi-linkedin me-2"></i>View on LinkedIn
                            </a>
                        ` : `
                            <button class="btn btn-sm btn-outline-secondary w-100" disabled>
                                No URL Available
                            </button>
                        `}
                    </div>
                </div>
            `;
            
            row.appendChild(jobCard);
        }
        
        // Add view all button if needed
        if (jobs.length > 3) {
            const viewAllDiv = document.createElement('div');
            viewAllDiv.className = 'col-12 text-center mt-3';
            viewAllDiv.innerHTML = `
                <button class="btn btn-outline-primary" id="viewAllJobsBtn">
                    <i class="bi bi-list me-2"></i>View All ${jobs.length} Jobs
                </button>
            `;
            row.appendChild(viewAllDiv);
            
            // Add event listener
            setTimeout(() => {
                const viewAllBtn = document.getElementById('viewAllJobsBtn');
                if (viewAllBtn) {
                    viewAllBtn.addEventListener('click', function() {
                        // Switch to search tab
                        showSearchTab();
                        
                        // Update the search form to match the scrape
                        searchKeywordsInput.value = keywordsInput.value;
                        searchLocationInput.value = locationInput.value;
                        
                        // Trigger a search
                        setTimeout(searchJobs, 500);
                    });
                }
            }, 100);
        }
        
        recentScrapedJobsContainer.appendChild(row);
    }
    
    /**
     * Show no jobs message
     */
    function showNoJobsMessage() {
        jobsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle-fill me-2"></i>
                    No jobs found. Try different search criteria or use the scraper to get new jobs.
                </div>
            </div>
        `;
    }
    
    /**
     * Show no recent jobs message
     */
    function showNoRecentJobsMessage() {
        if (!recentScrapedJobsContainer) return;
        
        recentScrapedJobsContainer.innerHTML = `
            <div class="col-12 text-center">
                <p class="text-muted">No recently scraped jobs to display</p>
            </div>
        `;
    }
    
    /**
     * Show an alert message
     */
    function showAlert(message, type) {
        // Create alert container if it doesn't exist
        let alertContainer = document.querySelector('.alert-container');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.className = 'alert-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(alertContainer);
        }
        
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add to container
        alertContainer.appendChild(alert);
        
        // Auto dismiss after 5 seconds
        setTimeout(() => {
            // Check if alert still exists
            if (alert.parentNode) {
                // Create Bootstrap alert instance and hide it
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }
    
    /**
     * Format a date string
     */
    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(str) {
        if (!str) return '';
        
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    // Handle delete confirmation
    const deleteConfirmInput = document.getElementById('deleteConfirmInput');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    if (deleteConfirmInput && confirmDeleteBtn) {
        console.log('Delete confirmation elements found');
        
        // Log initial state
        console.log('Initial button state:', confirmDeleteBtn.disabled);
        
        deleteConfirmInput.addEventListener('input', function(e) {
            const isMatch = this.value === 'DELETE';
            console.log('Input value:', this.value, 'Is match:', isMatch);
            confirmDeleteBtn.disabled = !isMatch;
        });
        
        // Reset input when modal is closed
        const wipeDataModal = document.getElementById('wipeDataModal');
        if (wipeDataModal) {
            wipeDataModal.addEventListener('hidden.bs.modal', function() {
                deleteConfirmInput.value = '';
                confirmDeleteBtn.disabled = true;
            });
        }
    } else {
        console.error('Delete confirmation elements not found:', {
            deleteConfirmInput: !!deleteConfirmInput,
            confirmDeleteBtn: !!confirmDeleteBtn
        });
    }
    /**
     * Fetch and display recently scraped jobs
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
            // Display the recent jobs in the recent jobs container
            displayRecentScrapedJobs(jobs);
            addStatusUpdate(`Found ${jobs.length} recently scraped jobs.`);
        })
        .catch(error => {
            console.error('Error fetching recent jobs:', error);
            addStatusUpdate(`Error fetching recent jobs: ${error.message}`);
        });
    }

    /**
     * Display recently scraped jobs
     */
    function displayRecentScrapedJobs(jobs) {
        const recentScrapedJobsContainer = document.getElementById('recentScrapedJobs');
        if (!recentScrapedJobsContainer) return;
        
        // Clear container
        recentScrapedJobsContainer.innerHTML = '';
        
        if (!jobs || jobs.length === 0) {
            recentScrapedJobsContainer.innerHTML = `
                <div class="col-12 text-center">
                    <p class="text-muted">No recently scraped jobs to display</p>
                </div>
            `;
            return;
        }
        
        // Create a row for the jobs
        const row = document.createElement('div');
        row.className = 'row';
        
        // Create a card for each job (limit to 3)
        const maxJobsToShow = Math.min(jobs.length, 3);
        for (let i = 0; i < maxJobsToShow; i++) {
            const job = jobs[i];
            const jobCard = document.createElement('div');
            jobCard.className = 'col-md-4 mb-4';
            jobCard.innerHTML = `
                <div class="card h-100 job-card">
                    <div class="card-body">
                        <h5 class="card-title">${escapeHtml(job.title)}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">${escapeHtml(job.company)}</h6>
                        <p class="card-text">
                            <i class="bi bi-geo-alt-fill"></i> ${escapeHtml(job.location)}<br>
                            <i class="bi bi-calendar"></i> ${formatDate(job.datePosted)}<br>
                            <i class="bi bi-briefcase-fill"></i> ${escapeHtml(job.experienceLevel || 'Not specified')}
                        </p>
                    </div>
                    <div class="card-footer bg-transparent">
                        ${job.url ? `
                            <a href="${escapeHtml(job.url)}" target="_blank" class="btn btn-sm btn-outline-primary w-100">
                                <i class="bi bi-linkedin me-2"></i>View on LinkedIn
                            </a>
                        ` : `
                            <button class="btn btn-sm btn-outline-secondary w-100" disabled>
                                No URL Available
                            </button>
                        `}
                    </div>
                </div>
            `;
            
            row.appendChild(jobCard);
        }
        
        // Add view all button if needed
        if (jobs.length > 3) {
            const viewAllDiv = document.createElement('div');
            viewAllDiv.className = 'col-12 text-center mt-3';
            viewAllDiv.innerHTML = `
                <button class="btn btn-outline-primary" id="viewAllJobsBtn">
                    <i class="bi bi-list me-2"></i>View All ${jobs.length} Jobs
                </button>
            `;
            row.appendChild(viewAllDiv);
            
            // Add event listener
            setTimeout(() => {
                const viewAllBtn = document.getElementById('viewAllJobsBtn');
                if (viewAllBtn) {
                    viewAllBtn.addEventListener('click', function() {
                        // Switch to search tab
                        if (searchTabLink && typeof showSearchTab === 'function') {
                            showSearchTab();
                        } else {
                            // Fallback if the function isn't available
                            document.getElementById('searchTabLink')?.click();
                        }
                        
                        // Trigger a search
                        setTimeout(searchJobs, 500);
                    });
                }
            }, 100);
        }
        
        recentScrapedJobsContainer.appendChild(row);
    }
    
});