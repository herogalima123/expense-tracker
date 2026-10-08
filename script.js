const STORAGE_KEY = "expenses";

const form = document.getElementById("expense-form");
const dateInput = document.getElementById("date");
const categoryInput = document.getElementById("category");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const formError = document.getElementById("form-error");
const listBody = document.getElementById("expense-list");
const emptyState = document.getElementById("empty-state");
const summaryEl = document.getElementById("summary");

let expenses = loadExpenses();

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;
dateInput.max = today;

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
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

render();
