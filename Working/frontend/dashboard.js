// --- GLOBAL DATA ---
let transactions = [];
let budgets = { weekly: 0, monthly: 0, annual: 0 };
let highlightedTransactionId = null;

// --- DOM ELEMENTS ---
const tbody = document.getElementById('transactions-body');
const form = document.getElementById('transaction-form');
const budgetForm = document.getElementById('budget-form');
const budgetSummary = document.getElementById('budget-summary');

// --- FETCH DATA FROM BACKEND ---
function fetchUserData() {
    resetBudgetsIfNeeded();
    const email = sessionStorage.getItem('user_email');
    if (!email) return;

    // Fetch username from backend and show in sidebar
    fetch('http://localhost:5000/get-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
    .then(res => res.json())
    .then(data => {
        const profileName = document.getElementById('profile-name');
        if (profileName && data.success && data.username) {
            profileName.textContent = data.username;
        }
    });

    // Fetch transactions and budgets in parallel, then render charts
    Promise.all([
        fetch('http://localhost:5000/get-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        }).then(res => res.json()),
        fetch('http://localhost:5000/get-budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        }).then(res => res.json())
    ]).then(([transactionsData, budgetsData]) => {
        // Transactions
        transactions = transactionsData.success ? transactionsData.transactions.map(t => ({
            id: t.id,
            desc: t.description,
            amount: Number(t.amount),
            category: t.type,
            date: t.created_at
        })) : [];
        renderTransactions();

        // Budgets
        if (budgetsData.success && budgetsData.budgets && budgetsData.budgets.length > 0) {
            budgets = { weekly: 0, monthly: 0, annual: 0 };
            budgetsData.budgets.forEach(b => {
                if (b.name.toLowerCase().includes('week')) budgets.weekly = b.amount;
                if (b.name.toLowerCase().includes('month')) budgets.monthly = b.amount;
                if (b.name.toLowerCase().includes('annual')) budgets.annual = b.amount;
            });
        }
        renderBudgetsTable();

        // Now render all charts and reports
        renderMainAreaChart();
        renderBudgetsBarChart();
        renderCategoryPieChart();
        renderReportsTable();
    });
}

// --- RENDER TRANSACTIONS TABLE ---
function renderTransactions() {
    tbody.innerHTML = '';
    transactions.forEach((t, idx) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-tid', t.id); // <-- Add this line
        let formattedDate = t.date ? new Date(t.date).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        }) : '';
        if (t.isEditing) {
            // Use transaction id for input IDs
            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td><input type="text" value="${t.desc}" id="edit-desc-${t.id}" /></td>
                <td><input type="number" value="${t.amount}" id="edit-amount-${t.id}" /></td>
                <td>
                    <select id="edit-category-${t.id}">
                        <option value="Food" ${t.category === 'Food' ? 'selected' : ''}>Food</option>
                        <option value="Education" ${t.category === 'Education' ? 'selected' : ''}>Education</option>
                        <option value="Clothes" ${t.category === 'Clothes' ? 'selected' : ''}>Clothes</option>
                        <option value="Transport" ${t.category === 'Transport' ? 'selected' : ''}>Transport</option>
                        <option value="Entertainment" ${t.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
                        <option value="Health" ${t.category === 'Health' ? 'selected' : ''}>Health</option>
                        <option value="Property" ${t.category === 'Property' ? 'selected' : ''}>Property</option>
                        <option value="Others" ${t.category === 'Others' ? 'selected' : ''}>Others</option>
                    </select>
                </td>
                <td>
                    <button class="save-btn">Save</button>
                    <button class="cancel-btn">Cancel</button>
                </td>
            `;
            tr.querySelector('.save-btn').onclick = () => saveEditTransaction(t.id);
            tr.querySelector('.cancel-btn').onclick = () => cancelEditTransaction(idx);
        } else {
            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td>${t.desc}</td>
                <td>${Math.round(t.amount)}</td>
                <td>${t.category}</td>
                <td>
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </td>
            `;
            tr.querySelector('.edit-btn').onclick = () => startEditTransaction(idx);
            tr.querySelector('.delete-btn').onclick = () => deleteTransaction(t.id);
        }
        tbody.appendChild(tr);
    });
}

function startEditTransaction(idx) {
    transactions.forEach(t => delete t.isEditing); // Remove editing from others
    transactions[idx].isEditing = true;
    renderTransactions();
}

function cancelEditTransaction(idx) {
    delete transactions[idx].isEditing;
    renderTransactions();
}

function saveEditTransaction(transactionId) {
    // Find the transaction by id
    const idx = transactions.findIndex(t => t.id === transactionId);
    if (idx === -1) return;
    const t = transactions[idx];
    const email = sessionStorage.getItem('user_email');
    // Read values using transaction id
    const newDesc = document.getElementById(`edit-desc-${transactionId}`).value.trim();
    const newAmount = parseFloat(document.getElementById(`edit-amount-${transactionId}`).value);
    const newCategory = document.getElementById(`edit-category-${transactionId}`).value;
    if (!newDesc || isNaN(newAmount) || !newCategory || !email) {
        alert('Fill all fields and make sure you are logged in!');
        return;
    }
    fetch('http://localhost:5000/edit-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            transaction_id: t.id,
            description: newDesc,
            amount: newAmount,
            category: newCategory
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            fetchUserData();
        } else {
            alert(data.message || 'Failed to update transaction');
        }
    })
    .finally(() => {
        transactions.forEach(tx => delete tx.isEditing);
        renderTransactions();
    });
}

