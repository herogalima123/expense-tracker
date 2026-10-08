const USERS_KEY = "et_users";
const SESSION_KEY = "et_session";
const THEME_KEY = "et_theme";
const LEGACY_KEY = "expenses";

const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginError = document.getElementById("login-error");
const registerError = document.getElementById("register-error");
const currentUserEl = document.getElementById("current-user");
const userAvatar = document.getElementById("user-avatar");
const expenseCount = document.getElementById("expense-count");
const logoutBtn = document.getElementById("logout-btn");
const themeToggle = document.getElementById("theme-toggle");

const form = document.getElementById("expense-form");
const budgetForm = document.getElementById("budget-form");
const budgetAmountInput = document.getElementById("budget-amount");
const budgetPeriodInput = document.getElementById("budget-period");
const currencyInput = document.getElementById("currency");
const budgetError = document.getElementById("budget-error");
const budgetStatus = document.getElementById("budget-status");
const budgetPeriodLabel = document.getElementById("budget-period-label");
const budgetFigures = document.getElementById("budget-figures");
const budgetFill = document.getElementById("budget-fill");
const budgetNote = document.getElementById("budget-note");
const removeBudgetBtn = document.getElementById("remove-budget-btn");
const dateInput = document.getElementById("date");
const categoryInput = document.getElementById("category");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const formError = document.getElementById("form-error");
const listBody = document.getElementById("expense-list");
const emptyState = document.getElementById("empty-state");
const summaryEl = document.getElementById("summary");

let currentUser = null;
let expenses = [];
let currentCurrency = "USD";
let budget = null;

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(username) {
  localStorage.setItem(SESSION_KEY, username);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  if (window.crypto && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const input = `${salt}:${password}`;
  if (window.crypto && crypto.subtle && crypto.subtle.digest) {
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(input)
      );
      return Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0")
      ).join("");
    } catch {
      // fall through to simple hash
    }
  }
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

function showAuthError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function clearAuthErrors() {
  loginError.hidden = true;
  registerError.hidden = true;
}

function switchTab(tab) {
  clearAuthErrors();
  const isLogin = tab === "login";
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
}

tabLogin.addEventListener("click", () => switchTab("login"));
tabRegister.addEventListener("click", () => switchTab("register"));

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

let storedTheme = null;
try {
  storedTheme = localStorage.getItem(THEME_KEY);
} catch {
  storedTheme = null;
}
applyTheme(
  storedTheme ||
    (window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light")
);

themeToggle.addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // theme stays for this session only
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAuthErrors();

  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value;
  const confirm = document.getElementById("register-confirm").value;

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    showAuthError(registerError, "Username must be 3-20 letters, numbers, or underscores.");
    return;
  }
  if (password.length < 6) {
    showAuthError(registerError, "Password must be at least 6 characters.");
    return;
  }
  if (password !== confirm) {
    showAuthError(registerError, "Passwords do not match.");
    return;
  }

  const users = loadUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    showAuthError(registerError, "That username is already taken.");
    return;
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  users.push({ username, salt, hash });
  saveUsers(users);

  registerForm.reset();
  startApp(username);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAuthErrors();

  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  const users = loadUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    showAuthError(loginError, "Invalid username or password.");
    return;
  }

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.hash) {
    showAuthError(loginError, "Invalid username or password.");
    return;
  }

  loginForm.reset();
  startApp(user.username);
});

logoutBtn.addEventListener("click", () => {
  endApp();
});

budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  budgetError.hidden = true;

  const amount = parseFloat(budgetAmountInput.value);
  const period = budgetPeriodInput.value;

  if (!amount || amount <= 0) {
    budgetError.textContent = "Budget must be a positive number.";
    budgetError.hidden = false;
    return;
  }
  if (period !== "day" && period !== "week" && period !== "month") {
    budgetError.textContent = "Choose a period: day, week, or month.";
    budgetError.hidden = false;
    return;
  }

  budget = { amount, period };
  try {
    localStorage.setItem(budgetKey(), JSON.stringify(budget));
  } catch {
    budgetError.textContent = "Could not save budget. Browser storage is unavailable.";
    budgetError.hidden = false;
    return;
  }
  render();
});

currencyInput.addEventListener("change", () => {
  currentCurrency = currencyInput.value === "PHP" ? "PHP" : "USD";
  currencyInput.value = currentCurrency;
  try {
    localStorage.setItem(currencyKey(), currentCurrency);
  } catch {
    // currency applies for this session only
  }
  render();
});

