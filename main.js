import './style.css'
import billData from './src/data/bill_data.json'

// Stan aplikacji
let state = {
    currentMonth: '2026-02',
    view: 'monthly' // 'monthly' lub 'yearly'
};

const MONTH_NAMES = {
    '09': 'Wrzesień', '10': 'Październik', '11': 'Listopad', '12': 'Grudzień',
    '01': 'Styczeń', '02': 'Luty', '03': 'Marzec', '04': 'Kwiecień',
    '05': 'Maj', '06': 'Czerwiec', '07': 'Lipiec', '08': 'Sierpień'
};

function formatMonth(monthKey) {
    const [year, month] = monthKey.split('-');
    return `${MONTH_NAMES[month]} ${year}`;
}

function initApp() {
    document.querySelector('#app').innerHTML = `
    <header>
      <h1>Mój Budżet PWA</h1>
      <div class="nav-tabs">
        <button id="tab-monthly" class="active">Miesiąc</button>
        <button id="tab-yearly">Rok</button>
      </div>
    </header>
    
    <main id="main-content">
      <!-- Zawartość renderowana dynamicznie -->
    </main>

    <nav class="month-nav" id="month-selector-container">
      <button id="prev-month">←</button>
      <span id="current-month-display"></span>
      <button id="next-month">→</button>
    </nav>
  `;

    document.getElementById('tab-monthly').addEventListener('click', () => switchView('monthly'));
    document.getElementById('tab-yearly').addEventListener('click', () => switchView('yearly'));
    document.getElementById('prev-month').addEventListener('click', () => shiftMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => shiftMonth(1));

    render();
}

function switchView(view) {
    state.view = view;
    document.querySelectorAll('.nav-tabs button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${view}`).classList.add('active');

    const monthNav = document.getElementById('month-selector-container');
    if (view === 'yearly') monthNav.style.display = 'none';
    else monthNav.style.display = 'flex';

    render();
}

function shiftMonth(delta) {
    const allMonths = Object.keys(billData[0].history).sort();
    const currentIdx = allMonths.indexOf(state.currentMonth);
    const nextIdx = currentIdx + delta;

    if (nextIdx >= 0 && nextIdx < allMonths.length) {
        state.currentMonth = allMonths[nextIdx];
        render();
    }
}

function render() {
    const content = document.getElementById('main-content');
    if (state.view === 'monthly') {
        renderMonthlyView(content);
    } else {
        renderYearlyView(content);
    }
}

function renderMonthlyView(container) {
    const monthInfo = state.currentMonth;
    document.getElementById('current-month-display').innerText = formatMonth(monthInfo);

    let paidTotal = 0;
    let pendingTotal = 0;

    const billItems = billData.map(bill => {
        const history = bill.history[monthInfo];
        if (!history) return '';

        const amount = history.kwota || bill.defaultAmount;
        if (history.isPaid) paidTotal += history.przelana || amount;
        else pendingTotal += amount;

        return `
      <div class="bill-item ${history.isPaid ? 'paid' : 'pending'}">
        <div class="bill-info">
          <div class="category">${bill.category}</div>
          <div class="due-date">${history.termin || 'Brak terminu'}</div>
        </div>
        <div class="bill-amount">
          <div class="value">${amount.toFixed(2)} zł</div>
          <div class="status">${history.isPaid ? '✓ Zapłacone' : '⌛ Czekam'}</div>
        </div>
      </div>
    `;
    }).join('');

    container.innerHTML = `
    <div class="total-summary">
      <div class="summary-card summary-paid">
        <div class="label">Zapłacone</div>
        <div class="amount">${paidTotal.toFixed(2)} zł</div>
      </div>
      <div class="summary-card summary-pending">
        <div class="label">Do zapłaty</div>
        <div class="amount">${pendingTotal.toFixed(2)} zł</div>
      </div>
    </div>
    <div class="card">
      <div class="bill-list">${billItems}</div>
    </div>
  `;
}

function renderYearlyView(container) {
    const categories = billData.map(bill => {
        let yearlyPaid = 0;
        Object.values(bill.history).forEach(h => {
            if (h.isPaid) yearlyPaid += h.przelana || h.kwota;
        });

        return `
      <div class="yearly-row">
        <span>${bill.category}</span>
        <strong>${yearlyPaid.toFixed(2)} zł</strong>
      </div>
    `;
    }).join('');

    container.innerHTML = `
    <div class="card">
      <h3>Suma roczna wg kategorii</h3>
      <div class="yearly-list">${categories}</div>
    </div>
  `;
}

initApp();