// --- DELETE TRANSACTION ---
function deleteTransaction(transactionId) {
    const email = sessionStorage.getItem('user_email');
    if (!email || !transactionId) return;
    fetch('http://localhost:5000/delete-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, transaction_id: transactionId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) fetchUserData();
        else alert(data.message || 'Failed to delete transaction');
    });
}

// --- RENDER BUDGETS TABLE ---
function renderBudgetsTable() {
    if (!budgetSummary) return;
    budgetSummary.innerHTML = `
        <tr><td>Weekly</td><td>₹${budgets.weekly ? Math.round(budgets.weekly) : 0}</td></tr>
        <tr><td>Monthly</td><td>₹${budgets.monthly ? Math.round(budgets.monthly) : 0}</td></tr>
        <tr><td>Annual</td><td>₹${budgets.annual ? Math.round(budgets.annual) : 0}</td></tr>
    `;
}

// --- RENDER REPORTS TABLE ---
function renderReportsTable() {
    const reportsTableBody = document.querySelector('.reports-table tbody');
    if (!reportsTableBody) return;
    const today = new Date();
    let weeklyTotal = 0, monthlyTotal = 0, annualTotal = 0;
    transactions.forEach(t => {
        const d = new Date(t.date);
        const weekAgo = new Date(today.getTime() - 7*24*60*60*1000);
        if (d >= weekAgo) weeklyTotal += Number(t.amount);
        if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) monthlyTotal += Number(t.amount);
        if (d.getFullYear() === today.getFullYear()) annualTotal += Number(t.amount);
    });
    const rows = [
        { period: 'Weekly', budget: Number(budgets.weekly || 0), transactions: weeklyTotal },
        { period: 'Monthly', budget: Number(budgets.monthly || 0), transactions: monthlyTotal },
        { period: 'Annual', budget: Number(budgets.annual || 0), transactions: annualTotal }
    ];
    reportsTableBody.innerHTML = rows.map(row => {
        let status = '', statusClass = '';
        const remaining = row.budget - row.transactions;
        if (row.budget === 0) {
            status = 'No budget set';
            statusClass = 'status-nobudget';
        } else if (row.transactions > row.budget) {
            status = `Budget crossed by ₹${Math.round(row.transactions - row.budget)}`;
            statusClass = 'status-over';
        } else if (row.transactions === row.budget) {
            status = 'Budget utilised';
            statusClass = 'status-utilised';
        } else if (remaining > 0 && remaining <= row.budget * 0.1) {
            status = `Nearly reached (₹${Math.round(remaining)} left)`;
            statusClass = 'status-nearly';
        } else {
            status = 'Within';
            statusClass = 'status-within';
        }
        return `<tr>
            <td>${row.period}</td>
            <td>₹${Math.round(row.transactions)}</td>
            <td>₹${Math.round(row.budget)}</td>
            <td class="${statusClass}">${status}</td>
        </tr>`;
    }).join('');
    updateNotifications();
}

