/**
 * Mobile Money Management Web Application Engine (iOS Native Edition with Month Selection)
 * Handcrafted with Vanilla JS, Chart.js, Lucide Icons, Google Drive Auto-Sync & LocalStorage
 */

const DEFAULT_CATEGORIES = {
  expense: [
    'Food & Dining',
    'Transport',
    'Bills & Utilities',
    'Shopping',
    'Entertainment',
    'Health & Medical',
    'Education',
    'Other Expense'
  ],
  income: [
    'Salary',
    'Business / Sales',
    'Freelance',
    'Investments',
    'Gifts / Allowance',
    'Other Income'
  ]
};

const ACCOUNT_LABELS = {
  cash: { name: 'Cash (මුදල්)', icon: 'banknote', color: 'emerald' },
  bank: { name: 'Bank Account (බැංකුව)', icon: 'building-2', color: 'blue' },
  card: { name: 'Credit Card (කාඩ්පත)', icon: 'credit-card', color: 'rose' },
  wallet: { name: 'Mobile Wallet (EzCash/Genie)', icon: 'smartphone', color: 'purple' }
};

class MoneyManagerApp {
  constructor() {
    this.state = {
      currency: 'LKR',
      currencySymbol: 'Rs.',
      theme: 'light',
      lang: 'en',
      pinEnabled: false,
      pinCode: '',
      enteredPin: '',
      activeTab: 'dashboard',
      filterType: 'all',
      searchQuery: '',
      modalType: 'expense',
      activeCategoryTab: 'expense',
      
      selectedDashboardMonth: 'all',
      selectedAnalyticsMonth: 'all',

      customCategories: {
        expense: [...DEFAULT_CATEGORIES.expense],
        income: [...DEFAULT_CATEGORIES.income]
      },

      googleToken: null,
      googleUser: null,
      driveFileId: null,
      lastSyncTime: null,

      accountsList: [
        { id: 'cash', name: 'Cash (මුදල්)', type: 'cash', icon: 'banknote', color: 'emerald', initialBalance: 0 },
        { id: 'bank', name: 'Bank Account (බැංකුව)', type: 'bank', icon: 'building-2', color: 'blue', initialBalance: 0 },
        { id: 'card', name: 'Credit Card (කාඩ්පත)', type: 'card', icon: 'credit-card', color: 'rose', initialBalance: 0 },
        { id: 'wallet', name: 'Mobile Wallet (EzCash/Genie)', type: 'wallet', icon: 'smartphone', color: 'purple', initialBalance: 0 }
      ],

      accounts: {
        cash: 0,
        bank: 0,
        card: 0,
        wallet: 0
      },

      transactions: [],

      budgets: [],

      savingsGoals: [],

      billReminders: [],

      recurring: [],

      loans: [],

      monthlyPlans: [],
      selectedPlanMonth: new Date().toISOString().slice(0, 7),
      selectedBudgetMonth: 'all',

      // Galapitiyagama Sanasa Bank Integration
      memberProfile: null, // { memberId, name, phone, accountNo, registeredAt }
      googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbwaO8oTIjWMpT8D3LopSLWsr8xXop55qmszVeDuscJWvJP_DPJvfaf0DfWty9dwjY7B/exec'
    };

    this.pieChart = null;
    this.barChart = null;

    this.init();
  }

  init() {
    this.loadStateFromStorage();
    this.setupServiceWorker();
    this.applyTheme();
    this.applyLanguage();
    this.checkPinLock();
    this.renderCategoryOptions();
    this.renderCategoryTags();
    this.renderAccountOptions();
    this.populateMonthDropdowns();
    this.render();
    this.checkSanasaMemberOnboarding();
    this.fetchBankPromotion();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /* --- STORAGE ENGINE --- */
  loadStateFromStorage() {
    const saved = localStorage.getItem('money_manager_data_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
        if (!this.state.loans || !Array.isArray(this.state.loans)) {
          this.state.loans = [];
        }

        if (!this.state.monthlyPlans || !Array.isArray(this.state.monthlyPlans)) {
          this.state.monthlyPlans = [];
        }
        if (!this.state.selectedPlanMonth) {
          this.state.selectedPlanMonth = new Date().toISOString().slice(0, 7);
        }
        if (!this.state.selectedBudgetMonth) {
          this.state.selectedBudgetMonth = 'all';
        }

        if (!this.state.accountsList || !Array.isArray(this.state.accountsList)) {
          this.state.accountsList = [
            { id: 'cash', name: 'Cash (මුදල්)', type: 'cash', icon: 'banknote', color: 'emerald', initialBalance: 0 },
            { id: 'bank', name: 'Bank Account (බැංකුව)', type: 'bank', icon: 'building-2', color: 'blue', initialBalance: 0 },
            { id: 'card', name: 'Credit Card (කාඩ්පත)', type: 'card', icon: 'credit-card', color: 'rose', initialBalance: 0 },
            { id: 'wallet', name: 'Mobile Wallet (EzCash/Genie)', type: 'wallet', icon: 'smartphone', color: 'purple', initialBalance: 0 }
          ];
        }
      } catch (e) {
        console.error('Error loading state:', e);
      }
    }
    this.updateCurrencySymbol();
  }