removeBudgetBtn.addEventListener("click", () => {
  budget = null;
  try {
    localStorage.removeItem(budgetKey());
  } catch {
    // nothing stored to clear
  }
  budgetForm.reset();
  currencyInput.value = currentCurrency;
  budgetError.hidden = true;
  render();
});

function startApp(username) {
  currentUser = username;
  setSession(username);
  currentUserEl.textContent = username;
  userAvatar.textContent = username.charAt(0).toUpperCase();
  authScreen.hidden = true;
  appScreen.hidden = false;

  migrateLegacyData();
  expenses = loadExpenses();
  currentCurrency = loadCurrency();
  currencyInput.value = currentCurrency;
  budget = loadBudget();
  if (budget) {
    budgetAmountInput.value = budget.amount;
    budgetPeriodInput.value = budget.period;
  } else {
    budgetForm.reset();
    currencyInput.value = currentCurrency;
  }
  budgetError.hidden = true;

  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
  dateInput.max = today;

  render();
}

function endApp() {
  currentUser = null;
  expenses = [];
  budget = null;
  currentCurrency = "USD";
  clearSession();
  budgetForm.reset();
  budgetStatus.hidden = true;
  removeBudgetBtn.hidden = true;
  budgetError.hidden = true;
  syncSelects();
  appScreen.hidden = true;
  authScreen.hidden = true;
  switchTab("login");
  authScreen.hidden = false;
}

function expenseKey() {
  return `expenses:${currentUser}`;
}

function currencyKey() {
  return `currency:${currentUser}`;
}

function budgetKey() {
  return `budget:${currentUser}`;
}

function loadCurrency() {
  try {
    const value = localStorage.getItem(currencyKey());
    return value === "PHP" ? "PHP" : "USD";
  } catch {
    return "USD";
  }
}

function loadBudget() {
  try {
    const raw = localStorage.getItem(budgetKey());
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const amount = Number(stored && stored.amount);
    const period = stored && stored.period;
    if (!(amount > 0)) return null;
    if (period !== "day" && period !== "week" && period !== "month") return null;
    return { amount, period };
  } catch {
    return null;
  }
}

function migrateLegacyData() {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy && !localStorage.getItem(expenseKey())) {
    localStorage.setItem(expenseKey(), legacy);
  }
  localStorage.removeItem(LEGACY_KEY);
}

