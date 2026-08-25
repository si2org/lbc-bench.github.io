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
let rowMarkersData = null;
let checkedMarker = { symbol: '✅', image: './img/SI2_Logo_Circle_White.png', title: 'Evaluated by Si2' };

const sortState = { field: 'resolved_full', direction: 'desc' };

const COLUMN_TOOLTIPS = {
    resolved_full: 'Pass rate (problems passed / problems attempted) across open-source and commercial simulator runs. Shown as “-” when a commercial simulator was unavailable.',
    resolved_oss: 'Pass rate (problems passed / problems attempted) on open-source (OSS) simulator dataset runs.',
    cost: 'Average cost per test in USD. If it costs $C to run 5 samples across 800 tests, this value is C/(5 × 800). Shown as “-” when cost is unavailable.'
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function loadJsonScript(elementId) {
    const dataScript = document.getElementById(elementId);
    if (!dataScript) {
        return null;
    }
    return JSON.parse(dataScript.textContent);
}

function loadLeaderboardData() {
    if (!leaderboardData) {
        leaderboardData = loadJsonScript('leaderboard-data');
    }
    return leaderboardData;
}

function loadRowMarkersData() {
    if (!rowMarkersData) {
        rowMarkersData = loadJsonScript('row-markers-data') || { markers: [], entries: {} };
        const loadedCheckedMarker = loadJsonScript('checked-marker-data');
        if (loadedCheckedMarker && loadedCheckedMarker.symbol && loadedCheckedMarker.title) {
            checkedMarker = loadedCheckedMarker;
        }
    }
    return rowMarkersData;
}

function getRowMarkerMap(rowMarkers) {
    const markers = Array.isArray(rowMarkers.markers) ? rowMarkers.markers : [];
    const markerMap = {};
    markers.forEach(marker => {
        if (marker && marker.id) {
            markerMap[marker.id] = marker;
        }
    });
    return markerMap;
}

function renderInfoMarker(symbol, title, color, markerId, image) {
    const safeTitle = escapeHtml(title);
    if (image) {
        return `<img class="info-marker info-marker-image" src="${escapeHtml(image)}" alt="${safeTitle}" title="${safeTitle}" />`;
    }
    const safeSymbol = escapeHtml(symbol);
    const hasColor = HEX_COLOR.test(color || '');
    const colorAttr = hasColor ? ` style="color: ${color};"` : '';
    const classes = ['info-marker'];
    if (hasColor) {
        classes.push('info-marker-symbol');
    }
    if (markerId === 'asterisk') {
        classes.push('info-marker-asterisk');
    }
    if (markerId === 'triangle') {
        classes.push('info-marker-triangle');
    }
    return `<span class="${classes.join(' ')}" title="${safeTitle}"${colorAttr}>${safeSymbol}</span>`;
}

function renderRowMarkers(item) {
    if (item.checked) {
        return renderInfoMarker(checkedMarker.symbol, checkedMarker.title, undefined, undefined, checkedMarker.image);
    }

    const rowMarkers = loadRowMarkersData();
    const markerMap = getRowMarkerMap(rowMarkers);
    const entry = rowMarkers.entries && rowMarkers.entries[item.id];
    if (!entry || !Array.isArray(entry.markers)) {
        return '';
    }

    return entry.markers.map(markerName => {
        const marker = markerMap[markerName];
        if (!marker) {
            return '';
        }
        return renderInfoMarker(marker.symbol, marker.title, marker.color, marker.id, marker.image);
    }).join('');
}

function renderMarkerLegend() {
    const legend = document.getElementById('marker-legend');
    if (!legend) {
        return;
    }

    const rowMarkers = loadRowMarkersData();
    const catalog = Array.isArray(rowMarkers.markers) ? rowMarkers.markers : [];
    const legendItems = [
        checkedMarker,
        ...catalog
    ];

    legend.innerHTML = legendItems.map(marker => `
        <span class="marker-legend-item">${renderInfoMarker(marker.symbol, marker.title, marker.color, marker.id, marker.image)}<span>${escapeHtml(marker.title)}</span></span>
    `).join('');
}

function getLogsTrajsValue(item) {
    return item["logs/trajs"] || item.logs || item.trajs || '';
}

function renderResolvedCell(value, logsTrajsUrl) {
    const formattedValue = cleanNum(value);
    if (formattedValue === "-") {
        return '<span class="number fw-medium text-primary">-</span>';
    }

    const content = `<span class="number fw-medium text-primary">${formattedValue}</span>`;
    if (!logsTrajsUrl) {
        return content;
    }

    return `<a href="${logsTrajsUrl}" target="_blank" rel="noopener noreferrer" title="Open logs/trajectories">${content}</a>`;
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
            case 'site':
                return item[field] ? 1 : 0;
            case 'release':
                return item.release || '';
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

const cleanNum = (val) => {
    // If it's null, undefined, the string "NaN", or mathematically NaN
    if (val === null || val === undefined || val === "NaN" || isNaN(parseFloat(val))) {
        return "-";
    }
    return parseFloat(val).toFixed(2);
};

function renderLeaderboardTable(leaderboard) {
    const container = document.getElementById('leaderboard-container');
    // const isBashOnly = leaderboard.name.toLowerCase() === 'code-generation-limited-context';
    
    const results = leaderboard.results
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
                            <th class="sortable has-col-tooltip" data-sort="resolved_full" data-tooltip="${escapeHtml(COLUMN_TOOLTIPS.resolved_full)}">% Resolved Full</th>
                            <th class="sortable has-col-tooltip" data-sort="resolved_oss" data-tooltip="${escapeHtml(COLUMN_TOOLTIPS.resolved_oss)}">% Resolved OSS</th>
                            <th class="sortable" data-sort="org">Org</th>
                            <th class="sortable has-col-tooltip" data-sort="cost" data-tooltip="${escapeHtml(COLUMN_TOOLTIPS.cost)}">Avg. $</th>
                            <th class="sortable" data-sort="date">Date</th>
                            <th class="sortable" data-sort="notes">Notes</th>
                            <th>Logs/Trajs</th>
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
                                    data-release="${item.release || ''}"
                                >
                                    <td>
                                        <div class="flex items-center gap-1">
                                            <div class="model-badges">
                                                ${renderRowMarkers(item)}
                                            </div>
                                            <span class="model-name font-mono fw-medium">${item.name}</span>
                                        </div>
                                    </td>
                                    <td class="centered-text text-center">${renderResolvedCell(item.resolved_full, getLogsTrajsValue(item))}</td>
                                    <td class="centered-text text-center">${renderResolvedCell(item.resolved_oss, getLogsTrajsValue(item))}</td>
                                    <td class="centered-text text-center">
                                        ${item.logo && item.logo.length > 0 ? `
                                            <div style="display: flex; align-items: center;">
                                                ${item.logo.map(logoUrl => `<img src="${logoUrl}" style="height: 1.5em;" />`).join('')}
                                            </div>
                                        ` : '-'}
                                    </td>
                                    <td class="centered-text text-center"><span class="number fw-medium text-primary">${cleanNum(item.cost)}</span></td>
                                    <td class="centered-text text-center"><span class="label-date text-muted">${item.date}</span></td>
                                    <td class="centered-text text-center">
                                        ${item.notes ? 
                                            `<a href="#" data-popup-text="${item.notes}" onclick="openPopup(this); return false;">📝</a>`
                                            : '<span class="text-muted">-</span>'}
                                    </td>
                                    <td class="centered-text text-center">
                                        ${getLogsTrajsValue(item)
                                            ? `<a href="${getLogsTrajsValue(item)}" target="_blank" rel="noopener noreferrer" title="Open logs/trajectories">🔗</a>`
                                            : '<span class="text-muted">-</span>'}
                                    </td>
                                    <td class="centered-text text-center">
                                        ${item.site ? `<a href="${item.site}" target="_blank" rel="noopener noreferrer"><i class="fas fa-external-link-alt"></i></a>` : '<span class="text-muted">-</span>'}
                                    </td>
                                    <td class="centered-text text-center">
                                        ${item.release ? `<span class="text-success">${item.release}</span>` : '<span class="text-muted">-</span>'}
                                    </td>                         
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
    hideColumnTooltip();
    const field = header.getAttribute('data-sort');
    
    if (sortState.field === field) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.field = field;
        sortState.direction = getDefaultSortDirection(field);
    }
    
    // DOM-based sorting - sort visible rows only
    const container = document.getElementById('leaderboard-container');
    const tableWrapper = container.querySelector(`#leaderboard-${leaderboardName}`);
    if (!tableWrapper) return;
    
    const tbody = tableWrapper.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr:not(.no-results)'));
    
    // Sort the visible rows
    rows.sort((a, b) => {
        const aValue = getSortValue(a, field);
        const bValue = getSortValue(b, field);
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        else if (aValue > bValue) comparison = 1;
        
        return sortState.direction === 'asc' ? comparison : -comparison;
    });
    
    // Re-append sorted rows to maintain order
    rows.forEach(row => tbody.appendChild(row));
    
    updateSortIndicators();
}

function getSortValue(row, field) {
    switch (field) {
        case 'name':
            return (row.getAttribute('data-name') || '').toLowerCase();
        case 'resolved_full':
            return parseFloat(row.querySelector('td:nth-child(2) .number').textContent) || 0;
        case 'resolved_oss':
            return parseFloat(row.querySelector('td:nth-child(3) .number').textContent) || 0;
        case 'cost':
            return parseFloat(row.querySelector('td:nth-child(5) .number').textContent) || 0;
        case 'date':
            return row.querySelector('td:nth-child(6) .label-date').textContent || '';
        case 'site':
            return row.querySelector('td:nth-child(9) a') ? 1 : 0;
        case 'release':
            return row.querySelector('td:nth-child(10) span').textContent || '';
        default:
            return '';
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

function getColumnTooltipEl() {
    let tooltipEl = document.getElementById('col-header-tooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'col-header-tooltip';
        tooltipEl.className = 'col-header-tooltip';
        tooltipEl.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
}

function hideColumnTooltip() {
    const tooltipEl = document.getElementById('col-header-tooltip');
    if (tooltipEl) {
        tooltipEl.classList.remove('visible');
    }
}

function showColumnTooltip(anchor, text) {
    const tooltipEl = getColumnTooltipEl();
    tooltipEl.textContent = text;
    tooltipEl.classList.add('visible');

    const rect = anchor.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    const pad = 8;
    let left = rect.left + rect.width / 2;
    const half = tipRect.width / 2;
    if (left - half < pad) {
        left = half + pad;
    }
    if (left + half > window.innerWidth - pad) {
        left = window.innerWidth - pad - half;
    }
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${rect.bottom + 8}px`;
}

function initColumnTooltips() {
    const container = document.getElementById('leaderboard-container');
    if (!container || container.dataset.tooltipBound === 'true') {
        return;
    }
    container.dataset.tooltipBound = 'true';

    container.addEventListener('mouseover', (event) => {
        const header = event.target.closest('th.has-col-tooltip');
        if (!header) {
            return;
        }
        const text = header.getAttribute('data-tooltip');
        if (text) {
            showColumnTooltip(header, text);
        }
    });

    container.addEventListener('mouseout', (event) => {
        const header = event.target.closest('th.has-col-tooltip');
        if (!header || header.contains(event.relatedTarget)) {
            return;
        }
        hideColumnTooltip();
    });

    container.addEventListener('scroll', hideColumnTooltip, true);
    window.addEventListener('scroll', hideColumnTooltip, true);
}

document.addEventListener('DOMContentLoaded', function() {
    renderMarkerLegend();
    initColumnTooltips();
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
