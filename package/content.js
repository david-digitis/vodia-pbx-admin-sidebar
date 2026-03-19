/* =============================================
   Vodia PBX Admin Sidebar — Content Script
   Version: 1.0.0
   Injects a sidebar widget in Vodia PBX admin interface
   showing account overview per tenant.

   Detection: pathname starts with /tenant/ and DNS is read
   from the header area next to "Leave Tenant" button.
   ============================================= */
(function () {
  'use strict';

  // IMPORTANT: Vodia API uses internal type names, not display names.
  var ACCOUNT_TYPES = [
    { key: 'extensions', label: 'Extensions' },
    { key: 'aas', label: 'Auto Attendants' },
    { key: 'confrooms', label: 'Conference Rooms' },
    { key: 'hunts', label: 'Ring Groups' },
    { key: 'acds', label: 'Call Queues' },
    { key: 'parkorbits', label: 'Park Orbits' },
    { key: 'callingcards', label: 'Calling Cards' },
    { key: 'paginggroups', label: 'Paging Groups' },
    { key: 'srvflags', label: 'Service Flags' },
    { key: 'ivrnodes', label: 'IVR Nodes' }
  ];

  // === STATE ===
  var sidebarInjected = false;
  var currentDomain = null;
  var isCollapsed = true;

  // === DETECTION ===
  function detectVodiaTenant() {
    if (window.location.pathname.indexOf('/tenant/') !== 0) return null;
    var dnsEl = document.querySelector('h3.whitespace-nowrap + div.text-right');
    if (dnsEl) {
      var dns = dnsEl.textContent.trim();
      if (dns && dns.indexOf('.') !== -1) return dns;
    }
    var titleMatch = document.title.match(/\(([^)]+)\)/);
    if (titleMatch) return titleMatch[1];
    return null;
  }

  // === SIDEBAR CREATION ===
  function createSidebar() {
    if (document.getElementById('vodia-sidebar')) return;

    var sidebar = document.createElement('div');
    sidebar.id = 'vodia-sidebar';
    sidebar.className = 'vodia-sidebar collapsed';

    var toggleBtn = document.createElement('button');
    toggleBtn.id = 'vodia-sidebar-toggle';
    toggleBtn.className = 'vodia-sidebar-toggle';
    toggleBtn.title = 'Vodia Admin Sidebar';
    toggleBtn.innerHTML = '<span class="vodia-sidebar-toggle-icon">&#9776;</span>';
    toggleBtn.addEventListener('click', function () {
      isCollapsed = !isCollapsed;
      sidebar.classList.toggle('collapsed', isCollapsed);
    });

    var container = document.createElement('div');
    container.id = 'vodia-sidebar-container';
    container.className = 'vodia-sidebar-container';

    var header = document.createElement('div');
    header.className = 'vodia-sidebar-header';
    header.innerHTML = '<span class="vodia-sidebar-title">Admin Sidebar</span>' +
      '<span id="vodia-sidebar-domain" class="vodia-sidebar-domain"></span>';

    container.appendChild(header);

    // Accounts panel (Vodia API data)
    container.appendChild(createAccountsPanel());

    sidebar.appendChild(toggleBtn);
    sidebar.appendChild(container);
    document.body.appendChild(sidebar);
    sidebarInjected = true;
  }

  function createAccountsPanel() {
    var panel = document.createElement('div');
    panel.className = 'vodia-sidebar-section';

    var headerBtn = document.createElement('button');
    headerBtn.className = 'vodia-sidebar-section-toggle';
    headerBtn.innerHTML = '<span class="vodia-sidebar-arrow">&#9660;</span> Accounts <span id="vodia-sidebar-total" class="vodia-sidebar-count"></span>';
    var accCollapsed = false;

    var content = document.createElement('div');
    content.id = 'vodia-sidebar-accounts';
    content.className = 'vodia-sidebar-section-content';
    content.innerHTML = '<div class="vodia-sidebar-placeholder">Navigate to a tenant to load accounts.</div>';

    headerBtn.addEventListener('click', function () {
      accCollapsed = !accCollapsed;
      content.style.display = accCollapsed ? 'none' : 'block';
      headerBtn.querySelector('.vodia-sidebar-arrow').innerHTML = accCollapsed ? '&#9654;' : '&#9660;';
    });

    panel.appendChild(headerBtn);
    panel.appendChild(content);
    return panel;
  }

  // === DATA LOADING ===
  function loadAccounts(domain) {
    var container = document.getElementById('vodia-sidebar-accounts');
    var totalEl = document.getElementById('vodia-sidebar-total');
    var domainEl = document.getElementById('vodia-sidebar-domain');
    if (!container) return;

    domainEl.textContent = domain;
    container.innerHTML = '<div class="vodia-sidebar-loading">Loading...</div>';

    var total = 0;
    var results = {};
    var completed = 0;

    ACCOUNT_TYPES.forEach(function (typeInfo) {
      var url = '/rest/domain/' + encodeURIComponent(domain) + '/userlist/' + typeInfo.key;
      fetch(url, { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          results[typeInfo.key] = data.accounts || [];
          total += results[typeInfo.key].length;
        })
        .catch(function () {
          results[typeInfo.key] = [];
        })
        .finally(function () {
          completed++;
          if (completed === ACCOUNT_TYPES.length) {
            renderAccounts(container, results, total);
            if (totalEl) totalEl.textContent = '(' + total + ')';
          }
        });
    });
  }

  function renderAccounts(container, results, total) {
    container.innerHTML = '';
    if (total === 0) {
      container.innerHTML = '<div class="vodia-sidebar-placeholder">No accounts found.</div>';
      return;
    }
    for (var t = 0; t < ACCOUNT_TYPES.length; t++) {
      var typeInfo = ACCOUNT_TYPES[t];
      var accounts = results[typeInfo.key] || [];
      if (accounts.length === 0) continue;
      accounts.sort(function (a, b) { return (parseInt(a.account) || 0) - (parseInt(b.account) || 0); });
      var typeHeader = document.createElement('div');
      typeHeader.className = 'vodia-sidebar-type-header';
      typeHeader.textContent = typeInfo.label + ' (' + accounts.length + ')';
      container.appendChild(typeHeader);
      var table = document.createElement('table');
      table.className = 'vodia-sidebar-table';
      for (var i = 0; i < accounts.length; i++) {
        var a = accounts[i];
        var row = document.createElement('tr');
        var tdNum = document.createElement('td');
        tdNum.className = 'vodia-acc-num';
        tdNum.textContent = a.account || '';
        var tdName = document.createElement('td');
        tdName.className = 'vodia-acc-name';
        var nameText = a.name || a.display || '';
        if (typeInfo.key === 'srvflags' && a.state !== undefined) {
          var stateSpan = document.createElement('span');
          stateSpan.className = a.state === 'true' ? 'vodia-state-on' : 'vodia-state-off';
          stateSpan.textContent = a.state === 'true' ? 'ON' : 'OFF';
          tdName.textContent = nameText + ' ';
          tdName.appendChild(stateSpan);
        } else {
          tdName.textContent = nameText;
        }
        row.appendChild(tdNum);
        row.appendChild(tdName);
        table.appendChild(row);
      }
      container.appendChild(table);
    }
  }

  // === REFRESH BUTTON ===
  function addRefreshToHeader() {
    var header = document.querySelector('.vodia-sidebar-header');
    if (!header || document.getElementById('vodia-sidebar-refresh')) return;
    var btn = document.createElement('button');
    btn.id = 'vodia-sidebar-refresh';
    btn.className = 'vodia-sidebar-refresh';
    btn.title = 'Refresh accounts';
    btn.innerHTML = '&#8635;';
    btn.addEventListener('click', function () {
      if (currentDomain) loadAccounts(currentDomain);
    });
    header.appendChild(btn);
  }

  // === MAIN ===
  function checkAndUpdate() {
    var domain = detectVodiaTenant();

    if (!sidebarInjected && domain !== null) {
      createSidebar();
      addRefreshToHeader();
    }

    if (domain && domain !== currentDomain) {
      currentDomain = domain;
      loadAccounts(domain);
    }

    var sidebar = document.getElementById('vodia-sidebar');
    if (sidebar) {
      sidebar.style.display = domain ? '' : 'none';
    }
  }

  checkAndUpdate();
  setTimeout(checkAndUpdate, 1000);
  setTimeout(checkAndUpdate, 3000);

})();
