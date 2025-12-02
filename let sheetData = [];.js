let sheetData = [];
let filteredData = [];
let currentDetail = null;
let debugMode = false;
let currentCategory = 'all'; // Menyimpan kategori yang dipilih

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
        <div>Current Category: ${currentCategory}</div>
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

// Fetch data from Google Sheets with multiple fallback methods
async function fetchSheetData() {
    const sheetId = '1k5U_YwloyQsad7PT_DmXobkNycJ6bsV0zhE00TLmSIg';
    
    updateSystemStatus('MENGAMBIL DATA...', 'warning');
    addTerminalLine('Attempting to connect to database...', 'warning');
    
    // Method 1: Try to access the first sheet by gid=0
    try {
        addTerminalLine('Method 1: Accessing sheet by gid=0...', 'normal');
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=0`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        // Check if we got valid data
        if (text.includes('google.visualization.Query.setResponse')) {
            const json = JSON.parse(text.substring(47).slice(0, -2));
            const rows = json.table.rows;
            
            sheetData = [];
            for (let i = 0; i < rows.length; i++) {
                const titleCell = rows[i].c[0];
                const infoCell = rows[i].c[1];
                
                const title = titleCell && titleCell.v ? String(titleCell.v) : '';
                const info = infoCell && infoCell.v ? String(infoCell.v) : '';
                
                if (title) {
                    sheetData.push({ 
                        title: title.trim(), 
                        info: info.trim(),
                        category: 'general', // Kategori default
                        accessLevel: 'standard' // Level akses default
                    });
                }
            }
            
            if (sheetData.length > 0) {
                addTerminalLine(`SUCCESS: Loaded ${sheetData.length} menu items from database`, 'success');
                updateSystemStatus('SISTEM ONLINE', 'success');
                localStorage.setItem('cybersearch_data', JSON.stringify(sheetData));
                localStorage.setItem('cybersearch_timestamp', new Date().toISOString());
                initializeFilters(); // Inisialisasi filter setelah data dimuat
                filteredData = [...sheetData];
                displayMenuItems();
                updateDebugInfo();
                return;
            }
        }
    } catch (error) {
        addTerminalLine(`Method 1 failed: ${error.message}`, 'error');
        console.error('Method 1 error:', error);
    }
    
    // ... (Metode 2, 3, 4 tetap sama, hanya menambahkan kategori & level akses default)
    
    // Method 5: Use sample data as last resort
    addTerminalLine('Method 5: Using sample data...', 'warning');
    sheetData = [
        { title: "System Diagnostics", info: "Run a full system diagnostic check to identify hardware and software issues.", category: "system", accessLevel: "admin" },
        { title: "Network Monitor", info: "Monitor real-time network traffic, bandwidth usage, and connected devices.", category: "network", accessLevel: "advanced" },
        { title: "Firewall Configuration", info: "Configure and manage firewall rules to control incoming and outgoing network traffic.", category: "security", accessLevel: "admin" },
        { title: "User Log Viewer", info: "View and filter system logs for user activities, errors, and security events.", category: "system", accessLevel: "advanced" },
        { title: "Database Backup", info: "Initiate a manual backup of the main database to a secure cloud storage.", category: "database", accessLevel: "admin" },
        { title: "Password Reset", info: "Reset the password for any user account. Requires admin privileges.", category: "security", accessLevel: "admin" },
        { title: "Software Update", info: "Check for and install the latest software updates for the operating system.", category: "system", accessLevel: "standard" },
        { title: "Performance Metrics", info: "View detailed performance metrics including CPU, RAM, and disk usage.", category: "system", accessLevel: "guest" },
        { title: "Vulnerability Scan", info: "Scan the system for known security vulnerabilities and exploits.", category: "security", accessLevel: "advanced" },
        { title: "Connection Status", info: "Check the status of all active network connections and open ports.", category: "network", accessLevel: "guest" }
    ];
    
    addTerminalLine(`WARNING: Using ${sheetData.length} sample menu items`, 'warning');
    updateSystemStatus('SISTEM OFFLINE', 'error');
    initializeFilters(); // Inisialisasi filter
    filteredData = [...sheetData];
    displayMenuItems();
    updateDebugInfo();
}

// Initialize category filter buttons
function initializeFilters() {
    const categoryButtonsContainer = document.getElementById('categoryButtons');
    const categories = ['all', ...new Set(sheetData.map(item => item.category))];
    
    categoryButtonsContainer.innerHTML = categories.map(cat => `
        <button class="category-btn ${cat === 'all' ? 'active' : ''}" data-category="${cat}">
            ${cat.toUpperCase()}
        </button>
    `).join('');

    // Add event listeners to category buttons
    categoryButtonsContainer.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            categoryButtonsContainer.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.dataset.category;
            applyFilters(); // Terapkan filter kategori dan teks
        });
    });
}

// Apply both category and text filters
function applyFilters() {
    const query = document.getElementById('filterInput').value.trim();
    let tempData = sheetData;

    // Filter by category first
    if (currentCategory !== 'all') {
        tempData = tempData.filter(item => item.category === currentCategory);
    }

    // Then filter by text (fuzzy search)
    if (query === '') {
        filteredData = tempData.map(item => ({ ...item }));
    } else {
        const results = [];
        for (const item of tempData) {
            const titleMatch = fuzzyMatch(query, item.title);
            const infoMatch = fuzzyMatch(query, item.info);
            const bestMatch = titleMatch.score > infoMatch.score ? titleMatch : infoMatch;
            
            if (bestMatch.match) {
                results.push({
                    ...item,
                    matchScore: bestMatch.score,
                    matchType: bestMatch.type.toUpperCase()
                });
            }
        }
        results.sort((a, b) => b.matchScore - a.matchScore);
        filteredData = results;
    }

    displayMenuItems();
    updateDebugInfo();
    addTerminalLine(`Filters applied: Category='${currentCategory}', Query='${query}' (${filteredData.length} results)`, 'normal');
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
    
    container.innerHTML = filteredData.map((item, index) => {
        const accessLevel = item.accessLevel || 'standard';
        const accessColor = {
            'admin': '#ff4444',
            'advanced': '#ffaa00',
            'standard': 'var(--accent-color)',
            'guest': '#888888'
        }[accessLevel] || 'var(--accent-color)';

        return `
            <div class="menu-item hologram cyber-border" data-index="${index}">
                <div class="match-indicator">${item.matchType || 'MATCH'}</div>
                <div class="access-level" style="color: ${accessColor}">[${accessLevel.toUpperCase()}]</div>
                <h3 class="menu-title cyber-text" data-text="${item.title}">${item.title}</h3>
                <div class="menu-preview">${item.info}</div>
            </div>
        `;
    }).join('');
    
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
    const accessLevelDiv = document.getElementById('detailAccessLevel');
    const actionsContainer = document.getElementById('detailActions');
    
    title.textContent = item.title;
    text.textContent = item.info;

    // Tampilkan level akses
    const accessLevel = item.accessLevel || 'standard';
    const accessColor = {
        'admin': '#ff4444',
        'advanced': '#ffaa00',
        'standard': 'var(--accent-color)',
        'guest': '#888888'
    }[accessLevel] || 'var(--accent-color)';
    accessLevelDiv.innerHTML = `<span class="access-level" style="color: ${accessColor}">LEVEL AKSES: ${accessLevel.toUpperCase()}</span>`;

    // Tambahkan tombol aksi
    actionsContainer.innerHTML = `
        <button class="action-button execute-button">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            EKSEKUSI
        </button>
        <button class="action-button copy-button" id="copyButton">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            SALIN
        </button>
        <button class="action-button logs-button">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/></svg>
            LOGS
        </button>
        <span id="copySuccess" class="copy-success">Tersalin!</span>
    `;
    
    // Attach event listeners for new buttons
    document.getElementById('copyButton').addEventListener('click', copyToClipboard);
    document.querySelector('.execute-button').addEventListener('click', () => executeCommand(item));
    document.querySelector('.logs-button').addEventListener('click', () => viewLogs(item));
    
    modal.classList.add('show');
    updateDebugInfo();
    addTerminalLine(`Opening menu: ${item.title}`, 'normal');
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
        const successElement = document.getElementById('copySuccess');
        successElement.classList.add('show');
        addTerminalLine(`Data copied to clipboard: ${currentDetail.info.substring(0, 50)}${currentDetail.info.length > 50 ? '...' : ''}`, 'success');
        setTimeout(() => {
            successElement.classList.remove('show');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        addTerminalLine(`ERROR: Failed to copy text - ${err.message}`, 'error');
    });
}

// Execute command function
function executeCommand(item) {
    addTerminalLine(`Executing command for ${item.title}...`, 'warning');
    setTimeout(() => {
        addTerminalLine(`Command executed successfully`, 'success');
        addTerminalLine(`Result: ${item.info.substring(0, 50)}...`, 'normal');
    }, 1500);
}

// View logs function
function viewLogs(item) {
    addTerminalLine(`Fetching logs for ${item.title}...`, 'normal');
    setTimeout(() => {
        addTerminalLine(`[${new Date().toLocaleString()}] Access granted`, 'normal');
        addTerminalLine(`[${new Date().toLocaleString()}] Command executed`, 'success');
        addTerminalLine(`[${new Date().toLocaleString()}] Data retrieved`, 'normal');
    }, 1000);
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
        case '+': return firstValue + secondValue;
        case '-': return firstValue - secondValue;
        case '*': return firstValue * secondValue;
        case '/': return secondValue !== 0 ? firstValue / secondValue : 0;
        case '%': return firstValue % secondValue;
        default: return secondValue;
    }
}

function getOperatorSymbol(operation) {
    switch (operation) {
        case '+': return '+';
        case '-': return '-';
        case '*': return '×';
        case '/': return '÷';
        case '%': return '%';
        default: return '';
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
        debounceTimer = setTimeout(applyFilters, 300); // Panggil applyFilters bukan filterMenuItems
    });
    
    // Detail modal close button
    document.getElementById('detailClose').addEventListener('click', hideDetail);
    
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
                case 'number': inputDigit(this.dataset.value); break;
                case 'decimal': inputDecimal(); break;
                case 'clear': clearCalculator(); break;
                case 'operator': performOperation(this.dataset.value); break;
                case 'equals': handleEquals(); break;
                case 'backspace': handleBackspace(); break;
                case 'percent': handlePercent(); break;
            }
        });
    });
    
    // Fetch data
    fetchSheetData();
};