function getReportNotifications() {
    const today = new Date();
    let weeklyTotal = 0, monthlyTotal = 0, annualTotal = 0;
    transactions.forEach(t => {
        const d = new Date(t.date);
        const weekAgo = new Date(today.getTime() - 7*24*60*60*1000);
        if (d >= weekAgo) weeklyTotal += Number(t.amount);
        if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) monthlyTotal += Number(t.amount);
        if (d.getFullYear() === today.getFullYear()) annualTotal += Number(t.amount);
    });
    const rows = [
        { period: 'Weekly', budget: Number(budgets.weekly || 0), transactions: weeklyTotal },
        { period: 'Monthly', budget: Number(budgets.monthly || 0), transactions: monthlyTotal },
        { period: 'Annual', budget: Number(budgets.annual || 0), transactions: annualTotal }
    ];
    const notifications = [];
    rows.forEach(row => {
        const remaining = row.budget - row.transactions;
        if (row.budget === 0) return;
        if (row.transactions > row.budget) {
            notifications.push({
                type: 'over',
                message: `! ${row.period} budget exceeded by ₹${Math.round(row.transactions - row.budget)}!`
            });
        } else if (row.transactions === row.budget) {
            notifications.push({
                type: 'utilised',
                message: `! ${row.period} budget utilised!`
            });
        } else if (remaining > 0 && remaining <= row.budget * 0.1) {
            notifications.push({
                type: 'nearly',
                message: `! ${row.period} budget nearly reached (₹${Math.round(remaining)} left)!`
            });
        }
    });
    return notifications;
}

// --- NOTIFICATION BELL FUNCTIONALITY ---
const notifIcon = document.getElementById('notif-icon');
const notifBadge = document.getElementById('notif-badge');
const notifPopup = document.getElementById('notif-popup');

function updateNotifications() {
    const notifications = getReportNotifications();
    // Update badge
    if (notifBadge) {
        notifBadge.textContent = notifications.length > 0 ? notifications.length : '';
        notifBadge.style.display = notifications.length > 0 ? 'inline-block' : 'none';
    }
    // Update popup
    if (notifPopup) {
        if (notifications.length === 0) {
            notifPopup.innerHTML = `<div style="color:#888;padding:8px 0;">No notifications</div>`;
        } else {
            notifPopup.innerHTML = notifications.map(n => {
                let color = '#FFA500'; // default orange
                if (n.type === 'over') color = '#f76c6c';
                if (n.type === 'utilised') color = '#1976d2';
                if (n.type === 'nearly') color = '#FFA500';
                return `<div style="padding:8px 0 8px 0;display:flex;align-items:center;">
                    <span style="font-size:1.2em;color:${color};margin-right:8px;">&#33;</span>
                    <span style="color:${color};font-weight:600;">${n.message}</span>
                </div>`;
            }).join('');
        }
    }
}

// Show/hide popup on bell click
if (notifIcon && notifPopup) {
    notifIcon.onclick = function(e) {
        notifPopup.style.display = notifPopup.style.display === 'block' ? 'none' : 'block';
        notifPopup.style.right = '0';
        notifPopup.style.top = '40px';
        notifPopup.style.position = 'absolute';
        e.stopPropagation();
    };
    // Hide popup when clicking outside
    document.addEventListener('click', function() {
        notifPopup.style.display = 'none';
    });
    notifPopup.onclick = function(e) { e.stopPropagation(); };
}