function loadExpenses() {
  try {
    const raw = localStorage.getItem(expenseKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(expenseKey(), JSON.stringify(expenses));
}

function formatAmount(value) {
  const locale = currentCurrency === "PHP" ? "en-PH" : "en-US";
  return Number(value).toLocaleString(locale, {
    style: "currency",
    currency: currentCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

function categoryClass(category) {
  return category.toLowerCase().replace(/[^a-z]/g, "");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = parseFloat(amountInput.value);
  const description = descriptionInput.value.trim();

  if (!amount || amount <= 0) {
    showError("Amount must be a positive number.");
    return;
  }
  if (!description) {
    showError("Description is required.");
    return;
  }
  if (!categoryInput.value) {
    showError("Please choose a category.");
    return;
  }

  expenses.push({
    id: Date.now(),
    date: dateInput.value,
    category: categoryInput.value,
    description,
    amount: amount.toFixed(2),
  });

  saveExpenses();
  render();
  form.reset();
  dateInput.value = new Date().toISOString().slice(0, 10);
  syncSelects();
  hideError();
});

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function hideError() {
  formError.hidden = true;
}

listBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = Number(button.dataset.delete);
  expenses = expenses.filter((expense) => expense.id !== id);
  saveExpenses();
  render();
});

function render() {
  renderList();
  renderSummary();
  renderBudget();
  syncSelects();
}

function renderList() {
  listBody.innerHTML = "";

  const sorted = [...expenses].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id
  );

  for (const expense of sorted) {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(expense.date);

    const categoryCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge badge-${categoryClass(expense.category)}`;
    badge.textContent = expense.category;
    categoryCell.appendChild(badge);

    const descriptionCell = document.createElement("td");
    descriptionCell.textContent = expense.description;

    const amountCell = document.createElement("td");
    amountCell.className = "num";
    amountCell.textContent = formatAmount(expense.amount);

    const actionCell = document.createElement("td");
    actionCell.className = "num";
    const deleteButton = document.createElement("button");
    deleteButton.className = "btn-delete";
    deleteButton.dataset.delete = expense.id;
    deleteButton.textContent = "Delete";
    actionCell.appendChild(deleteButton);

    row.append(dateCell, categoryCell, descriptionCell, amountCell, actionCell);
    listBody.appendChild(row);
  }

  emptyState.hidden = expenses.length > 0;
  expenseCount.hidden = expenses.length === 0;
  expenseCount.textContent = `${expenses.length} ${expenses.length === 1 ? "entry" : "entries"}`;
}

function renderSummary() {
  summaryEl.innerHTML = "";

  if (expenses.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No expenses yet. Your totals will appear here.";
    summaryEl.appendChild(empty);
    return;
  }

  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const average = total / expenses.length;

  const stats = document.createElement("div");
  stats.className = "stats";
  stats.innerHTML = `
    <div class="stat total">
      <span class="stat-label">Total</span>
      <span class="stat-value">${formatAmount(total)}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Entries</span>
      <span class="stat-value">${expenses.length}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Average</span>
      <span class="stat-value">${formatAmount(average)}</span>
    </div>`;

  const byCategory = {};
  for (const expense of expenses) {
    byCategory[expense.category] =
      (byCategory[expense.category] || 0) + Number(expense.amount);
  }

  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const max = categories[0][1];

  const bars = document.createElement("div");
  bars.className = "bars";

  for (const [category, amount] of categories) {
    const row = document.createElement("div");
    row.className = `bar-row bar-${categoryClass(category)}`;
    const width = Math.max(4, Math.round((amount / max) * 100));
    const share = Math.round((amount / total) * 100);
    row.innerHTML = `
      <div class="bar-head">
        <span class="cat">${category}</span>
        <span class="amt">${formatAmount(amount)} &middot; ${share}%</span>
      </div>
      <div class="track"><div class="fill" style="width: ${width}%"></div></div>`;
    bars.appendChild(row);
  }

  summaryEl.append(stats, bars);
}

function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function spentInPeriod(period) {
  const today = new Date();
  const todayStr = toISODate(today);
  let startStr;

  if (period === "day") {
    startStr = todayStr;
  } else if (period === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    startStr = toISODate(start);
  } else {
    startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  }

  return expenses
    .filter((expense) => expense.date >= startStr && expense.date <= todayStr)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
}

function renderBudget() {
  budgetStatus.hidden = !budget;
  removeBudgetBtn.hidden = !budget;
  if (!budget) return;

  const spent = spentInPeriod(budget.period);
  const remaining = budget.amount - spent;
  const percent = Math.min(100, (spent / budget.amount) * 100);
  const labels = { day: "Today", week: "This week", month: "This month" };

  budgetPeriodLabel.textContent = labels[budget.period];
  budgetFigures.textContent = `${formatAmount(spent)} of ${formatAmount(budget.amount)}`;
  budgetFill.style.width = `${percent}%`;

  const over = spent > budget.amount;
  budgetFill.classList.toggle("over", over);
  budgetNote.classList.toggle("over", over);
  budgetNote.textContent = over
    ? `Over budget by ${formatAmount(spent - budget.amount)}`
    : `${formatAmount(remaining)} left`;
}

function initCustomSelect(select) {
  const wrap = document.createElement("div");
  wrap.className = "select";
  select.classList.add("select-source");
  select.insertAdjacentElement("afterend", wrap);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "select-btn";
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.className = "select-label";
  const caret = document.createElement("span");
  caret.className = "select-caret";
  caret.textContent = "▾";
  btn.append(label, caret);

  const menu = document.createElement("ul");
  menu.className = "select-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;

  for (const option of select.options) {
    if (!option.value) continue;
    const item = document.createElement("li");
    item.setAttribute("role", "option");
    item.dataset.value = option.value;
    item.textContent = option.textContent;
    menu.appendChild(item);
  }

  wrap.append(btn, menu);

  function open() {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }

  function close() {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  function sync() {
    const selected = select.selectedOptions[0];
    label.textContent = selected ? selected.textContent : "";
    label.classList.toggle("placeholder", !select.value);
    for (const item of menu.children) {
      const isActive = item.dataset.value === select.value;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    }
  }

  btn.addEventListener("click", () => {
    if (menu.hidden) open();
    else close();
  });

  menu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-value]");
    if (!item) return;
    select.value = item.dataset.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    sync();
    close();
  });

  select.addEventListener("change", sync);

  document.addEventListener("click", (event) => {
    if (!wrap.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  sync();
  return { sync, close };
}

const customSelects = ["category", "budget-period", "currency"].map((id) =>
  initCustomSelect(document.getElementById(id))
);

function syncSelects() {
  for (const select of customSelects) select.sync();
}

function init() {
  const session = getSession();
  if (session) {
    const user = loadUsers().find(
      (u) => u.username.toLowerCase() === session.toLowerCase()
    );
    if (user) {
      startApp(user.username);
      return;
    }
    clearSession();
  }
  switchTab("login");
}

init();
