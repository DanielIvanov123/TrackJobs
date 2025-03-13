// src/main/resources/static/js/main.js
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const scrapeButton = document.getElementById('scrapeButton');
    const keywordsInput = document.getElementById('keywords');
    const locationInput = document.getElementById('location');
    const pagesToScrapeInput = document.getElementById('pagesToScrape');
    const remoteOnlyCheckbox = document.getElementById('remoteOnly');
    const experienceLevelSelect = document.getElementById('experienceLevel');
    const jobTypeSelect = document.getElementById('jobType');
    const daysOldSelect = document.getElementById('daysOld');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const jobsContainer = document.getElementById('jobsContainer');
    const jobsCount = document.getElementById('jobsCount');
    const progressBar = document.getElementById('scrapeProgressBar');
    const progressBarText = document.getElementById('progressBarText');
    const statusUpdatesList = document.getElementById('statusUpdatesList');
    
    // Add event listener to scrape button
    if (scrapeButton) {
        scrapeButton.addEventListener('click', function() {
            scrapeJobs();
        });
    }
    
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
    
    /**
     * Function to scrape jobs from LinkedIn
     */
    function scrapeJobs() {
        // Get form values
        const keywords = keywordsInput.value.trim();
        const location = locationInput.value.trim();
        const pagesToScrape = parseInt(pagesToScrapeInput.value);
        const remoteOnly = remoteOnlyCheckbox.checked;
        const experienceLevel = experienceLevelSelect.value;
        const jobType = jobTypeSelect.value;
        const daysOld = parseInt(daysOldSelect.value);
        
        // Get advanced filters
        const titleIncludeWords = document.getElementById('titleIncludeWords')?.value?.trim() || '';
        const titleExcludeWords = document.getElementById('titleExcludeWords')?.value?.trim() || '';
        const companyExcludeWords = document.getElementById('companyExcludeWords')?.value?.trim() || '';
        const descriptionExcludeWords = document.getElementById('descriptionExcludeWords')?.value?.trim() || '';
        
        // Get experience level include and exclude checkboxes
        const experienceLevelInclude = Array.from(document.querySelectorAll('input[name="expInclude"]:checked'))
            .map(checkbox => checkbox.value);
        const experienceLevelExclude = Array.from(document.querySelectorAll('input[name="expExclude"]:checked'))
            .map(checkbox => checkbox.value);
        
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
            experienceLevel: experienceLevel,
            jobType: jobType,
            daysOld: daysOld,
            titleIncludeWords: titleIncludeWords ? titleIncludeWords.split(',') : [],
            titleExcludeWords: titleExcludeWords ? titleExcludeWords.split(',') : [],
            companyExcludeWords: companyExcludeWords ? companyExcludeWords.split(',') : [],
            descriptionExcludeWords: descriptionExcludeWords ? descriptionExcludeWords.split(',') : [],
            experienceLevelInclude: experienceLevelInclude,
            experienceLevelExclude: experienceLevelExclude
        };
        
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
                'Content-Type': 'application/json'
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
                
                // Update job count
                if (jobsCount) {
                    jobsCount.textContent = data.jobsFound;
                }
                
                // Display the jobs
                if (data.jobs && data.jobs.length > 0) {
                    displayJobs(data.jobs);
                } else {
                    showNoJobsMessage();
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
     * Display jobs in the container
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
        
        // Add success message
        const messageRow = document.createElement('div');
        messageRow.className = 'col-12 mt-3';
        messageRow.innerHTML = `
            <div class="alert alert-success">
                <i class="bi bi-check-circle-fill me-2"></i>
                Successfully scraped ${jobs.length} jobs! Use the filters above to refine your search or scrape more jobs.
            </div>
        `;
        jobsContainer.appendChild(messageRow);
    }
    
    /**
     * Show no jobs message
     */
    function showNoJobsMessage() {
        jobsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle-fill me-2"></i>
                    No jobs found. Try different search criteria or filters.
                </div>
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