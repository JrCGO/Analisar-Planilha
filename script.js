// Global variables
let projectData = [];
let filteredData = [];
let charts = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadSampleData(); // Load sample data for demonstration
});

function initializeApp() {
    // Initialize navigation
    setupNavigation();
    
    // Initialize file upload
    setupFileUpload();
    
    // Initialize search
    setupSearch();
    
    // Initialize filters
    setupFilters();
}

function setupEventListeners() {
    // Sidebar toggle for mobile
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !sidebarToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const pageTitle = document.getElementById('page-title');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding section
            sections.forEach(section => section.classList.remove('active'));
            document.getElementById(`${sectionId}-section`).classList.add('active');
            
            // Update page title
            pageTitle.textContent = item.querySelector('span').textContent;
            
            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                document.querySelector('.sidebar').classList.remove('open');
            }
        });
    });
}

function setupFileUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    const fileList = document.getElementById('fileList');
    
    // Drag and drop functionality
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });
    
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleFiles(files);
    });
    
    function handleFiles(files) {
        const validFiles = files.filter(file => 
            file.type === 'text/csv' || 
            file.type === 'application/xml' || 
            file.type === 'text/xml' ||
            file.name.endsWith('.csv') ||
            file.name.endsWith('.xml')
        );
        
        if (validFiles.length === 0) {
            showToast('Por favor, selecione apenas arquivos CSV ou XML', 'error');
            return;
        }
        
        displayFilePreview(validFiles);
    }
    
    function displayFilePreview(files) {
        fileList.innerHTML = '';
        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <i class="fas fa-file-${file.name.endsWith('.csv') ? 'csv' : 'code'}"></i>
                <span>${file.name}</span>
                <span>(${formatFileSize(file.size)})</span>
            `;
            fileList.appendChild(fileItem);
        });
        
        filePreview.style.display = 'block';
        fileInput.files = createFileList(files);
    }
}

function createFileList(files) {
    const dt = new DataTransfer();
    files.forEach(file => dt.items.add(file));
    return dt.files;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function processFiles() {
    const fileInput = document.getElementById('fileInput');
    const files = Array.from(fileInput.files);
    
    if (files.length === 0) {
        showToast('Nenhum arquivo selecionado', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const allData = [];
        
        for (const file of files) {
            const data = await parseFile(file);
            allData.push(...data);
        }
        
        projectData = processProjectData(allData);
        filteredData = [...projectData];
        
        updateDashboard();
        showToast(`${allData.length} registros processados com sucesso!`, 'success');
        
        // Switch to dashboard
        document.querySelector('[data-section="dashboard"]').click();
        
    } catch (error) {
        console.error('Erro ao processar arquivos:', error);
        showToast('Erro ao processar arquivos. Verifique o formato dos dados.', 'error');
    } finally {
        showLoading(false);
    }
}

async function parseFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                let data;
                
                if (file.name.endsWith('.csv')) {
                    data = parseCSV(content);
                } else if (file.name.endsWith('.xml')) {
                    data = parseXML(content);
                } else {
                    throw new Error('Formato de arquivo não suportado');
                }
                
                resolve(data);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsText(file);
    });
}

function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('Arquivo CSV vazio ou inválido');
    
    const headers = lines[0].split(/[,;]/).map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/[,;]/).map(v => v.trim().replace(/"/g, ''));
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index];
            });
            data.push(row);
        }
    }
    
    return data;
}

function parseXML(content) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('XML inválido');
    }
    
    const items = xmlDoc.getElementsByTagName('item') || xmlDoc.getElementsByTagName('row');
    const data = [];
    
    for (const item of items) {
        const row = {};
        for (const child of item.children) {
            row[child.tagName] = child.textContent;
        }
        data.push(row);
    }
    
    return data;
}

function processProjectData(rawData) {
    const projects = {};
    
    rawData.forEach(item => {
        const projectName = item['Nome do projeto'] || item['projeto'] || item['project'] || 'Projeto Desconhecido';
        const status = normalizeStatus(item['Status'] || item['status'] || 'aberto');
        const priority = normalizePriority(item['Prioridade'] || item['prioridade'] || item['priority'] || 'media');
        const created = parseDate(item['Criado'] || item['criado'] || item['created']);
        const resolved = parseDate(item['Resolvido'] || item['resolvido'] || item['resolved']);
        const responsible = item['Responsavel'] || item['responsavel'] || item['responsible'] || 'Não informado';
        const reporter = item['Relator'] || item['relator'] || item['reporter'] || 'Não informado';
        const type = item['Tipo de item'] || item['tipo'] || item['type'] || 'Tarefa';
        
        if (!projects[projectName]) {
            projects[projectName] = {
                name: projectName,
                items: [],
                stats: {
                    total: 0,
                    open: 0,
                    resolved: 0,
                    avgResolutionTime: 0,
                    totalOpenTime: 0
                }
            };
        }
        
        const processedItem = {
            project: projectName,
            type,
            responsible,
            reporter,
            priority,
            status,
            created,
            resolved,
            resolutionTime: resolved && created ? calculateBusinessDays(created, resolved) : null,
            openTime: status === 'aberto' && created ? calculateBusinessDays(created, new Date()) : null
        };
        
        projects[projectName].items.push(processedItem);
    });
    
    // Calculate project statistics
    Object.values(projects).forEach(project => {
        project.stats.total = project.items.length;
        project.stats.open = project.items.filter(item => item.status === 'aberto').length;
        project.stats.resolved = project.items.filter(item => item.status === 'resolvido').length;
        
        const resolvedItems = project.items.filter(item => item.resolutionTime !== null);
        if (resolvedItems.length > 0) {
            project.stats.avgResolutionTime = Math.round(
                resolvedItems.reduce((sum, item) => sum + item.resolutionTime, 0) / resolvedItems.length
            );
        }
        
        const openItems = project.items.filter(item => item.openTime !== null);
        if (openItems.length > 0) {
            project.stats.totalOpenTime = Math.round(
                openItems.reduce((sum, item) => sum + item.openTime, 0) / openItems.length
            );
        }
    });
    
    return Object.values(projects);
}

function normalizeStatus(status) {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('resolvido') || statusLower.includes('fechado') || statusLower.includes('concluido') || statusLower.includes('done')) {
        return 'resolvido';
    }
    return 'aberto';
}

function normalizePriority(priority) {
    const priorityLower = priority.toLowerCase();
    if (priorityLower.includes('alta') || priorityLower.includes('high') || priorityLower.includes('critica')) {
        return 'alta';
    } else if (priorityLower.includes('baixa') || priorityLower.includes('low')) {
        return 'baixa';
    }
    return 'media';
}

function parseDate(dateString) {
    if (!dateString || dateString.trim() === '') return null;
    
    // Try different date formats
    const formats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY or MM/DD/YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/,    // YYYY-MM-DD
        /(\d{1,2})-(\d{1,2})-(\d{4})/     // DD-MM-YYYY
    ];
    
    for (const format of formats) {
        const match = dateString.match(format);
        if (match) {
            const [, part1, part2, part3] = match;
            
            // Assume DD/MM/YYYY format for the first pattern
            if (format === formats[0]) {
                return new Date(part3, part2 - 1, part1);
            } else if (format === formats[1]) {
                return new Date(part1, part2 - 1, part3);
            } else {
                return new Date(part3, part2 - 1, part1);
            }
        }
    }
    
    // Fallback to Date constructor
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
}

function calculateBusinessDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    let businessDays = 0;
    
    const currentDate = new Date(start);
    while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
            businessDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return businessDays;
}

function updateDashboard() {
    updateStats();
    updateCharts();
    updateProjectsList();
    updateDetailedProjects();
    updateAnalytics();
}

function updateStats() {
    const totalProjects = projectData.length;
    const totalItems = projectData.reduce((sum, project) => sum + project.stats.total, 0);
    const openItems = projectData.reduce((sum, project) => sum + project.stats.open, 0);
    const resolvedItems = projectData.reduce((sum, project) => sum + project.stats.resolved, 0);
    
    document.getElementById('total-projects').textContent = totalProjects;
    document.getElementById('total-items').textContent = totalItems;
    document.getElementById('open-items').textContent = openItems;
    document.getElementById('resolved-items').textContent = resolvedItems;
}

function updateCharts() {
    updateStatusChart();
    updateTimeChart();
    updateTrendChart();
}

function updateStatusChart() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    if (charts.statusChart) {
        charts.statusChart.destroy();
    }
    
    const openItems = projectData.reduce((sum, project) => sum + project.stats.open, 0);
    const resolvedItems = projectData.reduce((sum, project) => sum + project.stats.resolved, 0);
    
    charts.statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Em Aberto', 'Resolvidos'],
            datasets: [{
                data: [openItems, resolvedItems],
                backgroundColor: ['#fbbf24', '#10b981'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateTimeChart() {
    const ctx = document.getElementById('timeChart').getContext('2d');
    
    if (charts.timeChart) {
        charts.timeChart.destroy();
    }
    
    const projectNames = projectData.map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name);
    const avgTimes = projectData.map(p => p.stats.avgResolutionTime || 0);
    
    charts.timeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: projectNames,
            datasets: [{
                label: 'Dias para Resolução',
                data: avgTimes,
                backgroundColor: '#667eea',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Dias'
                    }
                }
            }
        }
    });
}

function updateTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (charts.trendChart) {
        charts.trendChart.destroy();
    }
    
    // Generate monthly trend data
    const monthlyData = generateMonthlyTrend();
    
    charts.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: 'Itens Resolvidos',
                data: monthlyData.resolved,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Itens Criados',
                data: monthlyData.created,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function generateMonthlyTrend() {
    const months = [];
    const resolved = [];
    const created = [];
    
    // Get last 6 months
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthYear = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        months.push(monthYear);
        
        let monthResolved = 0;
        let monthCreated = 0;
        
        projectData.forEach(project => {
            project.items.forEach(item => {
                if (item.created && item.created.getMonth() === date.getMonth() && item.created.getFullYear() === date.getFullYear()) {
                    monthCreated++;
                }
                if (item.resolved && item.resolved.getMonth() === date.getMonth() && item.resolved.getFullYear() === date.getFullYear()) {
                    monthResolved++;
                }
            });
        });
        
        resolved.push(monthResolved);
        created.push(monthCreated);
    }
    
    return { labels: months, resolved, created };
}

function updateProjectsList() {
    const container = document.getElementById('projects-list');
    container.innerHTML = '';
    
    filteredData.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        
        const completionRate = project.stats.total > 0 ? 
            Math.round((project.stats.resolved / project.stats.total) * 100) : 0;
        
        projectCard.innerHTML = `
            <div class="project-header">
                <div>
                    <div class="project-title">${project.name}</div>
                    <div class="project-status ${completionRate === 100 ? 'status-resolved' : 'status-open'}">
                        ${completionRate}% Concluído
                    </div>
                </div>
            </div>
            <div class="project-stats">
                <div class="project-stat">
                    <div class="project-stat-value">${project.stats.open}</div>
                    <div class="project-stat-label">Em Aberto</div>
                </div>
                <div class="project-stat">
                    <div class="project-stat-value">${project.stats.resolved}</div>
                    <div class="project-stat-label">Resolvidos</div>
                </div>
                <div class="project-stat">
                    <div class="project-stat-value">${project.stats.avgResolutionTime || 0}</div>
                    <div class="project-stat-label">Dias Médios</div>
                </div>
                <div class="project-stat">
                    <div class="project-stat-value">${project.stats.totalOpenTime || 0}</div>
                    <div class="project-stat-label">Dias em Aberto</div>
                </div>
            </div>
        `;
        
        container.appendChild(projectCard);
    });
}

function updateDetailedProjects() {
    const container = document.getElementById('detailed-projects');
    container.innerHTML = '';
    
    filteredData.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'detailed-project-card';
        
        // Get unique responsibles and reporters
        const responsibles = [...new Set(project.items.map(item => item.responsible))];
        const reporters = [...new Set(project.items.map(item => item.reporter))];
        const priorities = project.items.reduce((acc, item) => {
            acc[item.priority] = (acc[item.priority] || 0) + 1;
            return acc;
        }, {});
        
        projectCard.innerHTML = `
            <div class="project-header">
                <div class="project-title">${project.name}</div>
                <div class="project-status ${project.stats.resolved === project.stats.total ? 'status-resolved' : 'status-open'}">
                    ${project.stats.resolved}/${project.stats.total} Concluídos
                </div>
            </div>
            <div class="project-details">
                <div class="detail-item">
                    <div class="detail-label">Responsáveis</div>
                    <div class="detail-value">${responsibles.slice(0, 3).join(', ')}${responsibles.length > 3 ? '...' : ''}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Relatores</div>
                    <div class="detail-value">${reporters.slice(0, 3).join(', ')}${reporters.length > 3 ? '...' : ''}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Tempo Médio</div>
                    <div class="detail-value">${project.stats.avgResolutionTime || 0} dias úteis</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Prioridade Alta</div>
                    <div class="detail-value">${priorities.alta || 0} itens</div>
                </div>
            </div>
        `;
        
        container.appendChild(projectCard);
    });
}

function updateAnalytics() {
    // Calculate overall metrics
    const allItems = projectData.flatMap(p => p.items);
    const resolvedItems = allItems.filter(item => item.resolutionTime !== null);
    
    const avgResolutionTime = resolvedItems.length > 0 ? 
        Math.round(resolvedItems.reduce((sum, item) => sum + item.resolutionTime, 0) / resolvedItems.length) : 0;
    
    const resolutionRate = allItems.length > 0 ? 
        Math.round((resolvedItems.length / allItems.length) * 100) : 0;
    
    // Find most active project
    const mostActiveProject = projectData.reduce((max, project) => 
        project.stats.total > (max?.stats.total || 0) ? project : max, null);
    
    // Find most productive user
    const userStats = {};
    allItems.forEach(item => {
        if (item.status === 'resolvido') {
            userStats[item.responsible] = (userStats[item.responsible] || 0) + 1;
        }
    });
    const mostProductiveUser = Object.keys(userStats).reduce((max, user) => 
        userStats[user] > (userStats[max] || 0) ? user : max, 'Nenhum');
    
    // Update metrics display
    document.getElementById('avg-resolution-time').textContent = `${avgResolutionTime} dias`;
    document.getElementById('resolution-rate').textContent = `${resolutionRate}%`;
    document.getElementById('most-active-project').textContent = mostActiveProject?.name || 'Nenhum';
    document.getElementById('most-productive-user').textContent = mostProductiveUser;
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filterProjects(searchTerm);
    });
}

function setupFilters() {
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    
    statusFilter?.addEventListener('change', applyFilters);
    priorityFilter?.addEventListener('change', applyFilters);
}

function applyFilters() {
    const statusFilter = document.getElementById('statusFilter')?.value;
    const priorityFilter = document.getElementById('priorityFilter')?.value;
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    
    filteredData = projectData.filter(project => {
        const matchesSearch = project.name.toLowerCase().includes(searchTerm);
        
        let matchesStatus = true;
        if (statusFilter) {
            if (statusFilter === 'aberto') {
                matchesStatus = project.stats.open > 0;
            } else if (statusFilter === 'resolvido') {
                matchesStatus = project.stats.resolved === project.stats.total;
            }
        }
        
        let matchesPriority = true;
        if (priorityFilter) {
            matchesPriority = project.items.some(item => item.priority === priorityFilter);
        }
        
        return matchesSearch && matchesStatus && matchesPriority;
    });
    
    updateProjectsList();
    updateDetailedProjects();
}

function filterProjects(searchTerm) {
    filteredData = projectData.filter(project => 
        project.name.toLowerCase().includes(searchTerm)
    );
    updateProjectsList();
    updateDetailedProjects();
}

function showUploadSection() {
    document.querySelector('[data-section="upload"]').click();
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 'exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function generatePerformanceReport() {
    const report = {
        timestamp: new Date().toLocaleString('pt-BR'),
        summary: {
            totalProjects: projectData.length,
            totalItems: projectData.reduce((sum, p) => sum + p.stats.total, 0),
            completionRate: Math.round((projectData.reduce((sum, p) => sum + p.stats.resolved, 0) / 
                                      projectData.reduce((sum, p) => sum + p.stats.total, 0)) * 100) || 0
        },
        projects: projectData.map(project => ({
            name: project.name,
            total: project.stats.total,
            resolved: project.stats.resolved,
            avgResolutionTime: project.stats.avgResolutionTime,
            completionRate: Math.round((project.stats.resolved / project.stats.total) * 100) || 0
        }))
    };
    
    downloadReport(report, 'relatorio-performance');
    showToast('Relatório de performance gerado com sucesso!', 'success');
}

function generateTimeReport() {
    const allItems = projectData.flatMap(p => p.items);
    const resolvedItems = allItems.filter(item => item.resolutionTime !== null);
    
    const report = {
        timestamp: new Date().toLocaleString('pt-BR'),
        summary: {
            avgResolutionTime: resolvedItems.length > 0 ? 
                Math.round(resolvedItems.reduce((sum, item) => sum + item.resolutionTime, 0) / resolvedItems.length) : 0,
            fastestResolution: Math.min(...resolvedItems.map(item => item.resolutionTime)) || 0,
            slowestResolution: Math.max(...resolvedItems.map(item => item.resolutionTime)) || 0
        },
        details: resolvedItems.map(item => ({
            project: item.project,
            type: item.type,
            responsible: item.responsible,
            resolutionTime: item.resolutionTime,
            priority: item.priority
        }))
    };
    
    downloadReport(report, 'relatorio-tempo');
    showToast('Relatório de tempo gerado com sucesso!', 'success');
}

function generateExecutiveReport() {
    const allItems = projectData.flatMap(p => p.items);
    const resolvedItems = allItems.filter(item => item.status === 'resolvido');
    
    const report = {
        timestamp: new Date().toLocaleString('pt-BR'),
        executiveSummary: {
            totalProjects: projectData.length,
            totalItems: allItems.length,
            resolvedItems: resolvedItems.length,
            resolutionRate: Math.round((resolvedItems.length / allItems.length) * 100) || 0,
            avgResolutionTime: resolvedItems.length > 0 ? 
                Math.round(resolvedItems.reduce((sum, item) => sum + item.resolutionTime, 0) / resolvedItems.length) : 0
        },
        topProjects: projectData
            .sort((a, b) => b.stats.total - a.stats.total)
            .slice(0, 5)
            .map(p => ({
                name: p.name,
                total: p.stats.total,
                completionRate: Math.round((p.stats.resolved / p.stats.total) * 100) || 0
            })),
        recommendations: generateRecommendations()
    };
    
    downloadReport(report, 'relatorio-executivo');
    showToast('Relatório executivo gerado com sucesso!', 'success');
}

function generateRecommendations() {
    const recommendations = [];
    
    // Analyze projects with low completion rates
    const lowCompletionProjects = projectData.filter(p => {
        const rate = (p.stats.resolved / p.stats.total) * 100;
        return rate < 50 && p.stats.total > 5;
    });
    
    if (lowCompletionProjects.length > 0) {
        recommendations.push(`${lowCompletionProjects.length} projeto(s) com baixa taxa de conclusão precisam de atenção`);
    }
    
    // Analyze projects with high resolution times
    const slowProjects = projectData.filter(p => p.stats.avgResolutionTime > 30);
    if (slowProjects.length > 0) {
        recommendations.push(`${slowProjects.length} projeto(s) com tempo de resolução acima de 30 dias`);
    }
    
    // Analyze workload distribution
    const allItems = projectData.flatMap(p => p.items);
    const userWorkload = {};
    allItems.forEach(item => {
        userWorkload[item.responsible] = (userWorkload[item.responsible] || 0) + 1;
    });
    
    const maxWorkload = Math.max(...Object.values(userWorkload));
    const minWorkload = Math.min(...Object.values(userWorkload));
    
    if (maxWorkload > minWorkload * 3) {
        recommendations.push('Considere redistribuir a carga de trabalho entre os responsáveis');
    }
    
    return recommendations.length > 0 ? recommendations : ['Todos os indicadores estão dentro dos parâmetros normais'];
}

function downloadReport(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Load sample data for demonstration
function loadSampleData() {
    const sampleData = [
        {
            'Nome do projeto': 'Sistema de Vendas',
            'Tipo de item': 'Bug',
            'Responsavel': 'João Silva',
            'Relator': 'Maria Santos',
            'Prioridade': 'Alta',
            'Status': 'Resolvido',
            'Criado': '15/01/2024',
            'Resolvido': '20/01/2024'
        },
        {
            'Nome do projeto': 'Sistema de Vendas',
            'Tipo de item': 'Feature',
            'Responsavel': 'Ana Costa',
            'Relator': 'Pedro Lima',
            'Prioridade': 'Média',
            'Status': 'Aberto',
            'Criado': '22/01/2024',
            'Resolvido': ''
        },
        {
            'Nome do projeto': 'Portal do Cliente',
            'Tipo de item': 'Bug',
            'Responsavel': 'Carlos Oliveira',
            'Relator': 'Lucia Ferreira',
            'Prioridade': 'Alta',
            'Status': 'Resolvido',
            'Criado': '10/01/2024',
            'Resolvido': '25/01/2024'
        },
        {
            'Nome do projeto': 'Portal do Cliente',
            'Tipo de item': 'Melhoria',
            'Responsavel': 'João Silva',
            'Relator': 'Maria Santos',
            'Prioridade': 'Baixa',
            'Status': 'Aberto',
            'Criado': '28/01/2024',
            'Resolvido': ''
        },
        {
            'Nome do projeto': 'App Mobile',
            'Tipo de item': 'Feature',
            'Responsavel': 'Ana Costa',
            'Relator': 'Pedro Lima',
            'Prioridade': 'Alta',
            'Status': 'Resolvido',
            'Criado': '05/01/2024',
            'Resolvido': '18/01/2024'
        },
        {
            'Nome do projeto': 'App Mobile',
            'Tipo de item': 'Bug',
            'Responsavel': 'Carlos Oliveira',
            'Relator': 'Lucia Ferreira',
            'Prioridade': 'Média',
            'Status': 'Resolvido',
            'Criado': '12/01/2024',
            'Resolvido': '16/01/2024'
        }
    ];
    
    projectData = processProjectData(sampleData);
    filteredData = [...projectData];
    updateDashboard();
}