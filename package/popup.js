/* Vodia PBX Admin Sidebar — Popup (tabs + 3-column grid + drag-and-drop + export/import)
   Version: 1.0.0 */
(function () {
  'use strict';

  // DOM refs
  var tabBar = document.getElementById('tab-bar');
  var gridContainer = document.getElementById('grid-container');
  var statusBar = document.getElementById('status-bar');

  var currentData = null; // { version, tabs[] }
  var activeTabIdx = 0;
  var dirty = false;

  // =========================================
  // DATA MIGRATION (v1.0 → v2.0)
  // =========================================

  function migrateData(data) {
    if (!data) return { version: '2.0', tabs: [] };
    if (data.tabs) return data;
    var sections = data.sections || [];
    return {
      version: '2.0',
      tabs: [{ id: 'vodia', title: 'Vodia', sections: sections }]
    };
  }

  // =========================================
  // STORAGE
  // =========================================

  function loadLocal(cb) {
    chrome.storage.local.get(['vodiaNotesData'], function (r) {
      cb(r.vodiaNotesData || null);
    });
  }

  function saveLocal(data, cb) {
    chrome.storage.local.set({ vodiaNotesData: data }, cb || function () {});
  }

  // =========================================
  // TAB BAR
  // =========================================

  function renderTabs() {
    tabBar.innerHTML = '';
    if (!currentData || !currentData.tabs) return;

    currentData.tabs.forEach(function (tab, idx) {
      var el = document.createElement('div');
      el.className = 'tab-item' + (idx === activeTabIdx ? ' active' : '');

      var label = document.createElement('span');
      label.textContent = tab.title;
      label.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        var newTitle = prompt('Rename tab:', tab.title);
        if (newTitle && newTitle.trim()) {
          tab.title = newTitle.trim();
          tab.id = newTitle.trim().toLowerCase().replace(/\s+/g, '-');
          markDirty();
          renderTabs();
        }
      });
      el.appendChild(label);

      if (currentData.tabs.length > 1) {
        var closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!confirm('Delete tab "' + tab.title + '"?')) return;
          currentData.tabs.splice(idx, 1);
          if (activeTabIdx >= currentData.tabs.length) activeTabIdx = currentData.tabs.length - 1;
          markDirty();
          renderTabs();
          renderSections();
        });
        el.appendChild(closeBtn);
      }

      el.addEventListener('click', function () {
        activeTabIdx = idx;
        renderTabs();
        renderSections();
      });

      tabBar.appendChild(el);
    });

    var addBtn = document.createElement('button');
    addBtn.className = 'tab-add';
    addBtn.textContent = '+';
    addBtn.title = 'New tab';
    addBtn.addEventListener('click', function () {
      var title = prompt('New tab name:');
      if (!title || !title.trim()) return;
      currentData.tabs.push({
        id: title.trim().toLowerCase().replace(/\s+/g, '-'),
        title: title.trim(),
        sections: []
      });
      activeTabIdx = currentData.tabs.length - 1;
      markDirty();
      renderTabs();
      renderSections();
    });
    tabBar.appendChild(addBtn);
  }

  // =========================================
  // RENDERING — 3-column grid with cards
  // =========================================

  function getActiveTab() {
    if (!currentData || !currentData.tabs || !currentData.tabs.length) return null;
    if (activeTabIdx >= currentData.tabs.length) activeTabIdx = 0;
    return currentData.tabs[activeTabIdx];
  }

  function renderSections() {
    gridContainer.innerHTML = '';
    var tab = getActiveTab();
    if (!tab || !tab.sections) return;
    tab.sections.forEach(function (section, idx) {
      gridContainer.appendChild(renderCard(section, idx));
    });
  }

  function renderAll(data) {
    currentData = migrateData(data);
    renderTabs();
    renderSections();
  }

  function renderCard(section, idx) {
    var card = document.createElement('div');
    card.className = 'section-card';
    card.dataset.idx = idx;
    card.setAttribute('draggable', 'true');

    var header = document.createElement('div');
    header.className = 'section-card-header';

    var title = document.createElement('span');
    title.className = 'section-card-title';
    title.textContent = section.title;

    var typeBadge = document.createElement('span');
    typeBadge.className = 'section-card-type';
    typeBadge.textContent = section.type;

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-del-section';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Delete section';
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!confirm('Delete "' + section.title + '"?')) return;
      var tab = getActiveTab();
      tab.sections.splice(idx, 1);
      markDirty();
      renderSections();
    });

    header.appendChild(title);
    header.appendChild(typeBadge);
    header.appendChild(delBtn);

    var body = document.createElement('div');
    body.className = 'section-card-body';

    if (section.type === 'table') {
      renderTableBody(body, section, idx);
    } else {
      renderNotesBody(body, section, idx);
    }

    card.appendChild(header);
    card.appendChild(body);

    setupDragEvents(card, idx);

    return card;
  }

  function renderTableBody(body, section, sIdx) {
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    var cols = section.columns || ['label', 'range'];
    cols.forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col;
      headRow.appendChild(th);
    });
    var thDel = document.createElement('th');
    thDel.style.width = '20px';
    headRow.appendChild(thDel);
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    (section.rows || []).forEach(function (row, rIdx) {
      tbody.appendChild(createTableRow(section, sIdx, row, rIdx));
    });
    table.appendChild(tbody);
    body.appendChild(table);

    var addBtn = document.createElement('button');
    addBtn.className = 'btn-add-row';
    addBtn.textContent = '+ Row';
    addBtn.addEventListener('click', function () {
      var newRow = {};
      cols.forEach(function (c) { newRow[c] = ''; });
      section.rows.push(newRow);
      tbody.appendChild(createTableRow(section, sIdx, newRow, section.rows.length - 1));
      markDirty();
    });
    body.appendChild(addBtn);
  }

  function createTableRow(section, sIdx, row, rIdx) {
    var tr = document.createElement('tr');
    var cols = section.columns || ['label', 'range'];
    cols.forEach(function (col) {
      var td = document.createElement('td');
      var input = document.createElement('input');
      input.type = 'text';
      input.value = row[col] || '';
      if (col === 'range') input.className = 'range-input';
      input.addEventListener('change', function () {
        row[col] = input.value.trim();
        markDirty();
      });
      td.appendChild(input);
      tr.appendChild(td);
    });
    var tdDel = document.createElement('td');
    var delBtn = document.createElement('button');
    delBtn.className = 'btn-del-row';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', function () {
      section.rows.splice(rIdx, 1);
      markDirty();
      renderSections();
    });
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);
    return tr;
  }

  function renderNotesBody(body, section) {
    var textarea = document.createElement('textarea');
    textarea.value = section.content || '';
    textarea.addEventListener('input', function () {
      section.content = textarea.value;
      markDirty();
    });
    body.appendChild(textarea);
  }

  // =========================================
  // DRAG AND DROP
  // =========================================

  var dragSrcIdx = null;

  function setupDragEvents(card, idx) {
    card.addEventListener('dragstart', function (e) {
      dragSrcIdx = idx;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', idx);
    });

    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      clearDragOverStyles();
    });

    card.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', function () {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', function (e) {
      e.preventDefault();
      card.classList.remove('drag-over');
      var fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      var toIdx = idx;
      if (fromIdx === toIdx || isNaN(fromIdx)) return;

      var tab = getActiveTab();
      var moved = tab.sections.splice(fromIdx, 1)[0];
      tab.sections.splice(toIdx, 0, moved);
      markDirty();
      renderSections();
    });
  }

  function clearDragOverStyles() {
    var cards = gridContainer.querySelectorAll('.section-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('drag-over');
    }
  }

  // =========================================
  // DIRTY STATE + AUTO-SAVE LOCAL
  // =========================================

  var localSaveTimeout = null;

  function markDirty() {
    dirty = true;
    updateSaveButton();
    clearTimeout(localSaveTimeout);
    localSaveTimeout = setTimeout(function () {
      saveLocal(currentData);
    }, 400);
  }

  function updateSaveButton() {
    var btn = document.getElementById('btn-save');
    if (btn) {
      btn.disabled = !dirty;
      btn.textContent = dirty ? '\uD83D\uDCBE Save *' : '\uD83D\uDCBE Save';
    }
  }

  // =========================================
  // UI HELPERS
  // =========================================

  function showStatus(msg, isError) {
    statusBar.textContent = msg;
    statusBar.style.color = isError ? '#f87171' : '#22c55e';
    statusBar.style.display = 'block';
    setTimeout(function () { statusBar.style.display = 'none'; }, 3000);
  }

  // =========================================
  // EXPORT / IMPORT
  // =========================================

  function exportData() {
    if (!currentData) return;
    var blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'vodia-notes-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Notes exported');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        var migrated = migrateData(data);
        currentData = migrated;
        saveLocal(migrated, function () {
          dirty = false;
          renderAll(currentData);
          updateSaveButton();
          showStatus('Notes imported successfully');
        });
      } catch (err) {
        showStatus('Invalid JSON file: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  }

  // =========================================
  // EVENT HANDLERS
  // =========================================

  // Save (local)
  document.getElementById('btn-save').addEventListener('click', function () {
    if (!currentData || !dirty) return;
    saveLocal(currentData, function () {
      dirty = false;
      updateSaveButton();
      showStatus('Notes saved');
    });
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', exportData);

  // Import
  var fileInput = document.getElementById('file-import');
  document.getElementById('btn-import').addEventListener('click', function () {
    fileInput.click();
  });
  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) {
      if (confirm('Import will replace your current notes. Continue?')) {
        importData(fileInput.files[0]);
      }
      fileInput.value = '';
    }
  });

  // Reset to default
  document.getElementById('btn-reset').addEventListener('click', function () {
    if (!confirm('Reset all notes to the default convention? This cannot be undone.')) return;
    loadDefaultFromJson()
      .then(function (jsonData) {
        var migrated = migrateData(jsonData);
        currentData = migrated;
        saveLocal(migrated, function () {
          dirty = false;
          renderAll(currentData);
          updateSaveButton();
          showStatus('Reset to default convention');
        });
      })
      .catch(function (err) {
        showStatus('Reset failed: ' + err.message, true);
      });
  });

  // Add section (to active tab)
  document.getElementById('btn-add-section').addEventListener('click', function () {
    var tab = getActiveTab();
    if (!tab) return;
    var title = prompt('Section title:');
    if (!title) return;
    var type = prompt('Type: table or notes?', 'notes');
    if (type !== 'table' && type !== 'notes') type = 'notes';

    var section = { id: title.toLowerCase().replace(/\s+/g, '-'), title: title, type: type };
    if (type === 'table') {
      section.columns = ['label', 'value'];
      section.rows = [];
    } else {
      section.content = '';
    }
    tab.sections.push(section);
    markDirty();
    renderSections();
  });

  // =========================================
  // INIT
  // =========================================

  function loadDefaultFromJson() {
    return fetch(chrome.runtime.getURL('convention.json'))
      .then(function (r) { return r.json(); });
  }

  function initApp() {
    loadLocal(function (localData) {
      if (localData) {
        var migrated = migrateData(localData);
        currentData = migrated;
        dirty = false;
        renderAll(currentData);
        updateSaveButton();
      } else {
        loadDefaultFromJson()
          .then(function (jsonData) {
            var migrated = migrateData(jsonData);
            currentData = migrated;
            saveLocal(migrated, function () {
              dirty = false;
              renderAll(currentData);
              updateSaveButton();
              showStatus('Default convention loaded');
            });
          })
          .catch(function () {
            currentData = { version: '2.0', tabs: [{ id: 'default', title: 'Notes', sections: [] }] };
            renderAll(currentData);
          });
      }
    });
  }

  initApp();

})();
