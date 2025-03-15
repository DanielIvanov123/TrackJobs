/**
 * modal.js - Job details modal functionality
 * Optimized for modal performance and responsive UI
 */

(function() {
    // Cache modal elements and state
    let modalElement, spinner, content, errorMsg;
    let currentJobId = null;
    let modalInstance = null;
    let isModalOpen = false;
    
    // Job data cache for faster reopening
    const jobCache = {};
    
    // Initialize on document ready
    document.addEventListener('DOMContentLoaded', function() {
        // Cache modal elements
        modalElement = document.getElementById('jobDetailsModal');
        spinner = document.getElementById('jobDetailsSpinner');
        content = document.getElementById('jobDetailsContent');
        errorMsg = document.getElementById('jobDetailsError');
        
        // Add event listener for modal hidden
        if (modalElement) {
            modalElement.addEventListener('hidden.bs.modal', function() {
                isModalOpen = false;
            });
            
            modalElement.addEventListener('shown.bs.modal', function() {
                isModalOpen = true;
            });
        }
    });
    
    /**
     * Open the job details modal with optimized loading
     * @param {String|Number} jobId - ID of the job to display
     */
    function openJobDetailsModal(jobId) {
        console.log('Opening modal for job ID:', jobId);
        
        // Prevent opening the same job again
        if (isModalOpen && currentJobId === jobId) {
            console.log('Modal already open for this job');
            return;
        }
        
        currentJobId = jobId;
        
        // Get modal element if not already cached
        if (!modalElement) {
            modalElement = document.getElementById('jobDetailsModal');
            spinner = document.getElementById('jobDetailsSpinner');
            content = document.getElementById('jobDetailsContent');
            errorMsg = document.getElementById('jobDetailsError');
        }
        
        if (!modalElement) {
            console.error('Modal element not found');
            showAlert('Error: Could not open job details', 'danger');
            return;
        }
        
        try {
            // Show the modal using Bootstrap
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                try {
                    // Try to get existing instance
                    modalInstance = bootstrap.Modal.getInstance(modalElement);
                    
                    if (!modalInstance) {
                        // Create new instance if none exists
                        modalInstance = new bootstrap.Modal(modalElement, {
                            backdrop: true,
                            keyboard: true,
                            focus: true
                        });
                    }
                    
                    // Handle modal lifecycle
                    modalElement.addEventListener('shown.bs.modal', function onModalShown() {
                        modalElement.removeEventListener('shown.bs.modal', onModalShown);
                        loadJobDetails(jobId);
                    }, { once: true });
                    
                    modalInstance.show();
                } catch (error) {
                    console.error('Error with Bootstrap modal:', error);
                    // Fall back to manual approach
                    manuallyOpenModal();
                }
            } else {
                console.warn('Bootstrap not available, using manual modal opening');
                manuallyOpenModal();
            }
        } catch (error) {
            console.error('Error showing modal:', error);
            // Fall back to direct approach
            manuallyOpenModal();
        }
        
        /**
         * Manual fallback for opening the modal
         */
        function manuallyOpenModal() {
            modalElement.classList.add('show');
            modalElement.style.display = 'block';
            document.body.classList.add('modal-open');
            
            // Add backdrop
            let backdrop = document.querySelector('.modal-backdrop');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
            }
            
            // Load job details directly
            setTimeout(() => {
                loadJobDetails(jobId);
            }, 50);
        }
    }
    
    /**
     * Load job details data into an already-open modal
     * @param {String|Number} jobId - ID of the job to load
     */
    function loadJobDetails(jobId) {
        console.log('Loading job details for ID:', jobId);
        
        // Reset modal state
        if (spinner) spinner.style.display = 'block';
        if (content) content.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
        
        // Check cache first
        if (jobCache[jobId]) {
            console.log('Using cached job data');
            displayJobDetails(jobCache[jobId]);
            return;
        }
        
        // Get CSRF token
        const csrfToken = getCsrfToken();
        const csrfHeader = getCsrfHeader();
        
        if (!csrfToken || !csrfHeader) {
            console.error('CSRF tokens not found');
            showModalError('Security tokens not found');
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
            // Cache the job data
            jobCache[jobId] = job;
            
            // Display the job details
            displayJobDetails(job);
        })
        .catch(error => {
            console.error('Error fetching job details:', error);
            showModalError(`Error loading job details: ${error.message}`);
        });
    }
    
    /**
     * Display job details in the modal
     * @param {Object} job - Job data object
     */
    function displayJobDetails(job) {
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
        const statusRadios = document.querySelectorAll('.job-status-selector input[name="jobStatus"]');
        
        if (statusRadios.length > 0) {
            // Clear previous event listeners using cloneNode
            statusRadios.forEach(radio => {
                const newRadio = radio.cloneNode(true);
                radio.parentNode.replaceChild(newRadio, radio);
                
                // Set checked state
                newRadio.checked = newRadio.value === status;
                
                // Add new event listener
                newRadio.addEventListener('change', function() {
                    if (this.checked) {
                        updateJobStatus(job.id, this.value)
                            .then(() => {
                                // Update the job in cache
                                if (jobCache[job.id]) {
                                    jobCache[job.id].applicationStatus = this.value;
                                }
                                
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
            });
        }
        
        // Format description with optimized approach
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
    }
    
    /**
     * Show error message in modal
     * @param {String} message - Error message to display
     */
    function showModalError(message) {
        if (spinner) spinner.style.display = 'none';
        if (content) content.style.display = 'none';
        
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        } else {
            console.error('Modal error element not found');
            // Fallback - create error element
            const modalBody = document.querySelector('#jobDetailsModal .modal-body');
            if (modalBody) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'alert alert-danger';
                errorDiv.textContent = message;
                modalBody.appendChild(errorDiv);
            }
        }
    }
    
    /**
     * Format job description into well-structured paragraphs with optimized rendering
     * @param {String} description - Raw job description text
     * @return {String} Formatted HTML for the description
     */
    function formatJobDescription(description) {
        if (!description) return '';
        
        // Use a more performant approach to text processing
        const normalizedDesc = description.replace(/\r\n/g, '\n');
        
        // Use a documentFragment for building paragraphs
        const fragment = document.createElement('div');
        
        // Split by double line breaks to find natural paragraphs
        const paragraphs = normalizedDesc.split(/\n\s*\n/);
        
        // Process paragraphs in batches using a single operation
        const html = paragraphs
            .filter(p => p.trim().length > 0)
            .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
            .join('');
        
        return html;
    }
    
    // Expose function to global scope
    window.openJobDetailsModal = openJobDetailsModal;
})();