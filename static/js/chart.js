// RTX 5090 Monitor - Chart Rendering

/**
 * Renders a price history chart from the provided data
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} data - Array of product snapshots
 * @param {string} range - Data range to display ('7', '30', or 'all')
 */
function renderPriceChart(ctx, data, range) {
    // Clear existing chart if any
    if (window.priceChart) {
        window.priceChart.destroy();
    }
    
    // Filter data based on range
    let filteredData = [...data];
    
    if (range === '7') {
        // Filter to last 7 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        filteredData = data.filter(snapshot => new Date(snapshot.timestamp) >= cutoffDate);
    } else if (range === '30') {
        // Filter to last 30 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        filteredData = data.filter(snapshot => new Date(snapshot.timestamp) >= cutoffDate);
    }
    
    // If no data after filtering, show message
    if (filteredData.length === 0) {
        // Clear canvas and show message
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                datasets: []
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: 'No price data available for selected range',
                        color: '#ffffff',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
        window.priceChart = chart;
        return;
    }
    
    // Prepare data for chart
    const labels = filteredData.map(snapshot => {
        const date = new Date(snapshot.timestamp);
        return date.toLocaleDateString();
    });
    
    const prices = filteredData.map(snapshot => snapshot.price);
    
    // Find availability changes for annotations
    const availabilityChanges = [];
    for (let i = 1; i < filteredData.length; i++) {
        if (filteredData[i].available !== filteredData[i-1].available) {
            availabilityChanges.push({
                index: i,
                available: filteredData[i].available,
                x: new Date(filteredData[i].timestamp).toLocaleDateString()
            });
        }
    }
    
    // Create annotations for availability changes
    const annotations = {};
    availabilityChanges.forEach((change, index) => {
        annotations[`availability-${index}`] = {
            type: 'line',
            scaleID: 'x',
            value: change.x,
            borderColor: change.available ? '#28a745' : '#dc3545',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
                display: true,
                content: change.available ? 'Now Available' : 'Out of Stock',
                position: 'start',
                backgroundColor: change.available ? '#28a745' : '#dc3545',
                color: '#ffffff',
                font: {
                    size: 10
                }
            }
        };
    });
    
    // Create the chart
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price ($)',
                data: prices,
                borderColor: '#17a2b8',
                backgroundColor: 'rgba(23, 162, 184, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#17a2b8',
                pointBorderColor: '#ffffff',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Price History',
                    color: '#ffffff',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: true,
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const snapshot = filteredData[context.dataIndex];
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD'
                                }).format(context.parsed.y);
                            }
                            
                            if (snapshot) {
                                label += ` (${snapshot.available ? 'Available' : 'Unavailable'})`;
                            }
                            
                            return label;
                        },
                        afterBody: function(context) {
                            const snapshot = filteredData[context[0].dataIndex];
                            if (snapshot && snapshot.changes && Object.keys(snapshot.changes).length > 0) {
                                return ['', 'Changes detected in this snapshot'];
                            }
                            return null;
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff'
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#ffffff',
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            elements: {
                line: {
                    tension: 0.3
                }
            }
        }
    });
    
    // Store chart reference for later
    window.priceChart = chart;
}

// Function to fetch product data and render charts
function fetchProductData(range) {
    fetch('/api/history')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch product history');
            }
            return response.json();
        })
        .then(data => {
            // Sort by timestamp (oldest first for charts)
            data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Filter for price data
            const priceData = data.filter(snapshot => snapshot.price !== null);
            
            if (priceData.length > 0) {
                // Get the chart canvas context
                const ctx = document.getElementById('price-chart').getContext('2d');
                
                // Render the chart
                renderPriceChart(ctx, priceData, range);
                
                // Update UI with current data
                updateUIWithNewData(data[data.length - 1]);
            } else {
                // Handle no price data
                document.getElementById('loading-container').classList.add('d-none');
                document.getElementById('product-container').classList.remove('d-none');
                document.getElementById('error-container').classList.remove('d-none');
                document.getElementById('error-message').textContent = 'No price data available yet';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('loading-container').classList.add('d-none');
            document.getElementById('error-container').classList.remove('d-none');
            document.getElementById('error-message').textContent = error.message;
        });
}