// --- RENDER BUDGETS BAR CHART ---
function renderBudgetsBarChart() {
    const ctx = document.getElementById('budgetsBarChart')?.getContext('2d');
    if (!ctx) return;
    const periods = ['Weekly', 'Monthly', 'Annual'];
    const budgetsData = [budgets.weekly, budgets.monthly, budgets.annual].map(x => Number(x) || 0);
    const today = new Date();
    const transactionsData = [
        transactions.filter(t => new Date(t.date) >= new Date(today.getTime() - 7*24*60*60*1000)).reduce((sum, t) => sum + Number(t.amount), 0),
        transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }).reduce((sum, t) => sum + Number(t.amount), 0),
        transactions.filter(t => new Date(t.date).getFullYear() === today.getFullYear()).reduce((sum, t) => sum + Number(t.amount), 0)
    ];
    if (window.budgetsBarChartInstance) window.budgetsBarChartInstance.destroy();
    window.budgetsBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: periods,
            datasets: [
                {
                    label: 'Budget',
                    data: budgetsData,
                    backgroundColor: '#00e676'
                },
                {
                    label: 'Transactions',
                    data: transactionsData,
                    backgroundColor: '#2979ff'
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#222', font: { weight: 'bold', family: 'sans-serif', size: 15 } } }
            },
            scales: {
                x: { grid: { display: true, color: '#222' }, ticks: { color: '#222', font: { weight: 'bold', family: 'sans-serif', size: 15 } } },
                y: { grid: { display: true, color: '#222' }, beginAtZero: true, ticks: { color: '#222', font: { weight: 'bold', family: 'sans-serif', size: 15 }, precision: 0 } }
            }
        }
    });
}

