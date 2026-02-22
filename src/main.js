import '../style.css'
import { db } from './db'
import Chart from 'chart.js/auto'

const icons = {
  'Media': '⚡',
  'Usługi': '🛠️',
  'Raty': '🏠',
  'Rozrywka': '🍿',
  'Inne': '📦'
};

function getCategoryIcon(cat) {
  return icons[cat] || '📦';
}

// Stan aplikacji
let state = {
  activeTab: 'dashboard', // dashboard, calendar, stats, settings
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  templates: [],
  payments: [],
  allPayments: []
};

let statsChart = null;

async function initApp() {
  await refreshData();
  renderApp();
}

async function refreshData() {
  state.templates = await db.templates.toArray();
  state.payments = await db.payments.where('month').equals(state.currentMonth).toArray();
  state.allPayments = await db.payments.toArray();
}

function renderApp() {
  const app = document.querySelector('#app');
  let content = '';

  if (state.activeTab === 'dashboard') content = renderDashboard();
  else if (state.activeTab === 'calendar') content = renderCalendar();
  else if (state.activeTab === 'stats') content = renderStats();
  else if (state.activeTab === 'settings') content = renderSettings();

  app.innerHTML = `
    <header>
      <p>Witaj z powrotem 👋</p>
      <h1>Twoje <span class="text-gradient">Rachunki</span></h1>
    </header>

    <div id="main-content">
      ${content}
    </div>

    <nav class="bottom-nav">
      <div class="nav-item ${state.activeTab === 'dashboard' ? 'active' : ''}" onclick="window.setTab('dashboard')">
        <span class="nav-icon">📊</span>
        <span>Główna</span>
      </div>
      <div class="nav-item ${state.activeTab === 'calendar' ? 'active' : ''}" onclick="window.setTab('calendar')">
        <span class="nav-icon">📅</span>
        <span>Kalendarz</span>
      </div>
      <div class="nav-item ${state.activeTab === 'stats' ? 'active' : ''}" onclick="window.setTab('stats')">
        <span class="nav-icon">📈</span>
        <span>Staty</span>
      </div>
      <div class="nav-item ${state.activeTab === 'settings' ? 'active' : ''}" onclick="window.setTab('settings')">
        <span class="nav-icon">⚙️</span>
        <span>Ustawienia</span>
      </div>
    </nav>
  `;

  if (state.activeTab === 'stats') {
    initStatsCharts();
  }
}

function renderStats() {
  const yearlyTotal = state.allPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

  // Current month vs previous
  const currentTotal = state.allPayments
    .filter(p => p.month === state.currentMonth && p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const [y, m] = state.currentMonth.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevISO = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;

  const prevTotal = state.allPayments
    .filter(p => p.month === prevISO && p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const diff = currentTotal - prevTotal;
  const diffPercent = prevTotal > 0 ? (diff / prevTotal * 100).toFixed(1) : 0;

  return `
    <div class="glass card">
      <h3>Wydatki w tym miesiącu</h3>
      <div style="font-size: 2rem; font-weight: 700; margin: 0.5rem 0;">${currentTotal.toFixed(2)} zł</div>
      <div style="font-size: 0.9rem; color: ${diff > 0 ? 'var(--danger-color)' : 'var(--success-color)'};">
        ${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(2)} zł (${diffPercent}%) vs poprz. msc
      </div>
    </div>

    <div class="glass card">
      <h3>Podział wydatków</h3>
      <div class="chart-container" style="position: relative; height: 250px; margin: 1rem 0;">
        <canvas id="statsChart"></canvas>
      </div>
    </div>

    <div class="glass card">
      <h2>Suma (Wszystkie lata)</h2>
      <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-color);">${yearlyTotal.toFixed(2)} zł</div>
    </div>

    <div class="glass card">
      <h3>Kategorie (Narastająco)</h3>
      <div id="category-stats-list" style="margin-top: 1rem;"></div>
    </div>
  `;
}

function initStatsCharts() {
  const ctx = document.getElementById('statsChart');
  if (!ctx) return;

  // Group by category
  const categories = {};
  state.allPayments.filter(p => p.status === 'paid').forEach(p => {
    const tpl = state.templates.find(t => t.id === p.templateId);
    const cat = tpl ? tpl.category : 'Inne';
    categories[cat] = (categories[cat] || 0) + p.amount;
  });

  const labels = Object.keys(categories);
  const data = Object.values(categories);

  if (statsChart) statsChart.destroy();

  statsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#38bdf8', '#818cf8', '#fbbf24', '#4ade80', '#f87171', '#a78bfa'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { size: 10 } }
        }
      }
    }
  });

  // Render text list
  const listContainer = document.getElementById('category-stats-list');
  listContainer.innerHTML = Object.entries(categories).map(([cat, val]) => `
    <div class="yearly-row">
      <span>${getCategoryIcon(cat)} ${cat}</span>
      <strong>${val.toFixed(2)} zł</strong>
    </div>
  `).join('');
}