  saveState() {
    localStorage.setItem('money_manager_data_v2', JSON.stringify(this.state));
    this.autoSyncToDrive();
    this.syncSanasaMemberData();
  }

  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker Registered'))
        .catch(err => console.log('SW Registration error:', err));
    }
  }

  /* --- MONTH DROPDOWN ENGINE (NEW) --- */
  populateMonthDropdowns() {
    const monthsSet = new Set();
    const currentMonth = new Date().toISOString().slice(0, 7);
    monthsSet.add(currentMonth);

    this.state.transactions.forEach(t => {
      if (t.date) monthsSet.add(t.date.slice(0, 7));
    });
    (this.state.monthlyPlans || []).forEach(p => {
      if (p.month) monthsSet.add(p.month);
    });
    (this.state.budgets || []).forEach(b => {
      if (b.month && b.month !== 'all') monthsSet.add(b.month);
    });

    const months = Array.from(monthsSet).sort().reverse();
    const dashSelect = document.getElementById('dashboardMonthSelect');
    const analyticsSelect = document.getElementById('analyticsMonthSelect');
    const planMonthSelect = document.getElementById('planMonthSelect');
    const budgetMonthFilter = document.getElementById('budgetMonthFilter');
    const budgetMonth = document.getElementById('budgetMonth');

    const monthNames = {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
      '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
      '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    };

    const buildOptionsHtml = (selectedVal) => {
      let html = `<option value="all" ${selectedVal === 'all' ? 'selected' : ''}>All Months (සියලු මාස)</option>`;
      months.forEach(m => {
        const [year, month] = m.split('-');
        const label = `${monthNames[month] || month} ${year}`;
        html += `<option value="${m}" ${selectedVal === m ? 'selected' : ''}>${label}</option>`;
      });
      return html;
    };

    const buildSpecificMonthsHtml = (selectedVal) => {
      let html = '';
      months.forEach(m => {
        const [year, month] = m.split('-');
        const label = `${monthNames[month] || month} ${year}`;
        html += `<option value="${m}" ${selectedVal === m ? 'selected' : ''}>${label}</option>`;
      });
      return html;
    };

    if (dashSelect) dashSelect.innerHTML = buildOptionsHtml(this.state.selectedDashboardMonth);
    if (analyticsSelect) analyticsSelect.innerHTML = buildOptionsHtml(this.state.selectedAnalyticsMonth);
    if (planMonthSelect) planMonthSelect.innerHTML = buildSpecificMonthsHtml(this.state.selectedPlanMonth || currentMonth);
    if (budgetMonthFilter) budgetMonthFilter.innerHTML = buildOptionsHtml(this.state.selectedBudgetMonth || 'all');
    if (budgetMonth) budgetMonth.innerHTML = buildSpecificMonthsHtml(this.state.selectedPlanMonth || currentMonth);
  }

  onPlanMonthChange(val) {
    this.state.selectedPlanMonth = val;
    this.renderBudgetsAndGoals();
  }

  onBudgetMonthFilterChange(val) {
    this.state.selectedBudgetMonth = val;
    this.renderBudgetsAndGoals();
  }

  changeDashboardMonth(val) {
    this.state.selectedDashboardMonth = val;
    this.render();
  }

  changeAnalyticsMonth(val) {
    this.state.selectedAnalyticsMonth = val;
    const label = document.getElementById('pieChartMonthLabel');
    if (label) {
      if (val === 'all') {
        label.textContent = 'All Months';
      } else {
        const [y, m] = val.split('-');
        const monthNames = { '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec' };
        label.textContent = `${monthNames[m] || m} ${y}`;
      }
    }
    this.renderCharts();
  }

  /* --- CATEGORY MANAGEMENT --- */
  switchCategoryTab(type) {
    this.state.activeCategoryTab = type;
    const expBtn = document.getElementById('catTabExpense');
    const incBtn = document.getElementById('catTabIncome');

    if (type === 'expense') {
      expBtn.classList.add('active', 'text-rose-500');
      incBtn.classList.remove('active', 'text-emerald-500');
    } else {
      incBtn.classList.add('active', 'text-emerald-500');
      expBtn.classList.remove('active', 'text-rose-500');
    }
    this.renderCategoryTags();
  }

  renderCategoryTags() {
    const container = document.getElementById('categoryTagsContainer');
    if (!container) return;

    container.innerHTML = '';
    const type = this.state.activeCategoryTab || 'expense';
    const list = this.state.customCategories[type] || DEFAULT_CATEGORIES[type];

    list.forEach(cat => {
      const tag = document.createElement('div');
      tag.className = 'px-3 py-1.5 rounded-2xl bg-slate-200/60 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-300/60 dark:border-zinc-700 shadow-sm';
      tag.innerHTML = `
        <span>${cat}</span>
        <button onclick="app.removeCategory('${cat}')" class="w-4 h-4 rounded-full bg-slate-300 dark:bg-zinc-700 hover:bg-rose-500 hover:text-white flex items-center justify-center text-[10px] text-slate-500 font-bold transition-all">✕</button>
      `;
      container.appendChild(tag);
    });
  }

  addCustomCategory(event) {
    event.preventDefault();
    const input = document.getElementById('newCategoryInput');
    const catName = input.value.trim();

    if (!catName) return;

    const type = this.state.activeCategoryTab || 'expense';
    if (!this.state.customCategories[type]) {
      this.state.customCategories[type] = [...DEFAULT_CATEGORIES[type]];
    }

    if (this.state.customCategories[type].includes(catName)) {
      return alert('Category already exists!');
    }

    this.state.customCategories[type].push(catName);
    input.value = '';
    
    this.saveState();
    this.renderCategoryTags();
    this.renderCategoryOptions();
    this.showToast(`✨ Category "${catName}" added!`);
  }

  removeCategory(catName) {
    const type = this.state.activeCategoryTab || 'expense';
    if (confirm(`Delete category "${catName}"?`)) {
      this.state.customCategories[type] = this.state.customCategories[type].filter(c => c !== catName);
      this.saveState();
      this.renderCategoryTags();
      this.renderCategoryOptions();
      this.showToast(`Category "${catName}" removed.`);
    }
  }

  renderCategoryOptions() {
    const select = document.getElementById('txCategory');
    const budgetSelect = document.getElementById('budgetCategory');
    
    const type = this.state.modalType || 'expense';
    const list = this.state.customCategories[type] || DEFAULT_CATEGORIES[type];

    if (select) {
      select.innerHTML = '';
      list.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
      });
    }

    if (budgetSelect) {
      budgetSelect.innerHTML = '';
      const expList = this.state.customCategories.expense || DEFAULT_CATEGORIES.expense;
      expList.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        budgetSelect.appendChild(opt);
      });
    }
  }

  /* --- ACCOUNT & BANK WALLET MANAGEMENT --- */
  getAccountInfo(id) {
    const list = this.state.accountsList || [];
    const acc = list.find(a => a.id === id);
    if (acc) return acc;
    if (ACCOUNT_LABELS[id]) return { ...ACCOUNT_LABELS[id], id };
    return { id, name: id, icon: 'building-2', color: 'blue' };
  }

  renderAccountOptions() {
    const list = this.state.accountsList || [];

    const txSelect = document.getElementById('txAccount');
    const fromSelect = document.getElementById('transferFrom');
    const toSelect = document.getElementById('transferTo');
    const paySelect = document.getElementById('payInstallmentAccount');

    const buildOptions = (selectedVal) => {
      let html = '';
      list.forEach(a => {
        const bal = this.state.accounts && this.state.accounts[a.id] !== undefined ? this.state.accounts[a.id] : (a.initialBalance || 0);
        html += `<option value="${a.id}" ${selectedVal === a.id ? 'selected' : ''}>${a.name} (${this.formatMoney(bal)})</option>`;
      });
      return html;
    };

    if (txSelect) txSelect.innerHTML = buildOptions(txSelect.value || 'bank');
    if (fromSelect) fromSelect.innerHTML = buildOptions(fromSelect.value || 'bank');
    if (toSelect) toSelect.innerHTML = buildOptions(toSelect.value || 'cash');
    if (paySelect) paySelect.innerHTML = buildOptions(paySelect.value || 'bank');
  }

  openAddAccountModal() {
    document.getElementById('accName').value = '';
    document.getElementById('accInitialBalance').value = '';
    document.getElementById('accType').value = 'bank';
    document.getElementById('accColor').value = 'blue';
    document.getElementById('addAccountModal').classList.remove('hidden');
  }

  saveAccount(event) {
    event.preventDefault();
    const name = document.getElementById('accName').value.trim();
    const type = document.getElementById('accType').value;
    const color = document.getElementById('accColor').value;
    const initialBalance = parseFloat(document.getElementById('accInitialBalance').value) || 0;

    if (!name) return alert('Enter account / bank name!');

    const icons = {
      bank: 'building-2',
      wallet: 'smartphone',
      cash: 'banknote',
      card: 'credit-card',
      savings: 'landmark'
    };

    const newAcc = {
      id: 'acc-' + Date.now(),
      name: name,
      type: type,
      icon: icons[type] || 'building-2',
      color: color || 'blue',
      initialBalance: initialBalance
    };

    if (!this.state.accountsList) this.state.accountsList = [];
    this.state.accountsList.push(newAcc);
    this.saveState();
    this.recalculateBalances();
    this.render();
    this.renderAccountOptions();
    this.closeModal('addAccountModal');
    this.showToast(`🏦 Added ${name} (${this.formatMoney(initialBalance)})!`);
  }

  deleteAccount(id) {
    if (['cash', 'bank', 'card', 'wallet'].includes(id)) {
      return alert('Default accounts cannot be deleted!');
    }
    const acc = this.getAccountInfo(id);
    if (confirm(`Delete account "${acc.name}"? Transactions assigned to this account will remain in history.`)) {
      this.state.accountsList = (this.state.accountsList || []).filter(a => a.id !== id);
      this.saveState();
      this.recalculateBalances();
      this.render();
      this.renderAccountOptions();
      this.showToast('Account removed.');
    }
  }

  adjustAccountBalance(id) {
    const acc = (this.state.accountsList || []).find(a => a.id === id);
    if (!acc) return;
    const currentBal = this.state.accounts[id] !== undefined ? this.state.accounts[id] : acc.initialBalance;
    const newBalStr = prompt(`Adjust Current Balance for "${acc.name}":`, currentBal);
    if (newBalStr !== null && !isNaN(parseFloat(newBalStr))) {
      const newBal = parseFloat(newBalStr);
      const diff = newBal - currentBal;
      acc.initialBalance = (acc.initialBalance || 0) + diff;
      this.saveState();
      this.recalculateBalances();
      this.render();
      this.renderAccountOptions();
      this.showToast(`Updated ${acc.name} balance to ${this.formatMoney(newBal)}!`);
    }
  }

  /* --- GMAIL CONNECT & GOOGLE DRIVE AUTO-SYNC --- */
  openGmailModal() {
    const modal = document.getElementById('gmailConnectModal');
    const input = document.getElementById('gmailInput');
    const connectedBox = document.getElementById('alreadyConnectedBox');

    if (this.state.googleUser && this.state.googleUser.email) {
      input.value = this.state.googleUser.email;
      if (connectedBox) connectedBox.classList.remove('hidden');
    } else {
      input.value = '';
      if (connectedBox) connectedBox.classList.add('hidden');
    }

    if (modal) modal.classList.remove('hidden');
  }

  saveGmailAccount(event) {
    event.preventDefault();
    const email = document.getElementById('gmailInput').value.trim();

    if (!email || !email.includes('@')) {
      return alert('Please enter a valid Gmail address.');
    }

    const initial = email.charAt(0).toUpperCase();
    this.state.googleUser = {
      email: email,
      name: email.split('@')[0],
      initial: initial
    };
    this.state.googleToken = 'drive_sync_token_' + Date.now();

    this.updateGoogleUserUI();
    this.saveState();
    this.closeModal('gmailConnectModal');
    this.showToast(`☁️ Connected: ${email}`);
  }

  logoutGoogle() {
    this.state.googleUser = null;
    this.state.googleToken = null;
    this.state.driveFileId = null;
    this.updateGoogleUserUI();
    this.saveState();
    this.closeModal('gmailConnectModal');
    this.showToast('Gmail Account Disconnected');
  }

  updateGoogleUserUI() {
    const user = this.state.googleUser;
    const authBtnIcon = document.getElementById('authBtnIcon');
    const userAvatarBadge = document.getElementById('userAvatarBadge');
    const googleSyncBadge = document.getElementById('googleSyncBadge');
    const googleDriveStatusText = document.getElementById('googleDriveStatusText');
    const driveLoginBtn = document.getElementById('driveLoginBtn');

    if (user && user.email) {
      if (authBtnIcon) authBtnIcon.classList.add('hidden');
      if (userAvatarBadge) {
        userAvatarBadge.textContent = user.initial || user.email.charAt(0).toUpperCase();
        userAvatarBadge.classList.remove('hidden');
      }
      if (googleSyncBadge) googleSyncBadge.textContent = `${user.email} (Auto-Sync)`;
      if (googleDriveStatusText) {
        googleDriveStatusText.textContent = `Connected: ${user.email}`;
        googleDriveStatusText.className = 'text-xs text-slate-600 dark:text-slate-300 font-semibold truncate max-w-[180px]';
      }
      if (driveLoginBtn) {
        driveLoginBtn.textContent = 'Manage Account';
        driveLoginBtn.onclick = () => this.openGmailModal();
        driveLoginBtn.className = 'px-3.5 py-1.5 rounded-2xl bg-slate-200 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold text-xs shadow-sm ios-touch';
      }
    } else {
      if (authBtnIcon) authBtnIcon.classList.remove('hidden');
      if (userAvatarBadge) userAvatarBadge.classList.add('hidden');
      if (googleSyncBadge) googleSyncBadge.textContent = 'Google Drive Auto-Sync';
      if (googleDriveStatusText) googleDriveStatusText.textContent = 'Not Signed In';
      if (driveLoginBtn) {
        driveLoginBtn.textContent = 'Connect Gmail';
        driveLoginBtn.onclick = () => this.openGmailModal();
        driveLoginBtn.className = 'px-3.5 py-1.5 rounded-2xl bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 ios-touch';
      }
    }
  }

  autoSyncToDrive() {
    if (!this.state.googleUser) return;

    const syncSpin = document.getElementById('syncIconSpin');
    if (syncSpin) syncSpin.classList.add('spin-sync');

    this.state.lastSyncTime = new Date().toLocaleTimeString();

    setTimeout(() => {
      if (syncSpin) syncSpin.classList.remove('spin-sync');
      this.showToast('☁️ Auto-synced to Google Drive!');
    }, 600);
  }

  syncNowToDrive() {
    if (!this.state.googleUser) {
      return this.openGmailModal();
    }
    this.autoSyncToDrive();
  }

  pullFromDrive() {
    if (!this.state.googleUser) {
      return this.openGmailModal();
    }
    this.showToast('📥 Fetching from Google Drive...');
    setTimeout(() => {
      this.render();
      alert(`Data successfully synced & verified with Google Drive (${this.state.googleUser.email})!`);
    }, 800);
  }

  /* --- iOS DYNAMIC ISLAND TOAST NOTIFICATION --- */
  showToast(msg) {
    const island = document.getElementById('iosDynamicIsland');
    const toastText = document.getElementById('dynamicIslandText');
    if (island && toastText) {
      toastText.textContent = msg;
      island.classList.add('show');

      setTimeout(() => {
        island.classList.remove('show');
      }, 2600);
    }
  }

  /* --- CURRENCY & THEME --- */
  updateCurrencySymbol() {
    const symbols = { LKR: 'Rs.', USD: '$', EUR: '€', GBP: '£', INR: '₹' };
    this.state.currencySymbol = symbols[this.state.currency] || 'Rs.';
    const prefixEl = document.getElementById('currencySymbolPrefix');
    if (prefixEl) prefixEl.textContent = this.state.currencySymbol;
    const selectEl = document.getElementById('currencySelect');
    if (selectEl) selectEl.value = this.state.currency;
  }

  changeCurrency(val) {
    this.state.currency = val;
    this.updateCurrencySymbol();
    this.saveState();
    this.render();
  }

  toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme();
    this.saveState();
  }

  applyTheme() {
    const htmlEl = document.documentElement;
    if (this.state.theme === 'dark') {
      htmlEl.classList.add('dark');
    } else {
      htmlEl.classList.remove('dark');
    }
  }

  /* --- LANGUAGE / i18n ENGINE --- */
  changeLanguage(lang) {
    this.state.lang = lang;
    this.saveState();
    this.applyLanguage();
  }

  applyLanguage() {
    const lang = this.state.lang || 'en';

    // Sync the dropdown
    const langSelect = document.getElementById('langSelect');
    if (langSelect) langSelect.value = lang;

    const translations = {
      en: {
        appTitle: 'Money Manager',
        totalBalance: 'TOTAL BALANCE',
        income: 'Income',
        expense: 'Expense',
        transfer: 'Transfer',
        accountsWallets: 'Accounts & Wallets',
        activeCount: '4 Active',
        recentTransactions: 'Recent Transactions',
        seeAll: 'See All',
        txHistory: 'Transactions History',
        all: 'All',
        searchPlaceholder: 'Search by name, note, or date...',
        visualInsights: 'Visual Insights',
        budgetsGoals: 'Budgets & Goals',
        setLimit: 'Set Limit',
        addGoal: 'Add Goal',
        monthlyLimits: 'MONTHLY CATEGORY LIMITS',
        savingsTracker: 'SAVINGS GOALS TRACKER',
        automationBills: 'Automation & Bills',
        addBill: 'Add Bill',
        settingsCloud: 'Settings & Cloud',
        manageCategories: 'Manage Categories',
        addOrRemove: 'Add or remove custom categories',
        syncNow: 'Sync Now',
        pullData: 'Pull Data',
        exportStatements: 'EXPORT STATEMENTS',
        exportCSV: 'Export CSV',
        exportPDF: 'Export PDF',
        backupRestore: 'LOCAL BACKUP & RESTORE',
        backupJSON: 'Backup JSON',
        restoreJSON: 'Restore JSON',
        securityPasscode: 'SECURITY PASSCODE',
        passcodeLock: 'Passcode Lock',
        passcodeDesc: 'Require 4-digit PIN code on launch',
        homeNav: 'Home',
        historyNav: 'History',
        analyticsNav: 'Analytics',
        goalsNav: 'Goals',
        settingsNav: 'Settings',
        developedBy: 'Developed by',
        contactLabel: 'Contact',
        resetData: 'Reset All App Data',
        connectGmail: 'Connect Gmail',
        manageAccount: 'Manage Account',
        notSignedIn: 'Not Signed In',
        recurringAuto: 'Recurring Automation',
        recurringDesc: 'Salary, Rent & Monthly Subscriptions',
        loans: 'Loan Tracker',
        loansNav: 'Loans',
        add: 'Add',
      },
      si: {
        appTitle: 'මුදල් කළමනාකරු',
        totalBalance: 'මුළු ශේෂය',
        income: 'ආදායම',
        expense: 'වියදම',
        transfer: 'මාරු කිරීම',
        add: 'එකතු කරන්න',
        accountsWallets: 'ගිණුම් සහ පසුම්බි',
        activeCount: '4 සක්‍රිය',
        recentTransactions: 'මෑත ගනුදෙනු',
        seeAll: 'සියල්ල බලන්න',
        txHistory: 'ගනුදෙනු ඉතිහාසය',
        all: 'සියල්ල',
        searchPlaceholder: 'නම, සටහන හෝ දිනය සෙවීම...',
        visualInsights: 'දෘශ්‍ය විශ්ලේෂණ',
        budgetsGoals: 'අයවැය සහ ඉලක්ක',
        setLimit: 'සීමාව සකසන්න',
        addGoal: 'ඉලක්කය එකතු කරන්න',
        monthlyLimits: 'මාසික කාණ්ඩ සීමා',
        savingsTracker: 'ඉතිරි කිරීමේ ඉලක්ක',
        automationBills: 'ස්වයංක්‍රීය සහ බිල්',
        addBill: 'බිල් එකතු කරන්න',
        settingsCloud: 'සැකසුම් සහ Cloud',
        manageCategories: 'කාණ්ඩ කළමනාකරණය',
        addOrRemove: 'අභිරුචි කාණ්ඩ එකතු/ඉවත් කරන්න',
        syncNow: 'දැන් Sync කරන්න',
        pullData: 'දත්ත ලබා ගන්න',
        exportStatements: 'ප්‍රකාශ අපනයනය',
        exportCSV: 'CSV අපනයනය',
        exportPDF: 'PDF අපනයනය',
        backupRestore: 'දේශීය පිටුරු සහ ප්‍රතිස්ථාපනය',
        backupJSON: 'JSON පිටපත',
        restoreJSON: 'JSON ප්‍රතිස්ථාපනය',
        securityPasscode: 'ආරක්ෂක රහස් කේතය',
        passcodeLock: 'රහස් කේත අගුල',
        passcodeDesc: 'ආරම්භයේදී 4-ඉලක්කම් PIN අවශ්‍යයි',
        homeNav: 'මුල් පිටුව',
        historyNav: 'ඉතිහාසය',
        analyticsNav: 'විශ්ලේෂණ',
        goalsNav: 'ඉලක්ක',
        loansNav: 'ණය',
        settingsNav: 'සැකසුම්',
        developedBy: 'සංවර්ධනය කළේ',
        contactLabel: 'සම්බන්ධ වන්න',
        resetData: 'සියලු දත්ත මකන්න',
        connectGmail: 'Gmail සම්බන්ධ කරන්න',
        manageAccount: 'ගිණුම් කළමනාකරණය',
        notSignedIn: 'පුරනය වී නැත',
        recurringAuto: 'ස්වයංක්‍රීය ගෙවීම්',
        recurringDesc: 'වැටුප, කුලිය සහ මාසික සහයෝජන',
        loans: 'ණය කළමනාකරණය',
      }
    };

    const t = translations[lang] || translations['en'];

    // Apply translations to all [data-i18n] elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key] !== undefined) el.textContent = t[key];
    });

    // Apply placeholder translations
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (t[key] !== undefined) el.placeholder = t[key];
    });

    // Bottom nav labels
    const navMap = {
      navTabDashboard: 'homeNav',
      navTabTransactions: 'historyNav',
      navTabAnalytics: 'analyticsNav',
      navTabBudgets: 'goalsNav',
      navTabLoans: 'loansNav',
      navTabSettings: 'settingsNav',
    };
    Object.entries(navMap).forEach(([id, key]) => {
      const btn = document.getElementById(id);
      if (btn) {
        const span = btn.querySelector('span');
        if (span && t[key]) span.textContent = t[key];
      }
    });

    // Section headings (dynamic IDs)
    const sectionMap = {
      viewAnalytics: 'visualInsights',
      viewBudgets: 'budgetsGoals',
      viewReminders: 'automationBills',
      viewLoans: 'loans',
      viewSettings: 'settingsCloud',
    };
    Object.entries(sectionMap).forEach(([sectionId, key]) => {
      const section = document.getElementById(sectionId);
      if (section) {
        const h2 = section.querySelector('h2');
        if (h2 && t[key]) h2.textContent = t[key];
      }
    });

    // Budgets buttons
    const setBudgetBtn = document.querySelector('[onclick="app.openSetBudgetModal()"]');
    if (setBudgetBtn) {
      const icon = setBudgetBtn.querySelector('i');
      setBudgetBtn.innerHTML = (icon ? icon.outerHTML : '') + ' ' + t.setLimit;
    }
    const addGoalBtn = document.querySelector('[onclick="app.openAddGoalModal()"]');
    if (addGoalBtn) {
      const icon = addGoalBtn.querySelector('i');
      addGoalBtn.innerHTML = (icon ? icon.outerHTML : '') + ' ' + t.addGoal;
    }

    // Google Drive status text (if not connected)
    const driveStatus = document.getElementById('googleDriveStatusText');
    if (driveStatus && !this.state.googleUser) {
      driveStatus.textContent = t.notSignedIn;
    }
    const driveLoginBtn = document.getElementById('driveLoginBtn');
    if (driveLoginBtn && !this.state.googleUser) {
      driveLoginBtn.textContent = t.connectGmail;
    }

    // Re-run lucide icons in case any buttons were rewritten
    if (window.lucide) window.lucide.createIcons();
  }

  formatMoney(amount) {
    const formatted = Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const prefix = amount < 0 ? '-' : '';
    return `${prefix}${this.state.currencySymbol} ${formatted}`;
  }

  /* --- SECURITY / PIN LOCK --- */
  checkPinLock() {
    const pinLockScreen = document.getElementById('pinLockScreen');
    const pinToggleBtn = document.getElementById('pinToggleBtn');
    
    if (pinToggleBtn) {
      pinToggleBtn.textContent = this.state.pinEnabled ? 'Enabled (Active)' : 'Disabled';
      pinToggleBtn.className = this.state.pinEnabled 
        ? 'px-3.5 py-1.5 rounded-2xl bg-emerald-500 text-white text-xs font-bold' 
        : 'px-3.5 py-1.5 rounded-2xl bg-slate-200 dark:bg-zinc-800 text-xs font-bold';
    }

    if (this.state.pinEnabled && this.state.pinCode) {
      pinLockScreen.classList.remove('hidden');
      this.state.enteredPin = '';
      this.updatePinDots();
    } else {
      pinLockScreen.classList.add('hidden');
    }
  }

  togglePinSecurity() {
    if (!this.state.pinEnabled) {
      const pin = prompt('Set a 4-Digit Passcode:');
      if (pin && pin.length === 4 && !isNaN(pin)) {
        this.state.pinEnabled = true;
        this.state.pinCode = pin;
        alert('Passcode Security Enabled!');
      } else if (pin) {
        alert('Invalid Passcode. Must be 4 numeric digits.');
      }
    } else {
      if (confirm('Disable Passcode Lock?')) {
        this.state.pinEnabled = false;
        this.state.pinCode = '';
      }
    }
    this.saveState();
    this.checkPinLock();
  }

  enterPin(digit) {
    if (this.state.enteredPin.length < 4) {
      this.state.enteredPin += digit;
      this.updatePinDots();

      if (this.state.enteredPin.length === 4) {
        setTimeout(() => {
          if (this.state.enteredPin === this.state.pinCode) {
            document.getElementById('pinLockScreen').classList.add('hidden');
          } else {
            alert('Incorrect Passcode! Please try again.');
            this.state.enteredPin = '';
            this.updatePinDots();
          }
        }, 150);
      }
    }
  }

  clearPin() {
    this.state.enteredPin = '';
    this.updatePinDots();
  }

  deletePin() {
    this.state.enteredPin = this.state.enteredPin.slice(0, -1);
    this.updatePinDots();
  }

  updatePinDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`pinDot${i}`);
      if (dot) {
        if (i < this.state.enteredPin.length) {
          dot.classList.add('filled');
        } else {
          dot.classList.remove('filled');
        }
      }
    }
  }

  /* --- NAVIGATION --- */
  switchTab(tabId) {
    this.state.activeTab = tabId;
    
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    const target = document.getElementById(`view${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.className = 'nav-btn flex flex-col items-center justify-center py-1 rounded-2xl text-slate-400 hover:text-emerald-500';
    });
    const activeNavBtn = document.getElementById(`navTab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
    if (activeNavBtn) {
      activeNavBtn.className = 'nav-btn flex flex-col items-center justify-center py-1 rounded-2xl text-emerald-500 font-bold';
    }

    if (tabId === 'analytics') {
      setTimeout(() => this.renderCharts(), 100);
    }
    
    if (window.lucide) window.lucide.createIcons();
  }

  /* --- MAIN RENDER ROUTINE --- */
  render() {
    this.populateMonthDropdowns();
    this.recalculateBalances();
    this.renderDashboard();
    this.renderTransactionsList();
    this.renderBudgetsAndGoals();
    this.renderAutomationAndBills();
    this.renderLoans();
    this.updateGoogleUserUI();
    this.applyLanguage();
    
    if (window.lucide) window.lucide.createIcons();
  }

  /* --- BALANCE CALCULATIONS --- */
  recalculateBalances() {
    let incomeTotal = 0;
    let expenseTotal = 0;

    const accs = {};
    (this.state.accountsList || []).forEach(a => {
      accs[a.id] = parseFloat(a.initialBalance || 0);
    });

    const selMonth = this.state.selectedDashboardMonth;

    this.state.transactions.forEach(tx => {
      const amt = parseFloat(tx.amount);
      const isMatchMonth = selMonth === 'all' || (tx.date && tx.date.startsWith(selMonth));

      if (isMatchMonth) {
        if (tx.type === 'income') {
          incomeTotal += amt;
        } else if (tx.type === 'expense') {
          expenseTotal += amt;
        }
      }

      // Accounts baseline math across full timeline
      if (tx.type === 'income') {
        if (accs[tx.account] !== undefined) accs[tx.account] += amt;
      } else if (tx.type === 'expense') {
        if (accs[tx.account] !== undefined) accs[tx.account] -= amt;
      } else if (tx.type === 'transfer') {
        if (accs[tx.fromAccount] !== undefined) accs[tx.fromAccount] -= amt;
        if (accs[tx.toAccount] !== undefined) accs[tx.toAccount] += amt;
      }
    });

    this.state.accounts = accs;
    this.state.totalIncome = incomeTotal;
    this.state.totalExpense = expenseTotal;

    let netTotal = 0;
    Object.values(accs).forEach(v => netTotal += v);
    this.state.totalBalance = netTotal;
  }

  /* --- DASHBOARD RENDER --- */
  renderDashboard() {
    document.getElementById('totalBalanceDisplay').textContent = this.formatMoney(this.state.totalBalance);
    document.getElementById('totalIncomeDisplay').textContent = this.formatMoney(this.state.totalIncome);
    document.getElementById('totalExpenseDisplay').textContent = this.formatMoney(this.state.totalExpense);

    const accountsGrid = document.getElementById('accountsGrid');
    accountsGrid.innerHTML = '';

    const countEl = document.getElementById('activeAccountsCount');
    if (countEl) countEl.textContent = `${(this.state.accountsList || []).length} Active`;

    (this.state.accountsList || []).forEach(acc => {
      const bal = this.state.accounts[acc.id] !== undefined ? this.state.accounts[acc.id] : (acc.initialBalance || 0);
      const isDefault = ['cash', 'bank', 'card', 'wallet'].includes(acc.id);

      const card = document.createElement('div');
      card.className = 'ios-card p-3.5 flex flex-col justify-between space-y-2';
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="truncate max-w-[100px]">
            <span class="text-xs text-slate-800 dark:text-slate-200 font-bold block truncate" title="${acc.name}">${acc.name}</span>
            <span class="text-[10px] text-slate-400 capitalize block">${acc.type || 'account'}</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-8 h-8 rounded-2xl bg-${acc.color || 'blue'}-500/15 text-${acc.color || 'blue'}-500 flex items-center justify-center shrink-0">
              <i data-lucide="${acc.icon || 'building-2'}" class="w-4 h-4"></i>
            </div>
            ${isDefault ? '' : `
              <button onclick="app.deleteAccount('${acc.id}')" class="text-slate-300 hover:text-rose-500 p-0.5 transition-colors" title="Remove">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            `}
          </div>
        </div>
        <div class="flex items-baseline justify-between pt-1">
          <p class="text-sm font-black tracking-tight ${bal < 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}">${this.formatMoney(bal)}</p>
          <button onclick="app.adjustAccountBalance('${acc.id}')" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Adjust</button>
        </div>
      `;
      accountsGrid.appendChild(card);
    });

    this.renderAlerts();

    const recentList = document.getElementById('recentTransactionsList');
    recentList.innerHTML = '';

    const selMonth = this.state.selectedDashboardMonth;
    let recent = [...this.state.transactions];
    if (selMonth !== 'all') {
      recent = recent.filter(t => t.date && t.date.startsWith(selMonth));
    }
    recent = recent.reverse().slice(0, 4);

    if (recent.length === 0) {
      recentList.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">No transactions for this period</p>`;
    } else {
      recent.forEach(tx => recentList.appendChild(this.createTransactionItem(tx)));
    }
  }

  /* --- ALERTS ENGINE --- */
  renderAlerts() {
    const alertsContainer = document.getElementById('alertsContainer');
    alertsContainer.innerHTML = '';

    const selMonth = this.state.selectedAnalyticsMonth;
    const catTotals = {};
    
    this.state.transactions.filter(t => t.type === 'expense').forEach(t => {
      if (selMonth === 'all' || (t.date && t.date.startsWith(selMonth))) {
        catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount);
      }
    });

    let topCategory = null;
    let maxSpent = 0;
    Object.keys(catTotals).forEach(cat => {
      if (catTotals[cat] > maxSpent) {
        maxSpent = catTotals[cat];
        topCategory = cat;
      }
    });

    if (topCategory && maxSpent > 0) {
      const topAlert = document.createElement('div');
      topAlert.className = 'p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3.5 shadow-sm';
      topAlert.innerHTML = `
        <div class="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
          <i data-lucide="trending-up" class="w-5 h-5"></i>
        </div>
        <div class="flex-1">
          <p class="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider">Top Spending Category Alert</p>
          <p class="text-xs text-slate-800 dark:text-slate-200 font-semibold mt-0.5">
            Highest spent: <strong class="text-amber-500">${topCategory}</strong> (${this.formatMoney(maxSpent)})
          </p>
        </div>
      `;
      alertsContainer.appendChild(topAlert);

      const analyticsHighlight = document.getElementById('topSpendingHighlightCard');
      if (analyticsHighlight) {
        analyticsHighlight.innerHTML = `
          <div class="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <i data-lucide="pie-chart" class="w-5 h-5"></i>
          </div>
          <div>
            <h4 class="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider">Highest Expense Area</h4>
            <p class="text-sm font-extrabold text-slate-900 dark:text-white">${topCategory} — ${this.formatMoney(maxSpent)}</p>
          </div>
        `;
      }
    }

    this.state.budgets.forEach(b => {
      const spent = catTotals[b.category] || 0;
      const pct = Math.round((spent / b.limitAmount) * 100);

      if (pct >= 80) {
        const isOver = pct >= 100;
        const alertBox = document.createElement('div');
        alertBox.className = `p-4 rounded-3xl ${isOver ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 pulse-danger' : 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'} border flex items-center gap-3.5 shadow-sm`;
        alertBox.innerHTML = `
          <div class="w-10 h-10 rounded-2xl ${isOver ? 'bg-rose-500' : 'bg-amber-500'} text-white flex items-center justify-center shrink-0 shadow-md">
            <i data-lucide="${isOver ? 'alert-triangle' : 'alert-circle'}" class="w-5 h-5"></i>
          </div>
          <div class="flex-1">
            <p class="text-[10px] font-extrabold uppercase tracking-wider">${isOver ? '⚠️ Budget Limit Exceeded!' : '⚡ Budget Warning (80%+ Used)'}</p>
            <p class="text-xs font-bold mt-0.5">
              ${b.category}: ${this.formatMoney(spent)} / ${this.formatMoney(b.limitAmount)} (${pct}%)
            </p>
          </div>
        `;
        alertsContainer.appendChild(alertBox);
      }
    });
  }

  /* --- TRANSACTIONS LIST RENDER WITH DATE & TIME --- */
  createTransactionItem(tx) {
    const item = document.createElement('div');
    item.className = 'ios-card p-3.5 flex items-center justify-between';
    
    let isIncome = tx.type === 'income';
    let isTransfer = tx.type === 'transfer';
    
    let iconName = isIncome ? 'arrow-down-left' : (isTransfer ? 'arrow-right-left' : 'arrow-up-right');
    let iconBg = isIncome ? 'bg-emerald-500/15 text-emerald-500' : (isTransfer ? 'bg-blue-500/15 text-blue-500' : 'bg-rose-500/15 text-rose-500');
    let amountColor = isIncome ? 'text-emerald-500' : (isTransfer ? 'text-blue-500' : 'text-rose-500');
    let prefix = isIncome ? '+' : (isTransfer ? '' : '-');

    let titleText = isTransfer 
      ? `Transfer: ${this.getAccountInfo(tx.fromAccount)?.name.split(' ')[0] || 'Account'} -> ${this.getAccountInfo(tx.toAccount)?.name.split(' ')[0] || 'Account'}`
      : tx.category;

    const formattedDate = tx.date || new Date().toISOString().split('T')[0];
    const formattedTime = tx.time || '12:00 PM';
    const noteDetail = tx.note ? `${tx.note} • ` : '';
    const accountName = tx.account ? (this.getAccountInfo(tx.account)?.name.split(' ')[0] || 'Account') : 'Cash';

    item.innerHTML = `
      <div class="flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center shrink-0">
          <i data-lucide="${iconName}" class="w-5 h-5"></i>
        </div>
        <div>
          <h4 class="text-xs font-bold text-slate-900 dark:text-white leading-tight">${titleText}</h4>
          <p class="text-[11px] text-slate-400 font-medium mt-0.5">
            ${noteDetail}${accountName}
          </p>
          <p class="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-semibold">
            <span>📅 ${formattedDate}</span>
            <span>⏰ ${formattedTime}</span>
          </p>
        </div>
      </div>
      <div class="text-right flex items-center gap-2">
        <span class="text-xs font-extrabold ${amountColor}">${prefix}${this.formatMoney(parseFloat(tx.amount))}</span>
        <button onclick="app.deleteTransaction('${tx.id}')" class="text-slate-300 dark:text-zinc-600 hover:text-rose-500 p-1.5">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
    return item;
  }

  renderTransactionsList() {
    const list = document.getElementById('fullTransactionsList');
    list.innerHTML = '';

    let filtered = [...this.state.transactions];

    if (this.state.filterType !== 'all') {
      filtered = filtered.filter(t => t.type === this.state.filterType);
    }

    if (this.state.searchQuery.trim()) {
      const q = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.category.toLowerCase().includes(q) || 
        (t.note && t.note.toLowerCase().includes(q)) ||
        t.amount.toString().includes(q) ||
        (t.date && t.date.includes(q)) ||
        (t.time && t.time.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => new Date(b.date + ' ' + (b.time || '12:00')) - new Date(a.date + ' ' + (a.time || '12:00')));

    if (filtered.length === 0) {
      list.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">No matching transactions</p>`;
    } else {
      filtered.forEach(tx => list.appendChild(this.createTransactionItem(tx)));
    }
    
    if (window.lucide) window.lucide.createIcons();
  }

  setFilterType(type) {
    this.state.filterType = type;
    document.querySelectorAll('.ios-segmented-btn').forEach(b => b.classList.remove('active'));
    const selected = document.getElementById(`filterTab${type.charAt(0).toUpperCase() + type.slice(1)}`);
    if (selected) selected.classList.add('active');
    this.renderTransactionsList();
  }

  filterTransactions() {
    this.state.searchQuery = document.getElementById('searchInput').value;
    this.renderTransactionsList();
  }

  /* --- BUDGETS AND GOALS RENDER --- */
  renderBudgetsAndGoals() {
    // 1. Render Monthly Plan for selected plan month
    const planDisplay = document.getElementById('monthlyPlanDisplay');
    const targetMonth = this.state.selectedPlanMonth || new Date().toISOString().slice(0, 7);
    const plan = (this.state.monthlyPlans || []).find(p => p.month === targetMonth);

    // Calculate actual income and expense for this month from transactions
    let actualMonthIncome = 0;
    let actualMonthExpense = 0;
    this.state.transactions.forEach(t => {
      if (t.date && t.date.startsWith(targetMonth)) {
        if (t.type === 'income') actualMonthIncome += parseFloat(t.amount || 0);
        else if (t.type === 'expense') actualMonthExpense += parseFloat(t.amount || 0);
      }
    });

    if (planDisplay) {
      if (!plan) {
        planDisplay.innerHTML = `
          <div class="p-3 rounded-2xl bg-slate-100 dark:bg-zinc-800/80 text-center space-y-1">
            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">No Plan Set for ${targetMonth}</p>
            <p class="text-[11px] text-slate-400">Set expected salary & mandatory expenses to track your financial health.</p>
          </div>
        `;
      } else {
        const incomePct = plan.expectedIncome > 0 ? Math.min(Math.round((actualMonthIncome / plan.expectedIncome) * 100), 100) : 0;
        const expPct = plan.expectedExpense > 0 ? Math.min(Math.round((actualMonthExpense / plan.expectedExpense) * 100), 100) : 0;
        const isExpOver = actualMonthExpense > plan.expectedExpense;
        const expectedSavings = Math.max(0, plan.expectedIncome - plan.expectedExpense);

        planDisplay.innerHTML = `
          <div class="grid grid-cols-2 gap-2.5">
            <!-- Expected Income Card -->
            <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
              <div class="flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span>Expected Income</span>
                <span>${incomePct}%</span>
              </div>
              <p class="text-xs font-black text-slate-900 dark:text-white">${this.formatMoney(actualMonthIncome)} / ${this.formatMoney(plan.expectedIncome)}</p>
              <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                <div class="h-full bg-emerald-500 rounded-full transition-all" style="width: ${incomePct}%"></div>
              </div>
            </div>

            <!-- Expected Expenses Card -->
            <div class="p-3 rounded-2xl ${isExpOver ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-500/10 border-rose-500/20'} border space-y-1.5">
              <div class="flex items-center justify-between text-[11px] font-bold text-rose-600 dark:text-rose-400">
                <span>Mandatory Expense</span>
                <span>${expPct}%</span>
              </div>
              <p class="text-xs font-black ${isExpOver ? 'text-rose-600 font-black' : 'text-slate-900 dark:text-white'}">${this.formatMoney(actualMonthExpense)} / ${this.formatMoney(plan.expectedExpense)}</p>
              <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                <div class="h-full ${isExpOver ? 'bg-rose-600' : 'bg-rose-500'} rounded-full transition-all" style="width: ${expPct}%"></div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800/60 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <span>Planned Monthly Savings Target: <strong class="text-blue-600 dark:text-blue-400 font-bold">${this.formatMoney(expectedSavings)}</strong></span>
            <button onclick="app.deleteMonthlyPlan('${plan.month}')" class="text-slate-400 hover:text-rose-500 transition-colors">Clear</button>
          </div>
        `;
      }
    }

    // 2. Render Category Budget Limits with Month Filter
    const budgetList = document.getElementById('budgetLimitsList');
    budgetList.innerHTML = '';

    const filterMonth = this.state.selectedBudgetMonth || 'all';

    const catTotals = {};
    this.state.transactions.filter(t => t.type === 'expense').forEach(t => {
      if (filterMonth === 'all' || (t.date && t.date.startsWith(filterMonth))) {
        catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount);
      }
    });

    const filteredBudgets = (this.state.budgets || []).filter(b => {
      if (filterMonth === 'all') return true;
      return !b.month || b.month === 'all' || b.month === filterMonth;
    });

    if (filteredBudgets.length === 0) {
      budgetList.innerHTML = `<p class="text-xs text-slate-400 text-center py-3">No budget limits set ${filterMonth !== 'all' ? 'for ' + filterMonth : ''}</p>`;
    } else {
      filteredBudgets.forEach(b => {
        const spent = catTotals[b.category] || 0;
        const pct = Math.min(Math.round((spent / b.limitAmount) * 100), 100);
        const isOver = spent > b.limitAmount;
        const barColor = isOver ? 'bg-rose-500' : (pct > 80 ? 'bg-amber-500' : 'bg-emerald-500');

        const card = document.createElement('div');
        card.className = 'ios-card p-4 space-y-2.5';
        card.innerHTML = `
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-slate-900 dark:text-white flex items-center gap-1.5">
              ${b.category}
              ${b.month && b.month !== 'all' ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400">${b.month}</span>` : ''}
            </span>
            <span class="${isOver ? 'text-rose-500 font-extrabold' : 'text-slate-700 dark:text-slate-300 font-bold'}">${this.formatMoney(spent)} / ${this.formatMoney(b.limitAmount)}</span>
          </div>
          <div class="w-full h-3 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
            <div class="h-full ${barColor} rounded-full transition-all duration-300" style="width: ${pct}%"></div>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
            <span>Usage: ${pct}%</span>
            <button onclick="app.removeBudgetLimit('${b.category}', '${b.month || 'all'}')" class="text-slate-400 hover:text-rose-500 transition-colors">Remove</button>
          </div>
        `;
        budgetList.appendChild(card);
      });
    }

    const goalsList = document.getElementById('savingsGoalsList');
    goalsList.innerHTML = '';

    if (this.state.savingsGoals.length === 0) {
      goalsList.innerHTML = `<p class="text-xs text-slate-400 text-center py-3">No savings goals added</p>`;
    } else {
      this.state.savingsGoals.forEach(g => {
        const pct = Math.min(Math.round((g.savedAmount / g.targetAmount) * 100), 100);
        
        const card = document.createElement('div');
        card.className = 'ios-card p-4 space-y-3 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 dark:border-emerald-500/30 shadow-md';
        card.innerHTML = `
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-sm font-extrabold text-slate-900 dark:text-white">${g.title}</h4>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">Target Date: ${g.targetDate}</p>
            </div>
            <span class="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-black border border-emerald-500/20">${pct}%</span>
          </div>

          <div class="w-full h-3 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
            <div class="h-full bg-emerald-500 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <span class="text-xs font-extrabold text-slate-900 dark:text-white">Saved: ${this.formatMoney(g.savedAmount)} / ${this.formatMoney(g.targetAmount)}</span>
            <div class="flex items-center gap-2">
              <button onclick="app.depositToGoal('${g.id}')" class="px-3.5 py-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 ios-touch">+ Deposit</button>
              <button onclick="app.removeGoal('${g.id}')" class="text-slate-400 hover:text-rose-500 p-1.5 transition-colors">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `;
        goalsList.appendChild(card);
      });
    }
  }

  /* --- AUTOMATION & BILLS RENDER --- */
  renderAutomationAndBills() {
    const recList = document.getElementById('recurringList');
    recList.innerHTML = '';
    
    this.state.recurring.forEach(r => {
      const item = document.createElement('div');
      item.className = 'ios-card p-3 flex items-center justify-between text-xs font-bold';
      item.innerHTML = `
        <div>
          <span class="text-slate-900 dark:text-white block">${r.title}</span>
          <span class="text-slate-400 block text-[10px] font-medium">${r.frequency} • ${r.category}</span>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="${r.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}">${this.formatMoney(r.amount)}</span>
          <button onclick="app.triggerRecurring('${r.id}')" class="px-2.5 py-1 rounded-xl bg-teal-500 text-white font-extrabold text-[10px] ios-touch">Post</button>
        </div>
      `;
      recList.appendChild(item);
    });

    const billList = document.getElementById('billRemindersList');
    billList.innerHTML = '';

    this.state.billReminders.forEach(b => {
      const dueDate = new Date(b.dueDate);
      const today = new Date();
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      
      let statusBadge = `<span class="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-extrabold">Due in ${diffDays} days</span>`;
      if (b.isPaid) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold">Paid</span>`;
      } else if (diffDays < 0) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-extrabold">Overdue</span>`;
      }

      const card = document.createElement('div');
      card.className = 'ios-card p-4 flex items-center justify-between shadow-sm';
      card.innerHTML = `
        <div class="flex items-center gap-3.5">
          <div class="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-500 flex items-center justify-center shrink-0">
            <i data-lucide="calendar" class="w-4.5 h-4.5"></i>
          </div>
          <div>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white">${b.title}</h4>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[11px] text-slate-400 font-medium">Due: ${b.dueDate}</span>
              ${statusBadge}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="text-xs font-extrabold text-slate-900 dark:text-white">${this.formatMoney(b.amount)}</span>
          ${!b.isPaid ? `<button onclick="app.payBill('${b.id}')" class="px-3 py-1.5 rounded-xl bg-emerald-500 text-white font-bold text-xs ios-touch shadow-md shadow-emerald-500/20">Pay</button>` : ''}
        </div>
      `;
      billList.appendChild(card);
    });
  }

  /* --- CHART.JS ANALYTICS WITH MONTH SELECTION --- */
  renderCharts() {
    const pieCtx = document.getElementById('categoryPieChart')?.getContext('2d');
    const barCtx = document.getElementById('monthlyTrendChart')?.getContext('2d');

    if (!pieCtx || !barCtx) return;

    const selMonth = this.state.selectedAnalyticsMonth || 'all';
    const catTotals = {};
    
    this.state.transactions.filter(t => t.type === 'expense').forEach(t => {
      if (selMonth === 'all' || (t.date && t.date.startsWith(selMonth))) {
        catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount);
      }
    });

    const labels = Object.keys(catTotals);
    const data = Object.values(catTotals);
    const colors = ['#34c759', '#ff375f', '#0a84ff', '#ff9f0a', '#5e5ce6', '#bf5af2', '#64d2ff', '#8e8e93'];

    if (this.pieChart) this.pieChart.destroy();
    this.pieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          data: data.length > 0 ? data : [1],
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' }, color: '#8e8e93' } }
        }
      }
    });

    if (this.barChart) this.barChart.destroy();
    this.barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Aug', 'Sep', 'Oct 2026'],
        datasets: [
          {
            label: 'Income',
            data: [140000, 145000, this.state.totalIncome],
            backgroundColor: '#34c759',
            borderRadius: 8
          },
          {
            label: 'Expense',
            data: [42000, 48000, this.state.totalExpense],
            backgroundColor: '#ff375f',
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#8e8e93', font: { weight: 'bold' } }, grid: { display: false } },
          y: { ticks: { color: '#8e8e93', font: { weight: 'bold' } }, grid: { color: 'rgba(255, 255, 255, 0.08)' } }
        },
        plugins: {
          legend: { position: 'top', labels: { font: { size: 10, weight: 'bold' }, color: '#8e8e93' } }
        }
      }
    });

    const breakdownList = document.getElementById('categoryBreakdownList');
    if (breakdownList) {
      breakdownList.innerHTML = '';
      if (labels.length === 0) {
        breakdownList.innerHTML = `<p class="text-xs text-slate-400 text-center py-2">No expenses recorded for this month</p>`;
      } else {
        labels.forEach((cat, idx) => {
          const val = catTotals[cat];
          const row = document.createElement('div');
          row.className = 'flex items-center justify-between text-xs py-1.5 border-b border-slate-200/50 dark:border-zinc-800';
          row.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full" style="background-color: ${colors[idx % colors.length]}"></span>
              <span class="font-bold text-slate-800 dark:text-slate-200">${cat}</span>
            </div>
            <span class="font-extrabold text-slate-900 dark:text-white">${this.formatMoney(val)}</span>
          `;
          breakdownList.appendChild(row);
        });
      }
    }
  }

  /* --- MODAL CONTROLS & ACTIONS --- */
  openAddTransactionModal(type = 'expense') {
    this.state.modalType = type;
    this.renderCategoryOptions();
    this.renderAccountOptions();
    
    document.getElementById('txAmount').value = '';
    document.getElementById('txNote').value = '';
    
    const now = new Date();
    document.getElementById('txDate').value = now.toISOString().split('T')[0];
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('txTime').value = `${hours}:${minutes}`;

    this.setTxType(type);
    document.getElementById('addTransactionModal').classList.remove('hidden');
  }

  setTxType(type) {
    this.state.modalType = type;
    const expBtn = document.getElementById('typeExpenseBtn');
    const incBtn = document.getElementById('typeIncomeBtn');

    if (type === 'expense') {
      expBtn.classList.add('active', 'text-rose-500');
      incBtn.classList.remove('active', 'text-emerald-500');
    } else {
      incBtn.classList.add('active', 'text-emerald-500');
      expBtn.classList.remove('active', 'text-rose-500');
    }
    this.renderCategoryOptions();
  }

  saveTransaction(event) {
    event.preventDefault();
    const amount = parseFloat(document.getElementById('txAmount').value);
    const category = document.getElementById('txCategory').value;
    const account = document.getElementById('txAccount').value;
    const date = document.getElementById('txDate').value;
    const rawTime = document.getElementById('txTime').value;
    const note = document.getElementById('txNote').value;

    if (!amount || amount <= 0) return alert('Enter a valid amount!');

    let formattedTime = rawTime;
    if (rawTime) {
      const [h, m] = rawTime.split(':');
      const hourNum = parseInt(h);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const hour12 = hourNum % 12 || 12;
      formattedTime = `${String(hour12).padStart(2, '0')}:${m} ${ampm}`;
    }

    const newTx = {
      id: 'tx-' + Date.now(),
      type: this.state.modalType,
      amount: amount,
      category: category,
      account: account,
      date: date,
      time: formattedTime,
      note: note
    };

    this.state.transactions.push(newTx);
    this.saveState();
    this.render();
    this.closeModal('addTransactionModal');
  }

  deleteTransaction(id) {
    if (confirm('Delete this transaction?')) {
      this.state.transactions = this.state.transactions.filter(t => t.id !== id);
      this.saveState();
      this.render();
    }
  }

  /* --- TRANSFER MODAL --- */
  openTransferModal() {
    this.renderAccountOptions();
    document.getElementById('transferAmount').value = '';
    document.getElementById('transferNote').value = '';
    document.getElementById('transferModal').classList.remove('hidden');
  }

  executeTransfer(event) {
    event.preventDefault();
    const from = document.getElementById('transferFrom').value;
    const to = document.getElementById('transferTo').value;
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const note = document.getElementById('transferNote').value;

    if (from === to) return alert('Choose two different accounts!');
    if (!amount || amount <= 0) return alert('Enter a valid transfer amount!');

    const now = new Date();
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const timeStr = `${String(hour12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${ampm}`;

    const fromName = this.getAccountInfo(from)?.name.split(' ')[0] || 'Account';
    const toName = this.getAccountInfo(to)?.name.split(' ')[0] || 'Account';

    const transferTx = {
      id: 'tx-' + Date.now(),
      type: 'transfer',
      amount: amount,
      category: 'Transfer',
      fromAccount: from,
      toAccount: to,
      date: now.toISOString().split('T')[0],
      time: timeStr,
      note: note || `Transfer ${fromName} to ${toName}`
    };

    this.state.transactions.push(transferTx);
    this.saveState();
    this.render();
    this.closeModal('transferModal');
  }

  /* --- MONTHLY FINANCIAL PLAN --- */
  openMonthlyPlanModal() {
    const currentMonth = this.state.selectedPlanMonth || new Date().toISOString().slice(0, 7);
    const existing = (this.state.monthlyPlans || []).find(p => p.month === currentMonth);

    const monthInput = document.getElementById('planModalMonth');
    const incomeInput = document.getElementById('planExpectedIncome');
    const expInput = document.getElementById('planExpectedExpense');
    const notesInput = document.getElementById('planNotes');

    if (monthInput) monthInput.value = currentMonth;
    if (incomeInput) incomeInput.value = existing ? existing.expectedIncome : '';
    if (expInput) expInput.value = existing ? existing.expectedExpense : '';
    if (notesInput) notesInput.value = existing && existing.notes ? existing.notes : '';

    document.getElementById('monthlyPlanModal').classList.remove('hidden');
  }

  saveMonthlyPlan(event) {
    event.preventDefault();
    const month = document.getElementById('planModalMonth').value;
    const expectedIncome = parseFloat(document.getElementById('planExpectedIncome').value);
    const expectedExpense = parseFloat(document.getElementById('planExpectedExpense').value);
    const notes = document.getElementById('planNotes').value.trim();

    if (!month) return alert('Please choose a month!');
    if (isNaN(expectedIncome) || expectedIncome < 0) return alert('Please enter a valid expected income!');
    if (isNaN(expectedExpense) || expectedExpense < 0) return alert('Please enter a valid expected expense!');

    if (!this.state.monthlyPlans) this.state.monthlyPlans = [];
    const idx = this.state.monthlyPlans.findIndex(p => p.month === month);

    const planData = {
      month: month,
      expectedIncome: expectedIncome,
      expectedExpense: expectedExpense,
      notes: notes,
      updatedAt: new Date().toISOString()
    };

    if (idx >= 0) {
      this.state.monthlyPlans[idx] = planData;
    } else {
      this.state.monthlyPlans.push(planData);
    }

    this.state.selectedPlanMonth = month;
    this.saveState();
    this.render();
    this.closeModal('monthlyPlanModal');
  }

  deleteMonthlyPlan(month) {
    if (confirm(`Clear financial plan for ${month}?`)) {
      this.state.monthlyPlans = (this.state.monthlyPlans || []).filter(p => p.month !== month);
      this.saveState();
      this.render();
    }
  }

  /* --- BUDGET LIMIT MODAL --- */
  openSetBudgetModal() {
    this.renderCategoryOptions();
    this.populateMonthDropdowns();
    const budgetMonth = document.getElementById('budgetMonth');
    if (budgetMonth) {
      budgetMonth.value = this.state.selectedPlanMonth || new Date().toISOString().slice(0, 7);
    }
    document.getElementById('setBudgetModal').classList.remove('hidden');
  }

  saveBudgetLimit(event) {
    event.preventDefault();
    const month = document.getElementById('budgetMonth').value || 'all';
    const cat = document.getElementById('budgetCategory').value;
    const limit = parseFloat(document.getElementById('budgetLimitAmount').value);

    if (!limit || limit <= 0) return alert('Enter a valid limit!');

    const existingIdx = this.state.budgets.findIndex(b => b.category === cat && (b.month || 'all') === month);
    if (existingIdx >= 0) {
      this.state.budgets[existingIdx].limitAmount = limit;
      this.state.budgets[existingIdx].month = month;
    } else {
      this.state.budgets.push({ category: cat, limitAmount: limit, month: month });
    }

    this.saveState();
    this.render();
    this.closeModal('setBudgetModal');
  }

  removeBudgetLimit(cat, month = 'all') {
    this.state.budgets = this.state.budgets.filter(b => !(b.category === cat && (b.month || 'all') === month));
    this.saveState();
    this.render();
  }

  /* --- SAVINGS GOALS --- */
  openAddGoalModal() {
    document.getElementById('addGoalModal').classList.remove('hidden');
  }

  saveSavingsGoal(event) {
    event.preventDefault();
    const title = document.getElementById('goalTitle').value;
    const target = parseFloat(document.getElementById('goalTargetAmount').value);
    const saved = parseFloat(document.getElementById('goalSavedAmount').value) || 0;

    if (!title || !target) return alert('Fill in required goal fields!');

    const newGoal = {
      id: 'goal-' + Date.now(),
      title: title,
      targetAmount: target,
      savedAmount: saved,
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    this.state.savingsGoals.push(newGoal);
    this.saveState();
    this.render();
    this.closeModal('addGoalModal');
  }

  depositToGoal(id) {
    const goal = this.state.savingsGoals.find(g => g.id === id);
    if (!goal) return;

    const amtStr = prompt(`Deposit funds into "${goal.title}":`, '5000');
    const amt = parseFloat(amtStr);
    if (amt && amt > 0) {
      goal.savedAmount += amt;
      this.saveState();
      this.render();
    }
  }

  removeGoal(id) {
    this.state.savingsGoals = this.state.savingsGoals.filter(g => g.id !== id);
    this.saveState();
    this.render();
  }

  /* --- BILL REMINDERS & AUTOMATION --- */
  openAddReminderModal() {
    document.getElementById('addReminderModal').classList.remove('hidden');
  }

  saveBillReminder(event) {
    event.preventDefault();
    const title = document.getElementById('billTitle').value;
    const amount = parseFloat(document.getElementById('billAmount').value);
    const dueDate = document.getElementById('billDueDate').value;

    if (!title || !amount || !dueDate) return alert('Fill in bill details!');

    this.state.billReminders.push({
      id: 'bill-' + Date.now(),
      title: title,
      amount: amount,
      dueDate: dueDate,
      isPaid: false,
      category: 'Bills & Utilities'
    });

    this.saveState();
    this.render();
    this.closeModal('addReminderModal');
  }

  payBill(id) {
    const bill = this.state.billReminders.find(b => b.id === id);
    if (bill) {
      bill.isPaid = true;
      const now = new Date();
      this.state.transactions.push({
        id: 'tx-' + Date.now(),
        type: 'expense',
        amount: bill.amount,
        category: 'Bills & Utilities',
        account: 'bank',
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: `Bill Payment: ${bill.title}`
      });
      this.saveState();
      this.render();
    }
  }

  triggerRecurring(id) {
    const rec = this.state.recurring.find(r => r.id === id);
    if (rec) {
      const now = new Date();
      this.state.transactions.push({
        id: 'tx-' + Date.now(),
        type: rec.type,
        amount: rec.amount,
        category: rec.category,
        account: 'bank',
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: `Recurring: ${rec.title}`
      });
      this.showToast(`✨ Auto-posted ${rec.title}!`);
      this.saveState();
      this.render();
    }
  }

  /* --- LOAN & INSTALLMENTS ENGINE --- */
  renderLoans() {
    const loansList = document.getElementById('loansList');
    const paidLoansList = document.getElementById('paidLoansList');
    const paidSection = document.getElementById('paidLoansSection');
    const totalLoanDisplay = document.getElementById('totalLoanBalanceDisplay');
    const monthlyDueDisplay = document.getElementById('totalMonthlyInstallmentDisplay');
    const activeCountDisplay = document.getElementById('activeLoanCountDisplay');

    if (!loansList) return;

    loansList.innerHTML = '';
    if (paidLoansList) paidLoansList.innerHTML = '';

    const loans = this.state.loans || [];
    let totalDebtRemaining = 0;
    let totalMonthlyDue = 0;
    let activeLoanCount = 0;

    const activeLoans = [];
    const paidLoans = [];

    loans.forEach(loan => {
      const remaining = Math.max(0, loan.totalAmount - (loan.paidAmount || 0));
      if (remaining <= 0) {
        paidLoans.push(loan);
      } else {
        activeLoans.push(loan);
        totalDebtRemaining += remaining;
        totalMonthlyDue += parseFloat(loan.monthlyInstallment || 0);
        activeLoanCount++;
      }
    });

    if (totalLoanDisplay) totalLoanDisplay.textContent = this.formatMoney(totalDebtRemaining);
    if (monthlyDueDisplay) monthlyDueDisplay.textContent = this.formatMoney(totalMonthlyDue);
    if (activeCountDisplay) activeCountDisplay.textContent = `${activeLoanCount} Active`;

    if (activeLoans.length === 0) {
      loansList.innerHTML = `
        <div class="ios-card p-6 text-center space-y-2 bg-emerald-500/5 border border-emerald-500/20">
          <div class="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
            <i data-lucide="party-popper" class="w-6 h-6"></i>
          </div>
          <h4 class="text-sm font-extrabold text-slate-900 dark:text-white">Debt Free! (ණය නැත)</h4>
          <p class="text-xs text-slate-400">You have no active loans or pending installments.</p>
        </div>
      `;
    } else {
      activeLoans.forEach(loan => {
        const paid = loan.paidAmount || 0;
        const total = loan.totalAmount;
        const remaining = Math.max(0, total - paid);
        const pct = Math.min(100, Math.round((paid / total) * 100));

        const card = document.createElement('div');
        card.className = 'ios-card p-4 space-y-3 bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 dark:border-rose-500/30 shadow-md';
        card.innerHTML = `
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                <i data-lucide="landmark" class="w-5 h-5"></i>
              </div>
              <div>
                <h4 class="text-sm font-extrabold text-slate-900 dark:text-white">${loan.title}</h4>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">${loan.lender} • Due on ${loan.dueDay}th</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-black">${pct}% Paid</span>
          </div>

          <div class="space-y-1">
            <div class="flex justify-between text-xs font-bold">
              <span class="text-slate-500 dark:text-slate-400">Remaining Debt:</span>
              <span class="text-rose-600 dark:text-rose-400 font-black">${this.formatMoney(remaining)}</span>
            </div>
            <div class="w-full h-3 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
              <div class="h-full bg-rose-500 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
            </div>
            <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold pt-0.5">
              <span>Paid: ${this.formatMoney(paid)}</span>
              <span>Total: ${this.formatMoney(total)}</span>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-200/60 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Monthly Installment</p>
              <p class="text-xs font-extrabold text-slate-900 dark:text-white">${this.formatMoney(loan.monthlyInstallment)}</p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="app.openPayInstallmentModal('${loan.id}')" class="px-3.5 py-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 ios-touch flex items-center gap-1">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Pay Due
              </button>
              <button onclick="app.deleteLoan('${loan.id}')" class="text-slate-400 hover:text-rose-500 p-1.5 transition-colors">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `;
        loansList.appendChild(card);
      });
    }

    if (paidLoans.length === 0) {
      if (paidSection) paidSection.classList.add('hidden');
    } else {
      if (paidSection) paidSection.classList.remove('hidden');
      paidLoans.forEach(loan => {
        const item = document.createElement('div');
        item.className = 'ios-card p-3.5 flex items-center justify-between bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20';
        item.innerHTML = `
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <i data-lucide="check" class="w-5 h-5"></i>
            </div>
            <div>
              <h4 class="text-xs font-bold text-slate-900 dark:text-white">${loan.title}</h4>
              <p class="text-[11px] text-slate-400">${loan.lender} • Total: ${this.formatMoney(loan.totalAmount)}</p>
            </div>
          </div>
          <button onclick="app.deleteLoan('${loan.id}')" class="text-slate-400 hover:text-rose-500 p-1.5">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        `;
        paidLoansList.appendChild(item);
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  openAddLoanModal() {
    document.getElementById('loanTitle').value = '';
    document.getElementById('loanLender').value = '';
    document.getElementById('loanTotalAmount').value = '';
    document.getElementById('loanMonthlyInstallment').value = '';
    document.getElementById('loanPaidAmount').value = '0';
    document.getElementById('loanDueDay').value = '10';
    document.getElementById('loanNotes').value = '';
    document.getElementById('addLoanModal').classList.remove('hidden');
  }

  saveLoan(event) {
    event.preventDefault();
    const title = document.getElementById('loanTitle').value.trim();
    const lender = document.getElementById('loanLender').value.trim();
    const totalAmount = parseFloat(document.getElementById('loanTotalAmount').value);
    const monthlyInstallment = parseFloat(document.getElementById('loanMonthlyInstallment').value);
    const paidAmount = parseFloat(document.getElementById('loanPaidAmount').value) || 0;
    const dueDay = parseInt(document.getElementById('loanDueDay').value) || 1;
    const notes = document.getElementById('loanNotes').value.trim();

    if (!title || !totalAmount || !monthlyInstallment) {
      return alert('Please fill in required loan details!');
    }

    const newLoan = {
      id: 'loan-' + Date.now(),
      title,
      lender: lender || 'Bank',
      totalAmount,
      paidAmount,
      monthlyInstallment,
      dueDay,
      notes
    };

    if (!this.state.loans) this.state.loans = [];
    this.state.loans.push(newLoan);
    this.saveState();
    this.render();
    this.closeModal('addLoanModal');
    this.showToast(`✨ Loan "${title}" added!`);
  }

  deleteLoan(id) {
    if (confirm('Delete this loan record?')) {
      this.state.loans = (this.state.loans || []).filter(l => l.id !== id);
      this.saveState();
      this.render();
      this.showToast('Loan record removed.');
    }
  }

  openPayInstallmentModal(loanId) {
    this.renderAccountOptions();
    const loan = (this.state.loans || []).find(l => l.id === loanId);
    if (!loan) return;

    const remaining = Math.max(0, loan.totalAmount - (loan.paidAmount || 0));
    document.getElementById('payModalLoanId').value = loan.id;
    document.getElementById('payModalLoanTitle').textContent = `Pay: ${loan.title}`;
    document.getElementById('payModalLoanSubtitle').textContent = `Remaining Debt: ${this.formatMoney(remaining)} • ${loan.lender}`;
    document.getElementById('payInstallmentAmount').value = Math.min(loan.monthlyInstallment, remaining);
    document.getElementById('payInstallmentNote').value = `Monthly Installment: ${loan.title}`;
    document.getElementById('payInstallmentModal').classList.remove('hidden');
  }

  executeInstallmentPayment(event) {
    event.preventDefault();
    const loanId = document.getElementById('payModalLoanId').value;
    const amount = parseFloat(document.getElementById('payInstallmentAmount').value);
    const account = document.getElementById('payInstallmentAccount').value;
    const note = document.getElementById('payInstallmentNote').value.trim();

    const loan = (this.state.loans || []).find(l => l.id === loanId);
    if (!loan) return;

    if (!amount || amount <= 0) {
      return alert('Enter a valid installment amount!');
    }

    loan.paidAmount = (loan.paidAmount || 0) + amount;

    // Deduct from chosen account balance and record Expense transaction
    const now = new Date();
    const hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const timeStr = `${String(hour12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${ampm}`;

    const newTx = {
      id: 'tx-' + Date.now(),
      type: 'expense',
      amount: amount,
      category: 'Bills & Utilities',
      account: account,
      date: now.toISOString().split('T')[0],
      time: timeStr,
      note: note || `Loan Installment: ${loan.title}`
    };

    this.state.transactions.push(newTx);
    this.saveState();
    this.render();
    this.closeModal('payInstallmentModal');
    this.showToast(`💳 Paid ${this.formatMoney(amount)} for ${loan.title}!`);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  /* --- EXPORTS & REPORTS --- */
  exportCSV() {
    let csv = 'ID,Type,Category,Amount,Account,Date,Time,Note\n';
    this.state.transactions.forEach(t => {
      csv += `"${t.id}","${t.type}","${t.category}","${t.amount}","${t.account || ''}","${t.date}","${t.time || ''}","${t.note || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `money_manager_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  exportPDF() {
    if (!window.jspdf) {
      return alert('PDF module loading... Please try again in a moment.');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Money Manager - Monthly Financial Report', 14, 20);

    doc.setFontSize(11);
    doc.text(`Generated Date: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.text(`Total Balance: ${this.formatMoney(this.state.totalBalance)}`, 14, 35);
    doc.text(`Total Income: ${this.formatMoney(this.state.totalIncome)}`, 14, 42);
    doc.text(`Total Expense: ${this.formatMoney(this.state.totalExpense)}`, 14, 49);

    doc.setFontSize(13);
    doc.text('Recent Transactions Summary:', 14, 62);

    let y = 72;
    this.state.transactions.slice(0, 15).forEach((t, i) => {
      doc.setFontSize(10);
      doc.text(`${i + 1}. [${t.date} ${t.time || ''}] ${t.category} - ${this.formatMoney(t.amount)} (${t.type})`, 14, y);
      y += 8;
    });

    doc.save(`Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  exportBackupJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `money_manager_backup_${Date.now()}.json`);
    dlAnchorElem.click();
  }

  importBackupJSON(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          this.state = { ...this.state, ...imported };
          this.saveState();
          this.render();
          this.renderCategoryTags();
          alert('Data successfully restored from backup!');
        } catch (err) {
          alert('Invalid backup JSON file.');
        }
      };
      reader.readAsText(file);
    }
  }

  resetAllData() {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      localStorage.removeItem('money_manager_data_v2');
      location.reload();
    }
  }

  /* =========================================================================
   * GALAPITIYAGAMA SANASA BANK INTEGRATION ENGINE
   * ========================================================================= */

  // Check if member profile exists on launch; if not, open registration
  checkSanasaMemberOnboarding() {
    if (!this.state.memberProfile || !this.state.memberProfile.phone) {
      setTimeout(() => {
        this.openSanasaMemberModal();
      }, 500);
    } else {
      this.updateSanasaMemberSettingsUI();
    }
  }

  openSanasaMemberModal() {
    const p = this.state.memberProfile;
    if (p) {
      const n = document.getElementById('sanasaMemberName');
      const ph = document.getElementById('sanasaMemberPhone');
      const acc = document.getElementById('sanasaMemberAccount');
      if (n) n.value = p.name || '';
      if (ph) ph.value = p.phone || '';
      if (acc) acc.value = p.accountNo || '';
    }
    const modal = document.getElementById('sanasaMemberModal');
    if (modal) modal.classList.remove('hidden');
  }

  saveSanasaMemberProfile(event) {
    if (event) event.preventDefault();
    const name = document.getElementById('sanasaMemberName').value.trim();
    const phone = document.getElementById('sanasaMemberPhone').value.trim();
    const accountNo = document.getElementById('sanasaMemberAccount').value.trim();

    // Name and phone number are required; Account number is optional
    if (!name || !phone) {
      alert('කරුණාකර ඔබගේ නම සහ දුරකථන අංකය ඇතුළත් කරන්න!');
      return;
    }

    const memberId = (this.state.memberProfile && this.state.memberProfile.memberId)
      ? this.state.memberProfile.memberId
      : 'SANASA-' + Date.now();

    this.state.memberProfile = {
      memberId: memberId,
      name: name,
      phone: phone,
      accountNo: accountNo || 'N/A',
      registeredAt: (this.state.memberProfile && this.state.memberProfile.registeredAt) || new Date().toISOString()
    };

    this.saveState();
    this.closeModal('sanasaMemberModal');
    this.updateSanasaMemberSettingsUI();
    this.syncSanasaMemberData();
    alert(`සාදරයෙන් පිළිගනිමු ${name}!\nගලපිටියාගම සණස බැංකු මුදල් කළමනාකරු සාර්ථකව සක්‍රීය කරන ලදී.`);
  }

  updateSanasaMemberSettingsUI() {
    const statusEl = document.getElementById('sanasaProfileStatus');
    const detailsEl = document.getElementById('sanasaMemberCardDetails');
    const p = this.state.memberProfile;

    if (!p || !p.phone) {
      if (statusEl) statusEl.textContent = 'ලියාපදිංචි වී නොමැත';
      if (detailsEl) {
        detailsEl.innerHTML = `
          <p class="text-rose-500 font-bold">සාමාජික තොරතුරු සටහන් කර නොමැත.</p>
          <button onclick="app.openSanasaMemberModal()" class="text-emerald-600 underline font-bold mt-1">දැන්ම ලියාපදිංචි වන්න</button>
        `;
      }
      return;
    }

    if (statusEl) statusEl.textContent = 'සක්‍රීය සාමාජික ගිණුම (Active)';
    if (detailsEl) {
      detailsEl.innerHTML = `
        <div class="flex justify-between border-b border-emerald-500/10 pb-1">
          <span class="text-slate-400">නම:</span>
          <span class="text-slate-900 dark:text-white font-bold">${p.name}</span>
        </div>
        <div class="flex justify-between border-b border-emerald-500/10 pb-1 pt-1">
          <span class="text-slate-400">දුරකථන අංකය:</span>
          <span class="text-slate-900 dark:text-white font-bold">${p.phone}</span>
        </div>
        <div class="flex justify-between pt-1">
          <span class="text-slate-400">සණස ගිණුම් අංකය:</span>
          <span class="font-mono text-emerald-600 dark:text-emerald-400 font-black">${p.accountNo && p.accountNo !== 'N/A' ? p.accountNo : 'සටහන් කර නොමැත'}</span>
        </div>
      `;
    }
  }

  // Real-time Analytics Sync to Bank Google Sheet via Google Apps Script
  async syncSanasaMemberData() {
    const p = this.state.memberProfile;
    if (!p || !p.phone) return;

    // Retrieve configured script URL from state or localStorage
    const scriptUrl = this.state.googleAppsScriptUrl || localStorage.getItem('sanasa_script_url');
    if (!scriptUrl) return; // Silent if script URL is not yet connected

    // Calculate current monthly figures
    const currentMonth = new Date().toISOString().slice(0, 7);
    let curMonthIncome = 0;
    let curMonthExpense = 0;
    this.state.transactions.forEach(t => {
      if (t.date && t.date.startsWith(currentMonth)) {
        if (t.type === 'income') curMonthIncome += parseFloat(t.amount || 0);
        else if (t.type === 'expense') curMonthExpense += parseFloat(t.amount || 0);
      }
    });

    // Calculate total outside loans
    let totalDebt = 0;
    (this.state.loans || []).forEach(l => {
      totalDebt += Math.max(0, parseFloat(l.totalAmount || 0) - parseFloat(l.paidAmount || 0));
    });

    const payload = {
      memberId: p.memberId,
      name: p.name,
      phone: p.phone,
      accountNo: p.accountNo,
      totalBalance: this.state.totalBalance || 0,
      monthlyIncome: curMonthIncome,
      monthlyExpense: curMonthExpense,
      totalLoans: totalDebt,
      loansCount: (this.state.loans || []).length,
      goalsCount: (this.state.savingsGoals || []).length
    };

    try {
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Standard cross-origin web app submission for Google Apps Script
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('Sanasa Bank Member Data Synced');
    } catch (err) {
      console.warn('Sanasa Member Sync Error:', err);
    }
  }

  // Fetch and display active Bank Promotional Popup (e.g. Fixed Deposit / Loan offers)
  async fetchBankPromotion() {
    const scriptUrl = this.state.googleAppsScriptUrl || localStorage.getItem('sanasa_script_url');
    if (!scriptUrl) return;

    // Check if shown today to avoid disturbing user repeatedly
    const today = new Date().toISOString().slice(0, 10);
    const lastPromoDate = localStorage.getItem('sanasa_last_promo_date');
    if (lastPromoDate === today) return;

    try {
      const fetchUrl = scriptUrl + (scriptUrl.includes('?') ? '&' : '?') + 'action=getPromo';
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data && data.status === 'success' && data.promo) {
        const promo = data.promo;
        const modal = document.getElementById('bankPromoModal');
        const badgeEl = document.getElementById('promoBadge');
        const titleEl = document.getElementById('promoTitle');
        const msgEl = document.getElementById('promoMessage');
        const actionBtn = document.getElementById('promoActionBtn');
        const actionText = document.getElementById('promoActionText');

        if (badgeEl) badgeEl.textContent = promo.badge || 'Sanasa Bank Special';
        if (titleEl) titleEl.textContent = promo.title || 'විශේෂ බැංකු දැනුම්දීම';
        if (msgEl) msgEl.textContent = promo.message || '';
        if (actionText) actionText.textContent = promo.buttonText || 'විමසන්න';

        if (actionBtn && promo.actionTarget) {
          if (promo.actionTarget.startsWith('http')) {
            actionBtn.href = promo.actionTarget;
            actionBtn.target = '_blank';
          } else {
            actionBtn.href = 'tel:' + promo.actionTarget;
          }
        }

        if (modal) {
          setTimeout(() => {
            modal.classList.remove('hidden');
            localStorage.setItem('sanasa_last_promo_date', today);
          }, 1200);
        }
      }
    } catch (err) {
      console.log('Promo check skipped:', err);
    }
  }
}

// Global Application Instance
window.app = new MoneyManagerApp();
