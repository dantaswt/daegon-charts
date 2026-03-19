// --- UTILITY FUNCTIONS ---
function showMessage(type, text, container = appContainer) {
    if (!container) return;
    
    let html = '';
    if (type === 'loading') {
        html = `
            <div class="flex flex-col items-center justify-center p-8 text-secondary">
                <div class="loader mb-4"></div>
                <p class="text-gray-400">${text}</p>
            </div>
        `;
    } else if (type === 'error') {
        html = `
            <div class="flex flex-col items-center justify-center p-8 text-secondary">
                <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                <p class="text-center text-red-500 font-semibold">${text}</p>
                <button id="retryButton" class="mt-4 px-4 py-2 bg-accent text-secondary rounded-md hover:bg-accent-dark transition-colors">
                    Try Again
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    if (type === 'error') {
        document.getElementById('retryButton').addEventListener('click', initializeApp);
    }
}

function parseCsvRow(text) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text?.[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

function getDiffClass(diff) {
    if (!diff) return '';
    const lowerDiff = diff.toString().toLowerCase().trim();
    if (lowerDiff.includes('▲') || lowerDiff.includes('+')) return 'diff-up';
    if (lowerDiff.includes('▼') || lowerDiff.includes('-')) return 'diff-down';
    if (lowerDiff.includes('new') || lowerDiff.includes('re')) return 'diff-new';
    return '';
}

function getDiffSymbol(diff) {
    if (!diff) return '';
    const lowerDiff = diff.toString().toLowerCase().trim();
    if (lowerDiff === '0') return '=';
    if (lowerDiff.includes('▲') || lowerDiff.includes('+')) return '▲';
    if (lowerDiff.includes('▼') || lowerDiff.includes('-')) return '▼';
    if (lowerDiff.includes('re')) return 'RE';
    if (lowerDiff.includes('new')) return 'NEW';
    return diff;
}

function setupBackToTopButton() {
    // Remover botão existente
    const existingButton = document.querySelector('.back-to-top');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Criar novo botão
    const backToTopButton = document.createElement('button');
    backToTopButton.className = 'back-to-top';
    backToTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopButton.title = 'Back to top';
    backToTopButton.style.display = 'none';
    
    document.body.appendChild(backToTopButton);
    
    // Mostrar/ocultar botão baseado no scroll
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopButton.style.display = 'flex';
            setTimeout(() => {
                backToTopButton.classList.add('visible');
            }, 10);
        } else {
            backToTopButton.classList.remove('visible');
            setTimeout(() => {
                if (!backToTopButton.classList.contains('visible')) {
                    backToTopButton.style.display = 'none';
                }
            }, 300);
        }
    });
    
    // Rolagem suave ao topo
    backToTopButton.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}