function formatMonth(isoMonth) {
  const [year, month] = isoMonth.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleString('pl-PL', { month: 'long', year: 'numeric' });
}

function renderDashboard() {
  let paid = 0;
  let pending = 0;

  const activeTemplates = state.templates.filter(tpl => isTemplateActive(tpl, state.currentMonth));

  activeTemplates.forEach(tpl => {
    const payment = state.payments.find(p => p.templateId === tpl.id);
    if (payment && payment.status === 'paid') {
      paid += payment.amount;
    } else {
      pending += payment ? payment.amount : tpl.defaultAmount;
    }
  });

  const total = paid + pending;
  const progress = total > 0 ? (paid / total * 100) : 0;

  return `
    ${renderReminders(activeTemplates)}

    <div class="stats-grid">
      <div class="glass stat-box paid-card">
        <span class="nav-icon">✅</span>
        <span class="stat-value">${paid.toFixed(2)} zł</span>
        <span class="stat-label">Zapłacone</span>
        <div class="stat-progress">
          <div class="stat-progress-bar" style="width: ${progress}%; background: var(--success-color);"></div>
        </div>
      </div>
      <div class="glass stat-box pending-card">
        <span class="nav-icon">⏳</span>
        <span class="stat-value">${pending.toFixed(2)} zł</span>
        <span class="stat-label">Do zapłaty</span>
        <div class="stat-progress">
          <div class="stat-progress-bar" style="width: ${100 - progress}%; background: var(--warning-color);"></div>
        </div>
      </div>
    </div>

    <div class="glass card">
      <h2>Lista opłat (${formatMonth(state.currentMonth)})</h2>
      <div id="upcoming-list" style="margin-top: 1rem;">
        ${activeTemplates.length === 0 ?
      '<p style="color: var(--text-secondary); text-align:center;">Brak płatności w tym miesiącu.</p>' :
      renderBillList(activeTemplates)
    }
      </div>
    </div>
  `;
}

function renderReminders(templates) {
  const now = new Date();
  const todayD = now.getDate();
  const todayM = now.toISOString().slice(0, 7);

  if (state.currentMonth !== todayM) return '';

  const dueToday = templates.filter(tpl => {
    if (tpl.day !== todayD) return false;
    const p = state.payments.find(pmt => pmt.templateId === tpl.id);
    return !p || p.status !== 'paid';
  });

  if (dueToday.length === 0) return '';

  return `
    <div class="reminder-banner glass">
      <span class="reminder-icon">🔔</span>
      <div class="reminder-text">
        <strong>Pamiętaj!</strong> Masz ${dueToday.length} płatności na dzisiaj.
      </div>
    </div>
  `;
}

function renderBillList(activeTemplates) {
  return activeTemplates.map(tpl => {
    const payment = state.payments.find(p => p.templateId === tpl.id);
    const status = payment ? payment.status : 'pending';
    const amount = payment ? payment.amount : tpl.defaultAmount;

    return `
      <div class="bill-row ${status}">
        <div class="bill-info" onclick="window.togglePayment(${tpl.id})">
          <div class="bill-name">${getCategoryIcon(tpl.category)} ${tpl.name}</div>
          <div class="bill-meta">${tpl.category} • Dzień: ${tpl.day}</div>
        </div>
        <div class="bill-value" onclick="window.editPayment(${tpl.id})">
          <div class="amount">${amount.toFixed(2)} zł</div>
          <div class="status-tag">${status === 'paid' ? 'Zapłacone' : 'Czekam'}</div>
        </div>
      </div>
    `;
  }).join('');
}

