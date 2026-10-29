import { CONFIG } from './config.js';
import { DatabaseService } from './db.js';

// DOM Elements
const pinGate = document.getElementById('pinGate');
const dashboardContent = document.getElementById('dashboardContent');
const pinForm = document.getElementById('pinForm');
const adminPinInput = document.getElementById('adminPin');
const pinNotice = document.getElementById('pinNotice');
const logoutBtn = document.getElementById('logoutBtn');

const storageBadge = document.getElementById('storageBadge');
const statsSubtitle = document.getElementById('statsSubtitle');
const searchInput = document.getElementById('searchInput');
const userTableBody = document.getElementById('userTableBody');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

let allUsers = [];

// Check existing session
function checkAuth() {
  const isAuth = sessionStorage.getItem('aura_admin_auth') === 'true';
  if (isAuth) {
    pinGate.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    loadUsers();
  } else {
    pinGate.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    adminPinInput.focus();
  }
}

// PIN Form Submit
pinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  pinNotice.classList.add('hidden');

  const enteredPin = adminPinInput.value;
  const correctPin = CONFIG.ADMIN_PIN || 'admin123';

  if (enteredPin === correctPin) {
    sessionStorage.setItem('aura_admin_auth', 'true');
    adminPinInput.value = '';
    checkAuth();
  } else {
    pinNotice.className = 'notice error';
    pinNotice.textContent = 'Invalid administrator passkey.';
    pinNotice.classList.remove('hidden');
    adminPinInput.select();
  }
});

// Logout / Lock
logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('aura_admin_auth');
  checkAuth();
});

// Load Users from Database
async function loadUsers() {
  try {
    storageBadge.textContent = CONFIG.DATABASE_PROVIDER === 'supabase' ? 'Supabase Cloud' : 'IndexedDB Local';
    allUsers = await DatabaseService.getUsers();
    renderTable(allUsers);
  } catch (err) {
    console.error('Error loading users:', err);
    userTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Error loading records from database.</td></tr>`;
  }
}

// Render Table with optional filtered list
function renderTable(users) {
  statsSubtitle.textContent = `${users.length} ${users.length === 1 ? 'user registered' : 'users registered'}`;

  if (users.length === 0) {
    userTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">No records found.</td>
      </tr>
    `;
    return;
  }

  userTableBody.innerHTML = users.map(u => {
    const dateFormatted = u.created_at ? new Date(u.created_at).toLocaleString() : '—';
    return `
      <tr>
        <td><strong>#${u.id}</strong></td>
        <td>${escapeHtml(u.name)}</td>
        <td><a href="mailto:${escapeHtml(u.email)}" class="email-link">${escapeHtml(u.email)}</a></td>
        <td class="time-col">${dateFormatted}</td>
        <td class="action-col">
          <button type="button" class="del-btn" data-id="${u.id}" title="Delete record">&times;</button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach delete handlers
  userTableBody.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      if (confirm(`Delete user #${id}?`)) {
        await DatabaseService.deleteUser(id);
        await loadUsers();
      }
    });
  });
}

// Live Search / Filter
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    renderTable(allUsers);
    return;
  }

  const filtered = allUsers.filter(u => 
    (u.name && u.name.toLowerCase().includes(query)) ||
    (u.email && u.email.toLowerCase().includes(query)) ||
    String(u.id).includes(query)
  );

  renderTable(filtered);
});

// Export to CSV
exportCsvBtn.addEventListener('click', () => {
  if (allUsers.length === 0) return alert('No records to export.');

  const headers = ['ID', 'Name', 'Email', 'Signed Up'];
  const rows = allUsers.map(u => [
    u.id,
    `"${(u.name || '').replace(/"/g, '""')}"`,
    `"${(u.email || '').replace(/"/g, '""')}"`,
    `"${u.created_at || ''}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadFile(csvContent, `signups-export-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
});

// Export to JSON
exportJsonBtn.addEventListener('click', () => {
  if (allUsers.length === 0) return alert('No records to export.');
  const jsonContent = JSON.stringify(allUsers, null, 2);
  downloadFile(jsonContent, `signups-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
});

// Clear All Records
clearAllBtn.addEventListener('click', async () => {
  if (confirm('WARNING: Are you sure you want to permanently delete ALL registered users?')) {
    await DatabaseService.clearAll();
    await loadUsers();
  }
});

// Helper: Download file
function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper: Escape HTML
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// Initialize on page load
checkAuth();
