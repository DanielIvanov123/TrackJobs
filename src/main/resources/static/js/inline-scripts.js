/**
 * inline-scripts.js - Direct DOM interactions and event handlers
 * Handles miscellaneous functionality that doesn't fit in other modules
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Inline scripts loaded');
    
    console.log('DOM fully loaded');
    console.log('Bootstrap available:', typeof bootstrap !== 'undefined');
    console.log('Bootstrap Modal available:', typeof bootstrap !== 'undefined' && typeof bootstrap.Modal !== 'undefined');
    
    // Initialize delete confirmation
    const deleteConfirmInput = document.getElementById('deleteConfirmInput');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    if (deleteConfirmInput && confirmDeleteBtn) {
        console.log('Delete confirmation elements found');
        
        // Log initial state
        console.log('Initial button state:', confirmDeleteBtn.disabled);
        
        // Remove any existing event listeners
        const newInput = deleteConfirmInput.cloneNode(true);
        deleteConfirmInput.parentNode.replaceChild(newInput, deleteConfirmInput);
        
        // Add fresh event listener
        newInput.addEventListener('input', function(e) {
            const isMatch = this.value === 'DELETE';
            console.log('Input value:', this.value, 'Is match:', isMatch);
            confirmDeleteBtn.disabled = !isMatch;
        });
        
        // Reset input when modal is closed
        const wipeDataModal = document.getElementById('wipeDataModal');
        if (wipeDataModal) {
            wipeDataModal.addEventListener('hidden.bs.modal', function() {
                newInput.value = '';
                confirmDeleteBtn.disabled = true;
            });
        }
    } else {
        console.warn('Delete confirmation elements not found:', {
            deleteConfirmInput: !!deleteConfirmInput,
            confirmDeleteBtn: !!confirmDeleteBtn
        });
    }
    
    // Set up close functionality for modals
    setupModalCloseButtons();
    
    // Make sure tab switching works
    setupTabSwitching();
    
    // Ensure view details buttons work
    setupViewDetailsButtons();
});

/**
 * Set up modal close buttons
 */
function setupModalCloseButtons() {
    // Find all modal close buttons
    const closeButtons = document.querySelectorAll('[data-bs-dismiss="modal"]');
    
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Find parent modal
            const modal = this.closest('.modal');
            if (!modal) return;
            
            // Try Bootstrap method first
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                try {
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) {
                        bsModal.hide();
                    }
                } catch (error) {
                    console.warn('Error closing modal with Bootstrap:', error);
                }
            }
            
            // Fallback to manual method
            modal.classList.remove('show');
            modal.style.display = 'none';
            
            // Remove backdrop
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            
            // Remove modal-open class from body
            document.body.classList.remove('modal-open');
        });
    });
}

/**
 * Set up tab switching functionality
 */
function setupTabSwitching() {
    const searchTabLink = document.getElementById('searchTabLink');
    const scraperTabLink = document.getElementById('scraperTabLink');
    
    if (searchTabLink && scraperTabLink) {
        // Remove any existing event listeners
        const newSearchTabLink = searchTabLink.cloneNode(true);
        const newScraperTabLink = scraperTabLink.cloneNode(true);
        
        searchTabLink.parentNode.replaceChild(newSearchTabLink, searchTabLink);
        scraperTabLink.parentNode.replaceChild(newScraperTabLink, scraperTabLink);
        
        // Add fresh event listeners
        newSearchTabLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Search tab clicked');
            
            if (typeof showSearchTab === 'function') {
                showSearchTab();
            } else {
                console.error('showSearchTab function not found');
                // Fallback implementation
                newSearchTabLink.classList.add('active');
                newScraperTabLink.classList.remove('active');
                
                const searchTabContent = document.getElementById('searchTabContent');
                const scraperTabContent = document.getElementById('scraperTabContent');
                
                if (searchTabContent && scraperTabContent) {
                    searchTabContent.style.display = 'block';
                    scraperTabContent.style.display = 'none';
                }
            }
        });
        
        newScraperTabLink.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Scraper tab clicked');
            
            if (typeof showScraperTab === 'function') {
                showScraperTab();
            } else {
                console.error('showScraperTab function not found');
                // Fallback implementation
                newScraperTabLink.classList.add('active');
                newSearchTabLink.classList.remove('active');
                
                const searchTabContent = document.getElementById('searchTabContent');
                const scraperTabContent = document.getElementById('scraperTabContent');
                
                if (searchTabContent && scraperTabContent) {
                    searchTabContent.style.display = 'none';
                    scraperTabContent.style.display = 'block';
                }
            }
        });
    }
}

/**
 * Set up view details buttons
 */
function setupViewDetailsButtons() {
    // Add click handlers to all job cards and view details buttons
    if (typeof addJobCardClickHandlers === 'function') {
        addJobCardClickHandlers();
    } else {
        console.error('addJobCardClickHandlers function not found');
        
        // Fallback implementation
        document.querySelectorAll('.view-job-details-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const jobId = this.getAttribute('data-job-id');
                console.log('View details button clicked for job ID:', jobId);
                
                // Try to use the modal function if available
                if (typeof openJobDetailsModal === 'function') {
                    openJobDetailsModal(jobId);
                } else {
                    console.error('openJobDetailsModal function not found');
                    // Basic fallback - show modal manually
                    const modalElement = document.getElementById('jobDetailsModal');
                    if (modalElement) {
                        modalElement.classList.add('show');
                        modalElement.style.display = 'block';
                        document.body.classList.add('modal-open');
                        
                        // Add backdrop
                        const backdrop = document.createElement('div');
                        backdrop.className = 'modal-backdrop fade show';
                        document.body.appendChild(backdrop);
                    }
                }
            });
        });
        
        // Also attach to job cards
        document.querySelectorAll('.job-card').forEach(card => {
            card.addEventListener('click', function() {
                const jobId = this.getAttribute('data-job-id');
                console.log('Job card clicked for job ID:', jobId);
                
                // Try to use the modal function if available
                if (typeof openJobDetailsModal === 'function') {
                    openJobDetailsModal(jobId);
                } else {
                    console.error('openJobDetailsModal function not found');
                    // Fallback - use button if available
                    const viewBtn = this.querySelector('.view-job-details-btn');
                    if (viewBtn) {
                        viewBtn.click();
                    }
                }
            });
        });
    }
}

/**
 * Initialize Bootstrap components when needed
 */
function initBootstrapComponents() {
    // Initialize tooltips
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    }
    
    // Initialize popovers
    if (typeof bootstrap !== 'undefined' && bootstrap.Popover) {
        const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
        [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
    }
}

// Trigger bootstrap component initialization
setTimeout(initBootstrapComponents, 500);