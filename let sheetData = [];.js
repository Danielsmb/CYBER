let sheetData = [];
let filteredData = [];
let currentDetail = null;
let debugMode = false;

// Calculator state
let calculatorState = {
    displayValue: '0',
    expression: '',
    previousValue: null,
    operation: null,
    waitingForOperand: false
};

// Create particle effect
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 80;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        // Random size
        const size = Math.random() * 8 + 1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        
        // Random animation delay
        particle.style.animationDelay = `${Math.random() * 20}s`;
        
        // Random animation duration
        particle.style.animationDuration = `${Math.random() * 20 + 10}s`;
        
        particlesContainer.appendChild(particle);
    }
}

// Update system time
function updateSystemTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour12: false });
    document.getElementById('systemTime').textContent = timeString;
}

// Update system status
function updateSystemStatus(status, type = 'normal') {
    const statusElement = document.getElementById('systemStatus');
    statusElement.textContent = status;
    
    // Add color based on type
    statusElement.style.color = type === 'error' ? '#ff4444' : 
                               type === 'success' ? 'var(--accent-color)' : 
                               type === 'warning' ? '#ffaa00' : 
                               'var(--primary-color)';
}

// Show terminal output
function showTerminalOutput() {
    const terminal = document.getElementById('terminalOutput');
    terminal.style.display = 'block';
}

