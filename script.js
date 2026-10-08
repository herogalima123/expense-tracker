const USERS_KEY = "et_users";
const SESSION_KEY = "et_session";
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
const logoutBtn = document.getElementById("logout-btn");

const form = document.getElementById("expense-form");
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

function startApp(username) {
  currentUser = username;
  setSession(username);
  currentUserEl.textContent = username;
  authScreen.hidden = true;
  appScreen.hidden = false;

  migrateLegacyData();
  expenses = loadExpenses();

  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
  dateInput.max = today;

  render();
}

function endApp() {
  currentUser = null;
  expenses = [];
  clearSession();
  appScreen.hidden = true;
  authScreen.hidden = true;
  switchTab("login");
  authScreen.hidden = false;
}

function expenseKey() {
  return `expenses:${currentUser}`;
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
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
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
    categoryCell.textContent = expense.category;

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
}

function renderSummary() {
  summaryEl.innerHTML = "";

  if (expenses.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No expenses yet.";
    summaryEl.appendChild(empty);
    return;
  }

  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const byCategory = {};
  for (const expense of expenses) {
    byCategory[expense.category] =
      (byCategory[expense.category] || 0) + Number(expense.amount);
  }

  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  const totalRow = document.createElement("div");
  totalRow.className = "summary-total";
  totalRow.innerHTML = `<span>Total spent</span><span class="amount">${formatAmount(total)}</span>`;

  const list = document.createElement("ul");
  list.className = "summary-list";
  for (const [category, amount] of categories) {
    const item = document.createElement("li");
    item.innerHTML = `<span class="cat">${category}</span><span>${formatAmount(amount)}</span>`;
    list.appendChild(item);
  }

  summaryEl.append(totalRow, list);
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
