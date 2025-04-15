// RTX 5090 Monitor - Main JavaScript

// Global variables for tracking state
let currentProductData = null;
let refreshInProgress = false;

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // Set up refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            forceRefresh();
        });
    }

    // Update last updated timestamp
    updateLastUpdatedTime();
    
    // Set up periodic timestamp updates
    setInterval(updateLastUpdatedTime, 60000); // Update every minute
});

// Force refresh product data
function forceRefresh() {
    if (refreshInProgress) return;
    
    refreshInProgress = true;
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        const icon = refreshBtn.querySelector('i');
        if (icon) icon.classList.add('rotating');
        refreshBtn.disabled = true;
    }
    
    // Call the API endpoint to force a refresh
    fetch('/api/force-refresh', {
        method: 'POST',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to refresh data');
        }
        return response.json();
    })
    .then(data => {
        // Update the UI with the new data
        if (data.data) {
            updateUIWithNewData(data.data);
        }
        
        // Show success message
        showToast('Data refreshed successfully', 'success');
    })
    .catch(error => {
        console.error('Error during refresh:', error);
        showToast(`Failed to refresh: ${error.message}`, 'danger');
    })
    .finally(() => {
        refreshInProgress = false;
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            if (icon) icon.classList.remove('rotating');
            refreshBtn.disabled = false;
        }
    });
}

// Update the UI with new product data
function updateUIWithNewData(data) {
    // Check if we're on the home page
    const productContainer = document.getElementById('product-container');
    if (productContainer) {
        // Hide loading spinner and show product container
        document.getElementById('loading-container').classList.add('d-none');
        productContainer.classList.remove('d-none');
        
        // Store current data
        const previousData = currentProductData;
        currentProductData = data;
        
        // Update product title
        const titleElement = document.getElementById('product-title');
        if (titleElement) titleElement.textContent = data.title;
        
        // Update product price
        const priceContainer = document.getElementById('price-container');
        if (priceContainer) {
            if (data.price) {
                priceContainer.textContent = `$${data.price.toFixed(2)}`;
                
                // Highlight price change if different from previous
                if (previousData && previousData.price !== data.price) {
                    priceContainer.classList.add('highlight-change');
                    setTimeout(() => {
                        priceContainer.classList.remove('highlight-change');
                    }, 2000);
                    
                    // Add up/down indicator
                    if (previousData.price < data.price) {
                        priceContainer.innerHTML += ' <i class="fas fa-arrow-up price-change-up"></i>';
                    } else if (previousData.price > data.price) {
                        priceContainer.innerHTML += ' <i class="fas fa-arrow-down price-change-down"></i>';
                    }
                }
            } else {
                priceContainer.textContent = 'Price unavailable';
            }
        }
        
        // Update availability badge
        const availabilityBadge = document.getElementById('availability-badge');
        if (availabilityBadge) {
            availabilityBadge.className = `badge ${data.available ? 'bg-success' : 'bg-danger'} me-2`;
            availabilityBadge.textContent = data.available ? 'In Stock' : 'Out of Stock';
            
            // Highlight availability change
            if (previousData && previousData.available !== data.available) {
                availabilityBadge.classList.add('highlight-change');
                setTimeout(() => {
                    availabilityBadge.classList.remove('highlight-change');
                }, 2000);
            }
        }
        
        // Update availability text
        const availabilityText = document.getElementById('availability-text');
        if (availabilityText) {
            availabilityText.textContent = data.availability_text || 'No availability information';
        }
        
        // Update product link
        const productLink = document.getElementById('product-link');
        if (productLink) {
            productLink.href = data.url;
        }
        
        // Update product details
        const detailsContainer = document.getElementById('product-details-container');
        if (detailsContainer && data.details) {
            detailsContainer.innerHTML = '';
            
            if (Object.keys(data.details).length === 0) {
                detailsContainer.innerHTML = '<p class="text-center text-muted">No product details available</p>';
            } else {
                for (const [key, value] of Object.entries(data.details)) {
                    const col = document.createElement('div');
                    col.className = 'col-md-6 col-lg-4 mb-3';
                    
                    const card = document.createElement('div');
                    card.className = 'product-detail-item';
                    
                    card.innerHTML = `
                        <h6>${key}</h6>
                        <p class="mb-0">${value}</p>
                    `;
                    
                    col.appendChild(card);
                    detailsContainer.appendChild(col);
                }
            }
        }
        
        // Update recent changes
        const recentChangesContainer = document.getElementById('recent-changes-container');
        if (recentChangesContainer) {
            // Fetch history to show recent changes
            fetch('/api/history')
                .then(response => response.json())
                .then(historyData => {
                    // Sort by timestamp (newest first)
                    historyData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    
                    // Find recent changes (up to last 5 entries with changes)
                    const recentChanges = historyData
                        .filter(snapshot => snapshot.changes && 
                                Object.keys(snapshot.changes).length > 0 && 
                                !snapshot.changes.initial)
                        .slice(0, 5);
                    
                    if (recentChanges.length === 0) {
                        recentChangesContainer.innerHTML = '<p class="text-center text-muted">No changes detected yet</p>';
                    } else {
                        recentChangesContainer.innerHTML = '';
                        
                        const list = document.createElement('ul');
                        list.className = 'list-group';
                        
                        recentChanges.forEach(change => {
                            const item = document.createElement('li');
                            item.className = 'list-group-item';
                            
                            const date = new Date(change.timestamp);
                            const formattedDate = date.toLocaleString();
                            
                            let changesList = '';
                            
                            for (const [key, value] of Object.entries(change.changes)) {
                                if (key === 'details') {
                                    // Skip details changes in this view to keep it concise
                                    continue;
                                }
                                
                                let badgeClass = 'bg-secondary';
                                if (key === 'price') badgeClass = 'bg-warning';
                                if (key === 'available') badgeClass = 'bg-success';
                                
                                changesList += `
                                    <div class="mt-1">
                                        <span class="badge ${badgeClass}">${key}</span>
                                        <span class="text-danger">${value.old}</span>
                                        <i class="fas fa-arrow-right mx-1"></i>
                                        <span class="text-success">${value.new}</span>
                                    </div>
                                `;
                            }
                            
                            item.innerHTML = `
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <h6 class="mb-1">${formattedDate}</h6>
                                        ${changesList}
                                    </div>
                                    <span class="badge bg-primary">${change.price ? '$' + change.price.toFixed(2) : 'N/A'}</span>
                                </div>
                            `;
                            
                            list.appendChild(item);
                        });
                        
                        recentChangesContainer.appendChild(list);
                    }
                })
                .catch(error => {
                    console.error('Error fetching history:', error);
                    recentChangesContainer.innerHTML = '<p class="text-center text-danger">Error loading recent changes</p>';
                });
        }
    }
    
    // Update last updated time
    updateLastUpdatedTime();
}

