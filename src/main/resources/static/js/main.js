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
    
    // Add event listener to scrape button
    if (scrapeButton) {
        scrapeButton.addEventListener('click', function() {
            scrapeJobs();
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
        
        // Validate required fields
        if (!keywords || !location) {
            showAlert('Please enter both keywords and location', 'danger');
            return;
        }
        
        // Show loading indicator
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
            daysOld: daysOld
        };
        
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
            if (data.success) {
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
                showAlert(`Error: ${data.message}`, 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert(`Error: ${error.message}`, 'danger');
        })
        .finally(() => {
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
            scrapeButton.disabled = false;
        });
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
    }
    
    /**
     * Show no jobs message
     */
    function showNoJobsMessage() {
        jobsContainer.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-info">
                    No jobs found. Try different search criteria.
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