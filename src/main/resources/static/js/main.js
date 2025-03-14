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
        
        // Handle conflicts - anything checked in exclude should not be in include
        const excludeValues = Array.from(document.querySelectorAll('input[name="expExclude"]:checked'))
            .map(checkbox => checkbox.value);
        
        excludeValues.forEach(value => {
            const includeCheckbox = document.querySelector(`input[name="expInclude"][value="${value}"]`);
            if (includeCheckbox) {
                includeCheckbox.checked = false;
            }
        });
    });

    document.getElementById('clearAllInclude')?.addEventListener('click', function() {
        document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    });

    document.getElementById('selectAllExclude')?.addEventListener('click', function() {
        document.querySelectorAll('input[name="expExclude"]').forEach(checkbox => {
            checkbox.checked = true;
        });
        
        // Since exclude takes precedence, uncheck all include checkboxes
        document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        showAlert("Cleared all include checkboxes since all levels are now excluded", "info");
    });

    document.getElementById('clearAllExclude')?.addEventListener('click', function() {
        document.querySelectorAll('input[name="expExclude"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    });
    
    // Setup experience level conflict handling
    setupExperienceLevelConflictHandling();
    
    // Set default experience levels if no config is loaded
    if (!document.querySelector('input[name="expInclude"]:checked') && 
        !document.querySelector('input[name="expExclude"]:checked')) {
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
     * Ensures that experience levels aren't in both include and exclude lists
     * (exclude takes precedence)
     */
    function getExperienceLevelFilters() {
        // Get experience level include and exclude checkboxes
        const experienceLevelInclude = Array.from(document.querySelectorAll('input[name="expInclude"]:checked'))
            .map(checkbox => checkbox.value);
        
        const experienceLevelExclude = Array.from(document.querySelectorAll('input[name="expExclude"]:checked'))
            .map(checkbox => checkbox.value);
        
        // Log the selections for debugging
        console.log('Experience Level Include:', experienceLevelInclude);
        console.log('Experience Level Exclude:', experienceLevelExclude);
        
        // Remove any values from include that are also in exclude (exclude takes precedence)
        const filteredInclude = experienceLevelInclude.filter(value => !experienceLevelExclude.includes(value));
        
        if (filteredInclude.length !== experienceLevelInclude.length) {
            console.log('Removed duplicate levels from include (exclude takes precedence)');
            console.log('Filtered Include:', filteredInclude);
        }
        
        return {
            include: filteredInclude,
            exclude: experienceLevelExclude
        };
    }

    /**
     * Handle conflicts when a checkbox is checked in both include and exclude sections
     * When an exclude checkbox is checked, uncheck it from the include section
     */
    function setupExperienceLevelConflictHandling() {
        // When exclude checkboxes are checked
        document.querySelectorAll('input[name="expExclude"]').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    // Find the corresponding checkbox in the include section
                    const includeCheckbox = document.querySelector(`input[name="expInclude"][value="${this.value}"]`);
                    if (includeCheckbox && includeCheckbox.checked) {
                        // Uncheck it and show a tooltip notification
                        includeCheckbox.checked = false;
                        
                        // Show a brief notification
                        showAlert(`Removed "${this.value}" from include list (exclude takes precedence)`, 'info');
                    }
                }
            });
        });
    }

    /**
     * Set default experience level checkboxes based on common job search patterns
     */
    function setDefaultExperienceLevels() {
        // Default to including entry to mid-senior levels
        document.querySelectorAll('input[name="expInclude"]').forEach(checkbox => {
            const value = checkbox.value;
            if (value === 'ENTRY_LEVEL' || value === 'ASSOCIATE' || 
                value === 'MID_SENIOR' || value === 'NOT_APPLICABLE') {
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
            }
        });
        
        // Default to excluding executive and director levels
        document.querySelectorAll('input[name="expExclude"]').forEach(checkbox => {
            const value = checkbox.value;
            if (value === 'DIRECTOR' || value === 'EXECUTIVE') {
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
        
        // Reset and show loading UI
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.setAttribute('aria-valuenow', '0');
            progressBarText.textContent = 'Starting scrape...';
        }
        
        if (statusUpdatesList) {
            statusUpdatesList.innerHTML = '';
            addStatusUpdate('Initializing scrape for "' + keywords + '" in "' + location + '"');
            addStatusUpdate('Connecting to LinkedIn...');
        }
        
        loadingIndicator.style.display = 'block';
        scrapeButton.disabled = true;
        
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
            experienceLevelInclude: experienceLevels.include,
            experienceLevelExclude: experienceLevels.exclude
        };
        
        console.log('Scraper payload:', payload);
        
        // Start progress simulation
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 1;
            if (progress > 95) {
                clearInterval(progressInterval);
            }
            updateProgress(progress);
        }, pagesToScrape * 300); // Adjust timing based on pages
        
        // Status updates simulation
        setTimeout(() => addStatusUpdate('Successfully connected to LinkedIn'), 1000);
        setTimeout(() => addStatusUpdate('Starting to scrape job listings...'), 2000);
        for (let i = 1; i <= pagesToScrape; i++) {
            setTimeout(() => {
                addStatusUpdate(`Scraping page ${i} of ${pagesToScrape}...`);
            }, 2000 + (i * 3000));
        }
        
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
                console.error('Response status:', response.status);
                console.error('Response headers:', response.headers);
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Stop progress simulation
            clearInterval(progressInterval);
            updateProgress(100);
            
            if (data.success) {
                addStatusUpdate(`Scraping completed! Found ${data.jobsFound} jobs after filtering.`);
                
                if (data.totalJobsScraped > data.jobsFound) {
                    addStatusUpdate(`Filtered out ${data.totalJobsScraped - data.jobsFound} jobs based on your criteria.`);
                }
                
                if (data.duplicatesSkipped > 0) {
                    addStatusUpdate(`Skipped ${data.duplicatesSkipped} duplicate jobs already in the database.`);
                }
                
                // Show detailed stats
                addStatusUpdate(`Scraping completed in ${data.formattedDuration}. Scraped ${data.pagesScraped} pages.`);
                
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
        })
        .catch(error => {
            // Stop progress simulation
            clearInterval(progressInterval);
            updateProgress(0);
            
            console.error('Error:', error);
            addStatusUpdate(`Error: ${error.message}`);
            showAlert(`Error: ${error.message}`, 'danger');
        })
        .finally(() => {
            // Hide loading indicator
            setTimeout(() => {
                loadingIndicator.style.display = 'none';
                scrapeButton.disabled = false;
            }, 1000);
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
            experienceLevelInclude: experienceLevels.include,
            experienceLevelExclude: experienceLevels.exclude
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
        
        document.querySelectorAll('input[name="expExclude"]').forEach(checkbox => {
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
        
        if (config.experienceLevelExclude && config.experienceLevelExclude.length > 0) {
            config.experienceLevelExclude.forEach(level => {
                const checkbox = document.querySelector(`input[name="expExclude"][value="${level}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                } else {
                    console.warn(`Exclude checkbox for level "${level}" not found`);
                }
            });
        }
        
        // Handle conflicts (exclude takes precedence)
        const excludeValues = Array.from(document.querySelectorAll('input[name="expExclude"]:checked'))
            .map(checkbox => checkbox.value);
        
        excludeValues.forEach(value => {
            const includeCheckbox = document.querySelector(`input[name="expInclude"][value="${value}"]`);
            if (includeCheckbox && includeCheckbox.checked) {
                includeCheckbox.checked = false;
                console.log(`Resolved conflict: ${value} was in both include and exclude (exclude wins)`);
            }
        });
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
        
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
        
        if (percent < 20) {
            progressBarText.textContent = 'Starting scrape...';
        } else if (percent < 50) {
            progressBarText.textContent = 'Scraping jobs...';
        } else if (percent < 75) {
            progressBarText.textContent = 'Processing results...';
        } else if (percent < 100) {
            progressBarText.textContent = 'Filtering jobs...';
        } else {
            progressBarText.textContent = 'Scrape completed!';
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
        listItem.innerHTML = `<span class="text-muted">[${timestamp}]</span> ${message}`;
        
        statusUpdatesList.appendChild(listItem);
        
        // Auto-scroll to bottom
        statusUpdatesList.scrollTop = statusUpdatesList.scrollHeight;
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
                            <i class="bi bi-calendar"></i> ${formatDate(job.datePosted)}
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
});