// Update the last updated timestamp
function updateLastUpdatedTime() {
    const lastUpdatedElement = document.getElementById('last-updated');
    if (lastUpdatedElement) {
        // If we have current data, use its timestamp
        if (currentProductData && currentProductData.timestamp) {
            const date = new Date(currentProductData.timestamp);
            const timeAgo = getTimeAgo(date);
            lastUpdatedElement.textContent = `${timeAgo} (${date.toLocaleString()})`;
        } else {
            // Otherwise, get the latest data
            fetch('/api/current')
                .then(response => {
                    if (!response.ok) throw new Error('Failed to fetch current data');
                    return response.json();
                })
                .then(data => {
                    currentProductData = data;
                    const date = new Date(data.timestamp);
                    const timeAgo = getTimeAgo(date);
                    lastUpdatedElement.textContent = `${timeAgo} (${date.toLocaleString()})`;
                })
                .catch(error => {
                    console.error('Error fetching current data:', error);
                    lastUpdatedElement.textContent = 'Unknown';
                });
        }
    }
}

// Get human-readable time ago string
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.round(diffMs / 1000);
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);
    
    if (diffSecs < 60) {
        return `${diffSecs} seconds ago`;
    } else if (diffMins < 60) {
        return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
}

// Show a toast notification
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Initialize and show toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
    });
    bsToast.show();
    
    // Remove toast from DOM after it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}
