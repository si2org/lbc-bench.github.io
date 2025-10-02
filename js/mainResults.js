// Dictionary mapping status to natual language
const statusToNaturalLanguage = {
    'no_generation': 'No Generation',
    'generated': 'Generated',
    'with_logs': 'With Logs',
    'install_fail': 'Install Failed',
    'reset_failed': 'Reset Failed',
    'no_apply': 'Patch Apply Failed',
    'applied': 'Patch Applied',
    'test_errored': 'Test Errored',
    'test_timeout': 'Test Timed Out',
    'resolved': 'Resolved'
}

// Store loaded leaderboards to avoid re-rendering
const loadedLeaderboards = new Set();
let leaderboardData = null;

const sortState = { field: 'resolved_full', direction: 'desc' };

function loadLeaderboardData() {
    if (!leaderboardData) {
        const dataScript = document.getElementById('leaderboard-data');
        if (dataScript) {
            leaderboardData = JSON.parse(dataScript.textContent);
        }
    }
    return leaderboardData;
}

function sortItems(a, b, field, direction) {
    const getValue = (item, field) => {
        switch (field) {
            case 'name':
                return (item.name || '').toLowerCase();
            case 'resolved_full':
                return parseFloat(item.resolved_full) || 0;
            case 'resolved_oss':
                return parseFloat(item.resolved_oss) || 0;
            case 'cost':
                return parseFloat(item.cost) || 0;
            case 'org':
                return getOrgName(item);
            case 'date':
                return item.date || '';
            case 'logs':
            case 'trajs':
            case 'site':
                return item[field] ? 1 : 0;
            case 'release':
                return (item['mini-swe-agent_version'] || '').toLowerCase();
            default:
                return '';
        }
    };
    
    const av = getValue(a, field);
    const bv = getValue(b, field);
    
    let result;
    if (typeof av === 'number' && typeof bv === 'number') {
        result = av - bv;
    } else {
        result = av.toString().localeCompare(bv.toString());
    }
    
    return direction === 'asc' ? result : -result;
}

function getOrgName(item) {
    if (item.tags && item.tags.length > 0) {
        const orgTag = item.tags.find(tag => tag.startsWith('Org: '));
        if (orgTag) {
            return orgTag.substring(5).toLowerCase(); // Remove 'Org: ' prefix
        }
    }
    return (item.name || '').toLowerCase();
}

function getDefaultSortDirection(field) {
    const textFields = ['name', 'org', 'release'];
    return textFields.includes(field) ? 'asc' : 'desc';
}

function renderLeaderboardTable(leaderboard) {
    const container = document.getElementById('leaderboard-container');
    // const isBashOnly = leaderboard.name.toLowerCase() === 'code-generation-limited-context';
    
    const results = leaderboard.results
        .filter(item => !item.warning)
        .slice()
        .sort((a, b) => sortItems(a, b, sortState.field, sortState.direction));

    // Create table content
    const tableHtml = `
        <div class="tabcontent active" id="leaderboard-${leaderboard.name}">
            <div class="table-responsive">
                <table class="table scrollable data-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="name">Model</th>
                            <th class="sortable" data-sort="resolved_full">% Resolved Full</th>
                            <th class="sortable" data-sort="resolved_oss">% Resolved OSS</th>
                            <th class="sortable" data-sort="org">Org</th>
                            <th class="sortable" data-sort="cost">Cost</th>
                            <th class="sortable" data-sort="date">Date</th>
                            <th class="sortable" data-sort="logs">Logs</th>
                            <th class="sortable" data-sort="trajs">Trajs</th>
                            <th class="sortable" data-sort="site">Site</th>
                            <th class="sortable" data-sort="release">Release</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map(item => `
                                <tr
                                    data-checked="${item.checked ? 'true' : 'false'}"
                                    data-tags="${item.tags ? item.tags.join(',') : ''}"
                                    data-name="${item.name}"
                                >
                                    <td>
                                        <div class="flex items-center gap-1">
                                            <div class="model-badges">
                                                ${item.checked ? '<span title="The agent run was performed by or directly verified by the LBC-bench team">✅</span>' : ''}
                                            </div>
                                            <span class="model-name font-mono fw-medium">${item.name}</span>
                                        </div>
                                    </td>
                                    <td><span class="number fw-medium text-primary">${parseFloat(item.resolved_full).toFixed(2)}</span></td>
                                    <td><span class="number fw-medium text-primary">${parseFloat(item.resolved_oss).toFixed(2)}</span></td>
                                    <td>
                                        ${item.logo && item.logo.length > 0 ? `
                                            <div style="display: flex; align-items: center;">
                                                ${item.logo.map(logoUrl => `<img src="${logoUrl}" style="height: 1.5em;" />`).join('')}
                                            </div>
                                        ` : '-'}
                                    </td>
                                    <td><span class="number fw-medium text-primary">${parseFloat(item.cost).toFixed(2)}</span></td>
                                    <td><span class="label-date text-muted">${item.date}</span></td>
                                    <td class="centered-text text-center">
                                        ${item.logs ? '<span class="text-success">✓</span>' : '<span class="text-muted">-</span>'}
                                    </td>
                                    <td class="centered-text text-center">
                                        ${item.trajs ? '<span class="text-success">✓</span>' : '<span class="text-muted">-</span>'}
                                    </td>
                                    <td class="centered-text text-center">
                                        ${item.site ? `<a href="${item.site}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i></a>` : '<span class="text-muted">-</span>'}
                                    </td>
                                    <td><span class="text-muted font-mono">-</span></td>
                                </tr>
                            `).join('')}
                        <tr class="no-results" style="display: none;">
                            <td colspan="10" class="text-center">
                                No entries match the selected filters. Try adjusting your filters.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = tableHtml;
    loadedLeaderboards.add(leaderboard.name);

    updateSortIndicators();
    attachSortHandlers(leaderboard.name);
}

function attachSortHandlers(leaderboardName) {
    const container = document.getElementById('leaderboard-container');
    const tableWrapper = container.querySelector(`#leaderboard-${leaderboardName}`);
    if (!tableWrapper) return;
    
    const sortableHeaders = tableWrapper.querySelectorAll('th.sortable');
    sortableHeaders.forEach(th => {
        th.addEventListener('click', () => handleSortClick(th, leaderboardName));
    });
}