window.editPayment = async (tplId) => {
  const tpl = state.templates.find(t => t.id === tplId);
  const payment = state.payments.find(p => p.templateId === tplId);
  const currentAmount = payment ? payment.amount : tpl.defaultAmount;

  const newAmount = prompt(`Nowa kwota dla ${tpl.name}:`, currentAmount);
  if (newAmount !== null) {
    const val = parseFloat(newAmount.replace(',', '.'));
    if (!isNaN(val)) {
      if (payment) {
        await db.payments.update(payment.id, { amount: val });
      } else {
        await db.payments.add({
          templateId: tplId,
          month: state.currentMonth,
          status: 'pending',
          amount: val
        });
      }
      await refreshData();
      renderApp();
    }
  }
};

function renderCalendar() {
  const [year, month] = state.currentMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  // Adjusted for Monday start (ISO)
  const startOffset = (firstDay === 0 ? 6 : firstDay - 1);

  return `
    <div class="calendar-header">
      <button onclick="window.shiftCal(-1)">←</button>
      <h2>${formatMonth(state.currentMonth)}</h2>
      <button onclick="window.shiftCal(1)">→</button>
    </div>

    <div class="glass card calendar-card">
      <div class="calendar-weekdays">
        <span>Pn</span><span>Wt</span><span>Śr</span><span>Czw</span><span>Pt</span><span>Sob</span><span>Ndz</span>
      </div>
      <div class="calendar-grid">
        ${renderCalendarGrid(year, month, daysInMonth, startOffset, daysInPrevMonth)}
      </div>
    </div>

    <div id="day-details" class="day-details-container">
      <!-- Details of selected day -->
    </div>
  `;
}

function renderCalendarGrid(year, month, daysInMonth, offset, prevDays) {
  let cells = [];

  // Prev month days
  for (let i = offset - 1; i >= 0; i--) {
    cells.push(`<div class="calendar-day other-month">${prevDays - i}</div>`);
  }

  // Current month days
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth() + 1;
  const todayD = now.getDate();

  const activeTemplates = state.templates.filter(tpl => isTemplateActive(tpl, state.currentMonth));

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = (year === todayY && month === todayM && d === todayD);
    const dayBills = activeTemplates.filter(tpl => tpl.day === d);
    const hasBills = dayBills.length > 0;

    const allPaid = hasBills && dayBills.every(tpl => {
      const p = state.payments.find(pmt => pmt.templateId === tpl.id);
      return p && p.status === 'paid';
    });

    let indicatorClass = '';
    if (hasBills) {
      indicatorClass = allPaid ? 'has-bills-paid' : 'has-bills-pending';
    }

    cells.push(`
      <div class="calendar-day curr-month ${indicatorClass} ${isToday ? 'today' : ''}" onclick="window.showDay(${d})">
        ${d}
        ${hasBills ? '<span class="dot"></span>' : ''}
      </div>
    `);
  }

  return cells.join('');
}

window.shiftCal = async (delta) => {
  const [year, month] = state.currentMonth.split('-').map(Number);
  const newDate = new Date(year, month - 1 + delta, 1);
  const y = newDate.getFullYear();
  const m = (newDate.getMonth() + 1).toString().padStart(2, '0');
  state.currentMonth = `${y}-${m}`;
  await refreshData();
  renderApp();
};

