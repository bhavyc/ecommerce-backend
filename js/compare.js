// public/js/compare.js

document.addEventListener('DOMContentLoaded', () => {
    // State management for compare list
    let compareList = JSON.parse(localStorage.getItem('compareList')) || [];

    const compareWidget = document.getElementById('compare-widget');
    const compareCountSpan = document.getElementById('compare-count');
    const compareLink = document.getElementById('compare-link');

    // Update the floating widget's appearance
    const updateCompareWidget = () => {
        const count = compareList.length;
        compareCountSpan.textContent = count;
        
        if (count > 0) {
            compareWidget.style.display = 'block';
        } else {
            compareWidget.style.display = 'none';
        }

        if (count >= 2) {
            compareLink.style.display = 'inline-block';
        } else {
            compareLink.style.display = 'none';
        }
    };

    // Sync checkboxes on page load
    const syncCheckboxes = () => {
        document.querySelectorAll('.add-to-compare').forEach(checkbox => {
            const productId = checkbox.dataset.productId;
            if (compareList.includes(productId)) {
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
            }
        });
    };
    
    // Attach event listeners to all "Add to Compare" checkboxes
    document.querySelectorAll('.add-to-compare').forEach(checkbox => {
        checkbox.addEventListener('change', async (event) => {
            const productId = event.target.dataset.productId;
            const isChecked = event.target.checked;
            
            const url = isChecked ? `/compare/add/${productId}` : `/compare/remove/${productId}`;
            
            try {
                const response = await fetch(url, { method: 'POST' });
                const data = await response.json();

                if (data.success) {
                    // Update local state
                    if (isChecked) {
                        if (!compareList.includes(productId)) compareList.push(productId);
                    } else {
                        compareList = compareList.filter(id => id !== productId);
                    }
                    localStorage.setItem('compareList', JSON.stringify(compareList));
                } else {
                    // If server rejected (e.g., list is full), revert checkbox
                    alert(data.message);
                    event.target.checked = !isChecked;
                }
                
                // Update UI
                updateCompareWidget();

            } catch (error) {
                console.error('Failed to update comparison list:', error);
                event.target.checked = !isChecked; // Revert on error
            }
        });
    });

    // Initial UI setup on page load
    syncCheckboxes();
    updateCompareWidget();
});