function handleSortClick(header, leaderboardName) {
    const field = header.getAttribute('data-sort');
    
    if (sortState.field === field) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.field = field;
        sortState.direction = getDefaultSortDirection(field);
    }
    
    const data = loadLeaderboardData();
    if (!data) return;
    
    const leaderboard = data.find(lb => lb.name === leaderboardName);
    if (leaderboard) {
        renderLeaderboardTable(leaderboard);
    }
}

function updateSortIndicators() {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;
    
    const headers = container.querySelectorAll('th.sortable');
    headers.forEach(th => {
        const field = th.getAttribute('data-sort');
        const isActive = field === sortState.field;
        
        th.classList.remove('sort-active', 'sort-inactive');
        th.classList.add(isActive ? 'sort-active' : 'sort-inactive');
    });
}

function createTableHeader(keys, table) {
    const headerRowWrapper = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const status of keys) {
        const th = document.createElement('th');
        th.textContent = statusToNaturalLanguage[status];
        headerRow.appendChild(th);
    }
    headerRowWrapper.appendChild(headerRow);
    table.appendChild(headerRowWrapper);
}

function createTableBody(data, split, model, keys, table) {
    const bodyRowWrapper = document.createElement('tbody');
    const bodyRow = document.createElement('tr');
    for (const status of keys) {
        const td = document.createElement('td');

        const ids = data[status].slice().sort();

        ids.forEach(id => {
            const div = document.createElement('div');
            div.textContent = id;
            if (!(status === 'no_generation' || status === 'generated')) {
                div.classList.add('instance');
                div.classList.add(id);
            } else {
                div.classList.add('instance-not-clickable');
            }
            td.appendChild(div);
        });

        bodyRow.appendChild(td);
    }
    bodyRowWrapper.appendChild(bodyRow);
    table.appendChild(bodyRowWrapper);

    for (const status of keys) {
        const ids = data[status].slice().sort();
        ids.forEach(id => {
            if (!(status === 'no_generation' || status === 'generated')) {
                const divs = document.getElementsByClassName(id);
                Array.from(divs).forEach(div => {
                });
            }
        });
    }
}

function openLeaderboard(leaderboardName) {
    const data = loadLeaderboardData();
    if (!data) return;
    
    // Find the leaderboard data
    const leaderboard = data.find(lb => lb.name === leaderboardName);
    if (!leaderboard) return;
    
    // Render the table if not already loaded
    if (!loadedLeaderboards.has(leaderboardName)) {
        renderLeaderboardTable(leaderboard);
    } else {
        // Just show the existing table
        const container = document.getElementById('leaderboard-container');
        const existingTable = container.querySelector(`#leaderboard-${leaderboardName}`);
        if (existingTable) {
            // Hide all other tables and show this one
            container.querySelectorAll('.tabcontent').forEach(content => {
                content.classList.remove('active');
            });
            existingTable.classList.add('active');
            updateSortIndicators();
        } else {
            renderLeaderboardTable(leaderboard);
        }
    }
    
    // Update tab button states
    const tablinks = document.querySelectorAll('.tablinks');
    tablinks.forEach(link => link.classList.remove('active'));
    
    const activeButton = document.querySelector(`.tablinks[data-leaderboard="${leaderboardName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Update the leaderboard description text
    if (typeof updateLeaderboardDescription === 'function') {
        updateLeaderboardDescription(leaderboardName);
    }
    
    // Update filter visibility based on leaderboard type
    if (typeof updateFilterVisibility === 'function') {
        updateFilterVisibility(leaderboardName);
    }
    
    // Update tags dropdown for the new leaderboard
    if (typeof updateTagsForLeaderboard === 'function') {
        updateTagsForLeaderboard(leaderboardName);
    }
    
    // Apply current filters to the newly displayed table
    if (typeof updateTable === 'function') {
        setTimeout(updateTable, 0);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop().split('.')[0] || 'index';
    
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('data-page');
        
        link.classList.remove('active');
        
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
        
        if (currentPage === 'index' && window.location.hash) {
            const currentHash = window.location.hash.substring(1);
            
            if (linkPage === currentHash && !['code-generation-limited-context', 'code-comprehension', 'code-generation-heavy-context'].includes(currentHash)) {
                link.classList.add('active');
            }
        }
    });
    
    const tabLinks = document.querySelectorAll('.tablinks');
    tabLinks.forEach(tab => {
        tab.addEventListener('click', function() {
            const leaderboardType = this.getAttribute('data-leaderboard');
            openLeaderboard(leaderboardType);
        });
    });
    
    // Load initial tab based on hash or default to Verified (mini-SWE-agent)
    const hash = window.location.hash.slice(1).toLowerCase();
    const validTabs = ['code-generation-limited-context', 'code-comprehension', 'code-generation-heavy-context'];
    
    if (hash && validTabs.includes(hash)) {
        const tabName = hash.charAt(0).toUpperCase() + hash.slice(1);
        openLeaderboard(tabName);
    } else {
        openLeaderboard('code-generation-limited-context');
    }
});