window.showDay = (day) => {
  const activeTemplates = state.templates.filter(tpl => isTemplateActive(tpl, state.currentMonth));
  const dayBills = activeTemplates.filter(tpl => tpl.day === day);
  const container = document.getElementById('day-details');

  if (dayBills.length === 0) {
    container.innerHTML = '';
    return;
  }

  const list = dayBills.map(tpl => {
    const p = state.payments.find(pmt => pmt.templateId === tpl.id);
    const status = p ? p.status : 'pending';
    return `
      <div class="bill-row ${status}" onclick="window.togglePayment(${tpl.id})">
         <div>${getCategoryIcon(tpl.category)} ${tpl.name}</div>
         <div class="status-tag">${status === 'paid' ? 'Zapłacone' : 'Czekam'}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="glass card" style="margin-top: 1rem;">
      <h3>Płatności dnia ${day}</h3>
      <div style="margin-top: 1rem;">${list}</div>
    </div>
  `;
};

function renderSettings() {
  return `
    <div class="glass card">
      <h2>Dodaj nowy rachunek</h2>
      <form id="template-form" onsubmit="event.preventDefault(); window.addTemplate();" style="margin-top: 1rem;">
        <div class="form-group">
          <label>Nazwa rachunku</label>
          <input type="text" id="tpl-name" placeholder="np. Prąd, Netflix" required>
        </div>
        <div class="form-group">
          <label>Kwota domyślna (zł)</label>
          <input type="number" id="tpl-amount" step="0.01" placeholder="0.00" required>
        </div>
        <div class="form-group">
          <label>Dzień płatności (1-31)</label>
          <input type="number" id="tpl-day" min="1" max="31" value="1" required>
        </div>
        <div class="form-group">
          <label>Kategoria</label>
          <select id="tpl-category" onchange="window.onCategoryChange(this.value)">
            <option>Media</option>
            <option>Usługi</option>
            <option>Raty</option>
            <option>Rozrywka</option>
            <option value="custom">Inna...</option>
          </select>
        </div>
        <div class="form-group">
          <label>Cykl płatności</label>
          <select id="tpl-cycle">
            <option value="monthly">Miesięczny</option>
            <option value="quarterly">Kwartalny</option>
            <option value="yearly">Roczny</option>
          </select>
        </div>
        <div id="tpl-custom-category-group" style="display: none;">
          <div class="form-group">
            <input type="text" id="tpl-custom-category" placeholder="Wpisz własną kategorię">
          </div>
        </div>
        <button type="submit" class="btn-primary" style="margin-top: 1rem;">Dodaj do katalogu</button>
      </form>
    </div>

    <div class="glass card">
      <h2>Twoje szablony</h2>
      <div id="templates-list" style="margin-top: 1rem;">
        ${state.templates.map(tpl => `
          <div class="template-row">
            <span>${getCategoryIcon(tpl.category)} ${tpl.name} (${tpl.defaultAmount} zł) - ${tpl.cycle === 'monthly' ? 'Msc' : (tpl.cycle === 'quarterly' ? 'Kwart' : 'Rok')}</span>
            <button class="btn-del" onclick="window.delTemplate(${tpl.id})">✕</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Helper to check if template is active in given month
function isTemplateActive(tpl, monthISO) {
  if (tpl.cycle === 'monthly') return true;

  const [targetY, targetM] = monthISO.split('-').map(Number);
  const [startY, startM] = tpl.startMonth.split('-').map(Number);

  const diffMonths = (targetY - startY) * 12 + (targetM - startM);

  if (tpl.cycle === 'quarterly') return diffMonths % 3 === 0 && diffMonths >= 0;
  if (tpl.cycle === 'yearly') return diffMonths % 12 === 0 && diffMonths >= 0;

  return false;
}

// Globalne API
window.onCategoryChange = (val) => {
  const customGroup = document.getElementById('tpl-custom-category-group');
  customGroup.style.display = (val === 'custom') ? 'block' : 'none';
};

window.setTab = (tab) => {
  state.activeTab = tab;
  renderApp();
};

window.addTemplate = async () => {
  const name = document.getElementById('tpl-name').value;
  const amount = parseFloat(document.getElementById('tpl-amount').value);
  const day = parseInt(document.getElementById('tpl-day').value);
  const cycle = document.getElementById('tpl-cycle').value;
  let category = document.getElementById('tpl-category').value;

  if (category === 'custom') {
    category = document.getElementById('tpl-custom-category').value || 'Inne';
  }

  if (name && !isNaN(amount)) {
    await db.templates.add({
      name,
      defaultAmount: amount,
      day,
      category,
      cycle,
      startMonth: state.currentMonth
    });
    await refreshData();
    renderApp();
  }
};

window.delTemplate = async (id) => {
  if (confirm('Usunąć ten szablon?')) {
    await db.templates.delete(id);
    await refreshData();
    renderApp();
  }
};

window.togglePayment = async (tplId) => {
  const tpl = state.templates.find(t => t.id === tplId);
  const existing = state.payments.find(p => p.templateId === tplId);

  if (existing) {
    const newStatus = existing.status === 'paid' ? 'pending' : 'paid';
    await db.payments.update(existing.id, { status: newStatus });
  } else {
    await db.payments.add({
      templateId: tplId,
      month: state.currentMonth,
      status: 'paid',
      amount: tpl.defaultAmount
    });
  }
  await refreshData();
  renderApp();
};

initApp();
