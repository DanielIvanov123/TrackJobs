/**
 * modal.js - Job details modal functionality
 */

/**
 * Open the job details modal
 */
function openJobDetailsModal(jobId) {
    console.log('Opening modal for job ID:', jobId);
    
    // Get modal element
    const modalElement = document.getElementById('jobDetailsModal');
    if (!modalElement) {
        console.error('Modal element not found');
        return;
    }
    
    try {
        // Show the modal using vanilla JS
        const modalInstance = new bootstrap.Modal(modalElement);
        modalInstance.show();
        
        // After modal is shown, load the job details
        modalElement.addEventListener('shown.bs.modal', function onModalShown() {
            // Remove the event listener to prevent multiple calls
            modalElement.removeEventListener('shown.bs.modal', onModalShown);
            
            // Now load the job data
            loadJobDetails(jobId);
        }, { once: true }); // Use once:true to ensure it only runs once
    } catch (error) {
        console.error('Error showing modal:', error);
        // Try direct approach if bootstrap Modal fails
        modalElement.classList.add('show');
        modalElement.style.display = 'block';
        
        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        document.body.appendChild(backdrop);
        
        // Load job details directly
        loadJobDetails(jobId);
    }
}

/**
 * Load job details data into an already-open modal
 */
function loadJobDetails(jobId) {
    console.log('Loading job details for ID:', jobId);
    
    // Get elements
    const spinner = document.getElementById('jobDetailsSpinner');
    const content = document.getElementById('jobDetailsContent');
    const errorMsg = document.getElementById('jobDetailsError');
    
    // Reset state - safely
    if (spinner) spinner.style.display = 'block';
    if (content) content.style.display = 'none';
    if (errorMsg) errorMsg.style.display = 'none';
    
    // Get CSRF token
    const csrfToken = getCsrfToken();
    const csrfHeader = getCsrfHeader();
    
    if (!csrfToken || !csrfHeader) {
        console.error('CSRF tokens not found');
        if (errorMsg) {
            errorMsg.textContent = 'Error: Security tokens not found';
            errorMsg.style.display = 'block';
        }
        if (spinner) spinner.style.display = 'none';
        return;
    }
    
    // Fetch job details
    fetch(`/api/jobs/${jobId}`, {
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
    .then(job => {
        // Update elements if they exist
        setTextContentSafely('jobDetailTitle', job.title || 'Untitled Job');
        setTextContentSafely('jobDetailCompany', job.company || 'Unknown Company');
        setTextContentSafely('jobDetailLocation', job.location || 'Not specified');
        setTextContentSafely('jobDetailJobType', job.jobType || 'Not specified');
        setTextContentSafely('jobDetailExperienceLevel', job.experienceLevel || 'Not specified');
        setTextContentSafely('jobDetailPosted', formatDate(job.datePosted));
        setTextContentSafely('jobDetailScraped', formatDate(job.dateScraped));
        
        // Set status selection in button group
        const status = job.applicationStatus || 'SAVED';
        document.querySelectorAll('.job-status-selector input[name="jobStatus"]').forEach(radio => {
            if (radio) {
                radio.checked = radio.value === status;
            }
        });
        
        // Add event listeners to status radio buttons
        document.querySelectorAll('.job-status-selector input[name="jobStatus"]').forEach(radio => {
            if (radio) {
                radio.addEventListener('change', function() {
                    if (this.checked) {
                        updateJobStatus(jobId, this.value)
                            .then(() => {
                                // Show success message
                                showAlert(`Job status updated to ${getStatusDisplayName(this.value)}`, 'success');
                                
                                // Refresh job list after status change
                                if (typeof searchJobs === 'function') {
                                    searchJobs();
                                }
                            })
                            .catch(error => {
                                console.error('Error updating status:', error);
                                showAlert(`Error updating status: ${error.message}`, 'danger');
                            });
                    }
                });
            }
        });
        
        // Format description
        const descElement = document.getElementById('jobDetailDescription');
        if (descElement) {
            if (job.description && job.description.trim()) {
                descElement.innerHTML = formatJobDescription(job.description);
            } else {
                descElement.innerHTML = '<p class="text-muted">No detailed description available for this job.</p>';
            }
        }
        
        // Set LinkedIn link
        const linkedInLink = document.getElementById('jobDetailLinkedInLink');
        if (linkedInLink) {
            if (job.url) {
                linkedInLink.href = job.url;
                linkedInLink.style.display = 'inline-block';
            } else {
                linkedInLink.style.display = 'none';
            }
        }
        
        // Show content, hide spinner
        if (spinner) spinner.style.display = 'none';
        if (content) content.style.display = 'block';
    })
    .catch(error => {
        console.error('Error fetching job details:', error);
        if (spinner) spinner.style.display = 'none';
        if (errorMsg) {
            errorMsg.textContent = `Error loading job details: ${error.message}`;
            errorMsg.style.display = 'block';
        }
    });
}

/**
 * Format job description into well-structured paragraphs
 */
function formatJobDescription(description) {
    if (!description) return '';
    
    // Normalize line breaks
    let desc = description.replace(/\r\n/g, '\n');
    
    // Split by double line breaks to find natural paragraphs
    const paragraphs = desc.split(/\n\s*\n/);
    
    // Create HTML with proper paragraphs
    return paragraphs
        .filter(p => p.trim().length > 0)
        .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
        .join('');
}