// --- RENDER CATEGORY PIE CHART ---
function renderCategoryPieChart() {
    const ctx = document.getElementById('categoryPieChart')?.getContext('2d');
    if (!ctx) return;
    const categoryTotals = {};
    let totalAmount = 0;
    transactions.forEach(t => {
        const cat = t.category || 'Others';
        const amt = Number(t.amount);
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
        totalAmount += amt;
    });
    const categories = Object.keys(categoryTotals);
    const vibrantColors = ['#00e676', '#ffd600', '#2979ff', '#ff1744', '#ff9100', '#651fff'];
    const colors = categories.map((_, i) => vibrantColors[i % vibrantColors.length]);
    const amounts = categories.map(cat => categoryTotals[cat] || 0);
    const percentages = amounts.map(a => totalAmount ? Math.round((a / totalAmount) * 100) : 0);
    if (window.categoryPieChartInstance) window.categoryPieChartInstance.destroy();
    window.categoryPieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories.map((cat, i) => `${cat} (${percentages[i]}%)`),
            datasets: [{
                data: amounts,
                backgroundColor: colors,
                borderWidth: 0.2,
                borderColor: '#222'
            }]
        },
        options: {
            responsive: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: 'sans-serif', weight: 'bold', size: 15 },
                        color: (ctx) => {
                            const chart = ctx.chart;
                            const dataset = chart.data.datasets[0];
                            return dataset.backgroundColor[ctx.index];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ₹${Math.round(value)}`;
                        }
                    }
                }
            }
        }
    });
}

// --- RENDER MAIN AREA CHART ---
function renderMainAreaChart() {
    const ctx = document.getElementById('mainAreaChart')?.getContext('2d');
    if (!ctx) return;

    // Always show 6 months starting from August
    const today = new Date();
    let startYear = today.getFullYear();
    let startMonth = 7; // August (0-based index)
    if (today.getMonth() < 7) { // If before August, show last year's August
        startYear = today.getFullYear() - 1;
    }

    const months = [];
    const transactionTotals = [];
    const budgetTotals = [];

    for (let i = 0; i < 6; i++) {
        const d = new Date(startYear, startMonth + i, 1);
        const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        months.push(label);

        // Transactions sum for this month
        const monthTotal = transactions
            .filter(t => {
                const td = new Date(t.date);
                return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
            })
            .reduce((sum, t) => sum + Number(t.amount), 0);
        transactionTotals.push(monthTotal);

        // Use current monthly budget for all months
        budgetTotals.push(Number(budgets.monthly) || 0);
    }

    // Destroy previous chart if exists
    if (window.mainAreaChartInstance) window.mainAreaChartInstance.destroy();

    window.mainAreaChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Transactions',
                    data: transactionTotals,
                    fill: false,
                    borderColor: '#1976d2',
                    backgroundColor: '#1976d2',
                    tension: 0.3,
                    pointRadius: 7,
                    pointBackgroundColor: '#1976d2'
                },
                {
                    label: 'Budget',
                    data: budgetTotals,
                    fill: false,
                    borderColor: '#FFA500',
                    backgroundColor: '#FFA500',
                    borderDash: [8, 6],
                    pointRadius: 7,
                    pointBackgroundColor: '#FFA500'
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#222',
                        font: { weight: 'bold', family: 'sans-serif', size: 17 }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: true, color: '#222' },
                    ticks: { color: '#222', font: { weight: 'bold', family: 'sans-serif', size: 15 } }
                },
                y: {
                    grid: { display: true, color: '#222' },
                    beginAtZero: true,
                    ticks: { color: '#222', font: { weight: 'bold', family: 'sans-serif', size: 15 }, precision: 0 }
                }
            }
        }
    });
}

// --- FORM HANDLERS ---
if (form) {
    form.onsubmit = function(e) {
        e.preventDefault();
        const desc = document.getElementById('trans-desc').value.trim();
        const amount = parseFloat(document.getElementById('trans-amount').value);
        const category = document.getElementById('trans-category').value;
        const email = sessionStorage.getItem('user_email');
        // Get IST date string (YYYY-MM-DD)
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);
        const istDateStr = istDate.toISOString().slice(0, 10);

        if (!desc || isNaN(amount) || !category || !email) {
            alert('Fill all fields and make sure you are logged in!');
            return;
        }
        fetch('http://localhost:5000/add-transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, type: category, amount: amount, description: desc, date: istDateStr })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                fetchUserData();
                form.reset();
            } else {
                alert(data.message || 'Failed to add transaction');
            }
        });
    };
}

if (budgetForm) {
    budgetForm.onsubmit = function(e) {
        e.preventDefault();
        const email = sessionStorage.getItem('user_email');
        const annual = document.getElementById('annual-budget').value;
        const monthly = document.getElementById('monthly-budget').value;
        const weekly = document.getElementById('weekly-budget').value;
        const promises = [];
        if (annual !== '') {
            promises.push(fetch('http://localhost:5000/add-budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name: 'Annual', amount: annual })
            }));
        }
        if (monthly !== '') {
            promises.push(fetch('http://localhost:5000/add-budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name: 'Monthly', amount: monthly })
            }));
        }
        if (weekly !== '') {
            promises.push(fetch('http://localhost:5000/add-budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name: 'Weekly', amount: weekly })
            }));
        }
        Promise.all(promises).then(() => {
            fetchUserData();
            budgetForm.reset();
        });
    };
}

// --- TAB & MODAL LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // Tabs
    const dashboardTab = document.getElementById('dashboard-tab');
    const transactionsTab = document.getElementById('transactions-tab');
    const budgetsTab = document.getElementById('budgets-tab');
    const reportsTab = document.getElementById('reports-tab');
    const allTabs = [dashboardTab, transactionsTab, budgetsTab, reportsTab];

    // Modals
    const transactionsModal = document.getElementById('transactions-modal');
    const closeTransactions = document.getElementById('close-transactions');
    const budgetsModal = document.getElementById('budgets-modal');
    const closeBudgets = document.getElementById('close-budgets');
    const reportsModal = document.getElementById('reports-modal');
    const closeReports = document.getElementById('close-reports');

    // Helper to close all modals
    function closeAllModals() {
        if (transactionsModal) transactionsModal.style.display = 'none';
        if (budgetsModal) budgetsModal.style.display = 'none';
        if (reportsModal) reportsModal.style.display = 'none';
    }

    // Helper to set active tab
    function setActiveTab(tab) {
        allTabs.forEach(t => t && t.classList.remove('active'));
        if (tab) tab.classList.add('active');
    }

    // Dashboard Tab (optional: close all modals)
    if (dashboardTab) {
        dashboardTab.onclick = () => {
            closeAllModals();
            setActiveTab(dashboardTab);
        };
    }

    // Open Transactions Modal
    if (transactionsTab && transactionsModal) {
        transactionsTab.onclick = () => {
            closeAllModals();
            transactionsModal.style.display = 'flex';
            setActiveTab(transactionsTab);
        };
    }
    if (closeTransactions && transactionsModal) {
        closeTransactions.onclick = () => {
            transactionsModal.style.display = 'none';
            setActiveTab(dashboardTab);
        };
    }

    // Open Budgets Modal
    if (budgetsTab && budgetsModal) {
        budgetsTab.onclick = () => {
            closeAllModals();
            budgetsModal.style.display = 'flex';
            setActiveTab(budgetsTab);
            resetBudgetsIfNeeded();
        };
    }
    if (closeBudgets && budgetsModal) {
        closeBudgets.onclick = () => {
            budgetsModal.style.display = 'none';
            setActiveTab(dashboardTab);
        };
    }

    // Open Reports Modal
    if (reportsTab && reportsModal) {
        reportsTab.onclick = () => {
            closeAllModals();
            reportsModal.style.display = 'flex';
            setActiveTab(reportsTab);
        };
    }
    if (closeReports && reportsModal) {
        closeReports.onclick = () => {
            reportsModal.style.display = 'none';
            setActiveTab(dashboardTab);
        };
    }

    // Close modal when clicking outside content
    [
        { modal: transactionsModal, tab: dashboardTab },
        { modal: budgetsModal, tab: dashboardTab },
        { modal: reportsModal, tab: dashboardTab }
    ].forEach(({ modal, tab }) => {
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    setActiveTab(tab);
                }
            };
        }
    });

    // Sign out button logic
    const signOutBtn = document.querySelector('.sidebar-btn');
    if (signOutBtn) {
        signOutBtn.onclick = () => {
            sessionStorage.clear();
            window.location.href = "login.html";
        };
    }
});

// --- INITIALIZE DASHBOARD ---
window.addEventListener('DOMContentLoaded', () => {
    fetchUserData();
    renderMainAreaChart();
    resetBudgetsIfNeeded();
});

function resetBudgetsIfNeeded() {
    const now = new Date();
    const email = sessionStorage.getItem('user_email');
    if (!email) return;

    // Helper to get last set info
    function getLastSet(key) {
        return localStorage.getItem(key) ? new Date(localStorage.getItem(key)) : null;
    }
    // Helper to set last set info
    function setLastSet(key, date) {
        localStorage.setItem(key, date.toISOString());
    }

    // Weekly
    const lastWeeklySet = getLastSet('weekly_budget_set');
    if (!lastWeeklySet || now.getDay() === 1 && now - lastWeeklySet > 6*24*60*60*1000) { // Monday
        fetch('http://localhost:5000/add-budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name: 'Weekly', amount: 0 })
        }).then(() => setLastSet('weekly_budget_set', now));
    }

    // Monthly
    const lastMonthlySet = getLastSet('monthly_budget_set');
    if (!lastMonthlySet || (now.getDate() === 1 && (now.getMonth() !== lastMonthlySet.getMonth() || now.getFullYear() !== lastMonthlySet.getFullYear()))) {
        fetch('http://localhost:5000/add-budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name: 'Monthly', amount: 0 })
        }).then(() => setLastSet('monthly_budget_set', now));
    }

    // Annual
    const lastAnnualSet = getLastSet('annual_budget_set');
    if (!lastAnnualSet || (now.getMonth() === 0 && now.getDate() === 1 && now.getFullYear() !== lastAnnualSet.getFullYear())) {
        fetch('http://localhost:5000/add-budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name: 'Annual', amount: 0 })
        }).then(() => setLastSet('annual_budget_set', now));
    }
}

// --- SEARCH FUNCTIONALITY ---
const searchInput = document.querySelector('.search');
const searchPopup = document.getElementById('search-popup');
let lastSearchResults = [];

if (searchInput && searchPopup) {
    searchInput.addEventListener('input', function () {
        const query = this.value.trim().toLowerCase();
        searchPopup.innerHTML = '';
        searchPopup.style.display = 'none';
        lastSearchResults = [];
        if (!query) return;

        // Find matching transactions by description
        const matches = transactions.filter(t =>
            t.desc && t.desc.toLowerCase().includes(query)
        );

        if (matches.length > 0) {
            lastSearchResults = matches;
            searchPopup.innerHTML = matches.map((t, idx) =>
                `<div class="search-suggestion" data-tid="${t.id}" style="padding:8px 16px;cursor:pointer;">
                    ${t.desc}
                </div>`
            ).join('');
            searchPopup.style.display = 'block';
        } else {
            // Show "No results found"
            searchPopup.innerHTML = `<div style="padding:8px 16px;color:#888;">No results found</div>`;
            searchPopup.style.display = 'block';
        }
    });

    // Handle click on suggestion
    searchPopup.addEventListener('click', function (e) {
        const target = e.target.closest('.search-suggestion');
        if (target) {
            const tid = target.getAttribute('data-tid');
            // Open transactions modal
            const transactionsTab = document.getElementById('transactions-tab');
            if (transactionsTab) transactionsTab.click();

            // Wait for modal to open and table to render, then highlight
            setTimeout(() => {
                highlightTransactionRow(tid);
            }, 200);

            // Hide popup and clear search
            searchPopup.style.display = 'none';
            searchInput.value = '';
        }
    });

    // Hide popup when clicking outside
    document.addEventListener('click', function (e) {
        if (!searchPopup.contains(e.target) && e.target !== searchInput) {
            searchPopup.style.display = 'none';
        }
    });
}

// Highlight the transaction row in the modal
function highlightTransactionRow(transactionId) {
    // Remove previous highlight if any
    document.querySelectorAll('.highlight-row').forEach(row => row.classList.remove('highlight-row'));
    const row = document.querySelector(`#transactions-body tr[data-tid="${transactionId}"]`);
    if (row) {
        row.classList.add('highlight-row');
        highlightedTransactionId = transactionId;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Remove highlight when transactions modal is closed
document.addEventListener('DOMContentLoaded', () => {
    const transactionsModal = document.getElementById('transactions-modal');
    const closeTransactions = document.getElementById('close-transactions');
    if (closeTransactions && transactionsModal) {
        closeTransactions.addEventListener('click', () => {
            document.querySelectorAll('.highlight-row').forEach(row => row.classList.remove('highlight-row'));
            highlightedTransactionId = null;
        });
    }
    // Also remove highlight if clicking outside modal to close
    if (transactionsModal) {
        transactionsModal.addEventListener('click', (e) => {
            if (e.target === transactionsModal) {
                document.querySelectorAll('.highlight-row').forEach(row => row.classList.remove('highlight-row'));
                highlightedTransactionId = null;
            }
        });
    }
});

// Ensure highlight persists after table re-renders
const originalRenderTransactions = renderTransactions;
renderTransactions = function () {
    tbody.innerHTML = '';
    transactions.forEach((t, idx) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-tid', t.id);
        let formattedDate = t.date ? new Date(t.date).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        }) : '';
        if (t.isEditing) {
            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td><input type="text" value="${t.desc}" id="edit-desc-${t.id}" /></td>
                <td><input type="number" value="${t.amount}" id="edit-amount-${t.id}" /></td>
                <td>
                    <select id="edit-category-${t.id}">
                        <option value="Food" ${t.category === 'Food' ? 'selected' : ''}>Food</option>
                        <option value="Education" ${t.category === 'Education' ? 'selected' : ''}>Education</option>
                        <option value="Clothes" ${t.category === 'Clothes' ? 'selected' : ''}>Clothes</option>
                        <option value="Transport" ${t.category === 'Transport' ? 'selected' : ''}>Transport</option>
                        <option value="Entertainment" ${t.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
                        <option value="Health" ${t.category === 'Health' ? 'selected' : ''}>Health</option>
                        <option value="Property" ${t.category === 'Property' ? 'selected' : ''}>Property</option>
                        <option value="Others" ${t.category === 'Others' ? 'selected' : ''}>Others</option>
                    </select>
                </td>
                <td>
                    <button class="save-btn">Save</button>
                    <button class="cancel-btn">Cancel</button>
                </td>
            `;
            tr.querySelector('.save-btn').onclick = () => saveEditTransaction(t.id);
            tr.querySelector('.cancel-btn').onclick = () => cancelEditTransaction(idx);
        } else {
            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td>${t.desc}</td>
                <td>${Math.round(t.amount)}</td>
                <td>${t.category}</td>
                <td>
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </td>
            `;
            tr.querySelector('.edit-btn').onclick = () => startEditTransaction(idx);
            tr.querySelector('.delete-btn').onclick = () => deleteTransaction(t.id);
        }
        // Keep highlight if this is the searched transaction
        if (highlightedTransactionId && t.id == highlightedTransactionId) {
            tr.classList.add('highlight-row');
        }
        tbody.appendChild(tr);
    });
};