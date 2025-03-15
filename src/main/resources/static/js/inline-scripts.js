document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded');
    console.log('Bootstrap available:', typeof bootstrap !== 'undefined');
    console.log('Bootstrap Modal available:', typeof bootstrap !== 'undefined' && typeof bootstrap.Modal !== 'undefined');
    console.log('jQuery available:', typeof jQuery !== 'undefined');
    
    // Initialize delete confirmation
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
});