// Add line to terminal
function addTerminalLine(text, type = 'normal') {
    const terminal = document.getElementById('terminalOutput');
    const line = document.createElement('div');
    line.classList.add('terminal-line');
    
    let className = 'terminal-prompt';
    if (type === 'error') className = 'terminal-error';
    else if (type === 'success') className = 'terminal-success';
    else if (type === 'warning') className = 'terminal-warning';
    
    line.innerHTML = `<span class="${className}">SYSTEM></span> ${text}`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

// Update debug info
function updateDebugInfo() {
    if (!debugMode) return;
    
    const debugInfo = document.getElementById('debugInfo');
    debugInfo.innerHTML = `
        <div>Total Data: ${sheetData.length}</div>
        <div>Filtered Data: ${filteredData.length}</div>
        <div>Current Detail: ${currentDetail ? currentDetail.title : 'None'}</div>
        <div>Cache: ${localStorage.getItem('cybersearch_data') ? 'Available' : 'Empty'}</div>
    `;
}

// Levenshtein distance algorithm for fuzzy matching
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Calculate similarity percentage
function calculateSimilarity(str1, str2) {
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 100;
    
    return Math.round(((longer.length - distance) / longer.length) * 100);
}

// Enhanced fuzzy matching function
function fuzzyMatch(query, text) {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Direct match (highest priority)
    if (textLower.includes(queryLower)) {
        return { match: true, score: 100, type: 'exact' };
    }
    
    // Split text into words
    const words = textLower.split(/\s+/);
    
    // Check each word for fuzzy match
    let bestMatch = { match: false, score: 0, type: 'none' };
    
    for (const word of words) {
        // Check if word starts with query
        if (word.startsWith(queryLower)) {
            const score = Math.round((queryLower.length / word.length) * 100);
            if (score > bestMatch.score) {
                bestMatch = { match: true, score, type: 'prefix' };
            }
        }
        
        // Check fuzzy similarity
        const similarity = calculateSimilarity(queryLower, word);
        if (similarity >= 60 && similarity > bestMatch.score) { // 60% similarity threshold
            bestMatch = { match: true, score: similarity, type: 'fuzzy' };
        }
        
        // Check if query is contained in word
        if (word.includes(queryLower)) {
            const score = Math.round((queryLower.length / word.length) * 90);
            if (score > bestMatch.score) {
                bestMatch = { match: true, score, type: 'contains' };
            }
        }
    }
    
    return bestMatch;
}

// NEW FUNCTION: Fetch data from GitHub repository
async function fetchGitHubData() {
    // GANTI 'ashen' dengan username GitHub Anda jika berbeda
    // GANTI 'Percobaan' dengan nama repository Anda jika berbeda
    const repoOwner = 'ashen'; 
    const repoName = 'Percobaan'; 
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/`;

    updateSystemStatus('MENGAMBIL DATA DARI GITHUB...', 'warning');
    addTerminalLine(`Connecting to GitHub repository: ${repoOwner}/${repoName}`, 'warning');
    
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const files = await response.json();
        
        sheetData = [];
        for (const file of files) {
            // Hanya tambahkan file, bukan folder
            if (file.type === 'file') {
                // Abaikan file HTML utama agar tidak muncul di menu
                if (file.name !== 'Untitled-1.html') {
                    sheetData.push({ 
                        title: file.name, 
                        info: `File tipe: ${file.name.split('.').pop()}` 
                    });
                }
            }
        }

        if (sheetData.length > 0) {
            addTerminalLine(`SUCCESS: Loaded ${sheetData.length} files from GitHub`, 'success');
            updateSystemStatus('SISTEM ONLINE (GITHUB)', 'success');
            filteredData = [...sheetData];
            displayMenuItems();
            updateDebugInfo();
            return;
        }
    } catch (error) {
        addTerminalLine(`ERROR: Failed to fetch from GitHub - ${error.message}`, 'error');
        console.error('GitHub fetch error:', error);
    }
    
    // Fallback ke data sampel jika GitHub gagal
    addTerminalLine('Falling back to sample data...', 'warning');
    sheetData = [
        { title: "GAGAL MEMUAT DATA", info: "Tidak dapat mengambil data dari GitHub. Periksa nama repository dan koneksi internet." }
    ];
    
    updateSystemStatus('SISTEM OFFLINE', 'error');
    filteredData = [...sheetData];
    displayMenuItems();
    updateDebugInfo();
}

// Display menu items
function displayMenuItems() {
    const container = document.getElementById('menuContainer');
    const loadingContainer = document.getElementById('loadingContainer');
    const noMenu = document.getElementById('noMenu');
    
    loadingContainer.style.display = 'none';
    
    if (filteredData.length === 0) {
        container.style.display = 'none';
        noMenu.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    noMenu.style.display = 'none';
    
    container.innerHTML = filteredData.map((item, index) => `
        <div class="menu-item hologram cyber-border" data-index="${index}">
            <div class="match-indicator">${item.matchType || 'FILE'}</div>
            <h3 class="menu-title cyber-text" data-text="${item.title}">${item.title}</h3>
            <div class="menu-preview">${item.info}</div>
        </div>
    `).join('');
    
    // Add click event listeners to menu items
    container.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            showDetail(filteredData[index]);
        });
    });
}

// Show detail modal
function showDetail(item) {
    currentDetail = item;
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('detailTitle');
    const text = document.getElementById('detailText');
    
    title.textContent = item.title;
    text.textContent = item.info;
    
    modal.classList.add('show');
    updateDebugInfo();
    
    addTerminalLine(`Opening file: ${item.title}`, 'normal');
}

// Hide detail modal
function hideDetail() {
    const modal = document.getElementById('detailModal');
    modal.classList.remove('show');
    currentDetail = null;
    updateDebugInfo();
}

// Copy to clipboard
function copyToClipboard() {
    if (!currentDetail) return;
    
    navigator.clipboard.writeText(currentDetail.info).then(() => {
        // Show success message
        const successElement = document.getElementById('copySuccess');
        successElement.classList.add('show');
        
        // Add to terminal
        addTerminalLine(`Data copied to clipboard: ${currentDetail.info}`, 'success');
        
        // Hide success message after 2 seconds
        setTimeout(() => {
            successElement.classList.remove('show');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        addTerminalLine(`ERROR: Failed to copy text - ${err.message}`, 'error');
    });
}

// Enhanced filter menu items with fuzzy matching
function filterMenuItems() {
    const query = document.getElementById('filterInput').value.trim();
    
    if (query === '') {
        filteredData = sheetData.map(item => ({ ...item }));
    } else {
        const results = [];
        
        for (const item of sheetData) {
            // Check title match
            const titleMatch = fuzzyMatch(query, item.title);
            
            // Check info match
            const infoMatch = fuzzyMatch(query, item.info);
            
            // Use the best match
            const bestMatch = titleMatch.score > infoMatch.score ? titleMatch : infoMatch;
            
            if (bestMatch.match) {
                // Add match type and score to item
                const enhancedItem = {
                    ...item,
                    matchScore: bestMatch.score,
                    matchType: bestMatch.type.toUpperCase()
                };
                results.push(enhancedItem);
            }
        }
        
        // Sort by score (highest first)
        results.sort((a, b) => b.matchScore - a.matchScore);
        
        filteredData = results;
    }
    
    displayMenuItems();
    updateDebugInfo();
    
    addTerminalLine(`Fuzzy filter applied: "${query}" (${filteredData.length} results)`, 'normal');
}

// Calculator functions
function updateCalculatorDisplay() {
    const displayValue = document.getElementById('calculatorValue');
    const expression = document.getElementById('calculatorExpression');
    
    displayValue.textContent = calculatorState.displayValue;
    expression.textContent = calculatorState.expression;
}

function inputDigit(digit) {
    const { displayValue, waitingForOperand } = calculatorState;
    
    if (waitingForOperand) {
        calculatorState.displayValue = String(digit);
        calculatorState.waitingForOperand = false;
    } else {
        calculatorState.displayValue = displayValue === '0' ? String(digit) : displayValue + digit;
    }
    
    updateCalculatorDisplay();
}

function inputDecimal() {
    const { displayValue, waitingForOperand } = calculatorState;
    
    if (waitingForOperand) {
        calculatorState.displayValue = '0.';
        calculatorState.waitingForOperand = false;
    } else if (displayValue.indexOf('.') === -1) {
        calculatorState.displayValue = displayValue + '.';
    }
    
    updateCalculatorDisplay();
}

function clearCalculator() {
    calculatorState = {
        displayValue: '0',
        expression: '',
        previousValue: null,
        operation: null,
        waitingForOperand: false
    };
    
    updateCalculatorDisplay();
}

function performOperation(nextOperation) {
    const { displayValue, previousValue, operation, expression } = calculatorState;
    const inputValue = parseFloat(displayValue);
    
    if (previousValue === null) {
        calculatorState.previousValue = inputValue;
    } else if (operation) {
        const currentValue = previousValue || 0;
        const newValue = calculate(currentValue, inputValue, operation);
        
        calculatorState.displayValue = String(newValue);
        calculatorState.previousValue = newValue;
        calculatorState.expression = `${currentValue} ${getOperatorSymbol(operation)} ${inputValue} =`;
    }
    
    calculatorState.waitingForOperand = true;
    calculatorState.operation = nextOperation;
    
    if (nextOperation) {
        calculatorState.expression = `${displayValue} ${getOperatorSymbol(nextOperation)}`;
    }
    
    updateCalculatorDisplay();
}

function calculate(firstValue, secondValue, operation) {
    switch (operation) {
        case '+':
            return firstValue + secondValue;
        case '-':
            return firstValue - secondValue;
        case '*':
            return firstValue * secondValue;
        case '/':
            return secondValue !== 0 ? firstValue / secondValue : 0;
        case '%':
            return firstValue % secondValue;
        default:
            return secondValue;
    }
}

function getOperatorSymbol(operation) {
    switch (operation) {
        case '+':
            return '+';
        case '-':
            return '-';
        case '*':
            return '×';
        case '/':
            return '÷';
        case '%':
            return '%';
        default:
            return '';
    }
}

function handleEquals() {
    const { displayValue, previousValue, operation, expression } = calculatorState;
    const inputValue = parseFloat(displayValue);
    
    if (previousValue !== null && operation) {
        const newValue = calculate(previousValue, inputValue, operation);
        
        calculatorState.displayValue = String(newValue);
        calculatorState.expression = `${previousValue} ${getOperatorSymbol(operation)} ${inputValue} =`;
        calculatorState.previousValue = null;
        calculatorState.operation = null;
        calculatorState.waitingForOperand = true;
    }
    
    updateCalculatorDisplay();
}

function handleBackspace() {
    const { displayValue } = calculatorState;
    
    if (displayValue.length > 1) {
        calculatorState.displayValue = displayValue.slice(0, -1);
    } else {
        calculatorState.displayValue = '0';
    }
    
    updateCalculatorDisplay();
}

function handlePercent() {
    const { displayValue } = calculatorState;
    const inputValue = parseFloat(displayValue);
    
    calculatorState.displayValue = String(inputValue / 100);
    updateCalculatorDisplay();
}

// Toggle calculator
function toggleCalculator() {
    const calculatorContainer = document.getElementById('calculatorContainer');
    calculatorContainer.classList.toggle('show');
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('show');
}

// Fetch data when page loads
window.onload = function() {
    createParticles();
    updateSystemTime();
    setInterval(updateSystemTime, 1000);
    showTerminalOutput();
    
    // Sidebar toggle for mobile
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    
    // Debug toggle
    document.getElementById('debugToggle').addEventListener('click', function() {
        debugMode = !debugMode;
        const debugPanel = document.getElementById('debugPanel');
        debugPanel.classList.toggle('show', debugMode);
        updateDebugInfo();
    });
    
    // Update debug info periodically
    setInterval(updateDebugInfo, 1000);
    
    // Filter input with debouncing
    let debounceTimer;
    document.getElementById('filterInput').addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(filterMenuItems, 300);
    });
    
    // Detail modal close button
    document.getElementById('detailClose').addEventListener('click', hideDetail);
    
    // Copy button
    document.getElementById('copyButton').addEventListener('click', copyToClipboard);
    
    // Close modal when clicking outside
    document.getElementById('detailModal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideDetail();
        }
    });
    
    // Calculator toggle
    document.getElementById('calculatorToggle').addEventListener('click', toggleCalculator);
    
    // Calculator buttons
    document.querySelectorAll('.calculator-btn').forEach(button => {
        button.addEventListener('click', function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'number':
                    inputDigit(this.dataset.value);
                    break;
                case 'decimal':
                    inputDecimal();
                    break;
                case 'clear':
                    clearCalculator();
                    break;
                case 'operator':
                    performOperation(this.dataset.value);
                    break;
                case 'equals':
                    handleEquals();
                    break;
                case 'backspace':
                    handleBackspace();
                    break;
                case 'percent':
                    handlePercent();
                    break;
            }
        });
    });
    
    // GANTI PEMANGGILAN FUNGSI DI SINI
    // DARI fetchSheetData() MENJADI fetchGitHubData()
    fetchGitHubData();
};
