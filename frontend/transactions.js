// Transaction logic for transactions.html page
const form = document.getElementById('transaction-form');
const tbody = document.getElementById('transactions-body');
let transactions = JSON.parse(localStorage.getItem('transactions') || '[]');

function renderTransactions() {
    tbody.innerHTML = '';
    transactions.forEach((t, i) => {
        const tr = document.createElement('tr');
        if (t.editing) {
            tr.innerHTML = `
                <td><input type="text" value="${t.desc}" class="edit-desc"></td>
                <td><input type="number" value="${t.amount}" class="edit-amount"></td>
                <td>
                    <select class="edit-category">
                        <option value="Education" ${t.category==='Education'?'selected':''}>Education</option>
                        <option value="Food" ${t.category==='Food'?'selected':''}>Food</option>
                        <option value="Clothes" ${t.category==='Clothes'?'selected':''}>Clothes</option>
                        <option value="Transport" ${t.category==='Transport'?'selected':''}>Transport</option>
                        <option value="Entertainment" ${t.category==='Entertainment'?'selected':''}>Entertainment</option>
                        <option value="Other" ${t.category==='Other'?'selected':''}>Other</option>
                    </select>
                </td>
                <td>
                    <button class="save-btn">Save</button>
                    <button class="cancel-btn">Cancel</button>
                </td>
            `;
        } else {
            tr.innerHTML = `
                <td>${t.desc}</td>
                <td>${t.amount}</td>
                <td>${t.category}</td>
                <td>
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </td>
            `;
        }
        tbody.appendChild(tr);
        // Edit
        if (!t.editing) {
            tr.querySelector('.edit-btn').onclick = () => {
                transactions[i].editing = true;
                renderTransactions();
            };
            tr.querySelector('.delete-btn').onclick = () => {
                transactions.splice(i, 1);
                saveTransactions();
                renderTransactions();
            };
        } else {
            tr.querySelector('.save-btn').onclick = () => {
                const desc = tr.querySelector('.edit-desc').value.trim();
                const amount = parseFloat(tr.querySelector('.edit-amount').value);
                const category = tr.querySelector('.edit-category').value;
                if (!desc || isNaN(amount) || !category) return alert('Fill all fields!');
                transactions[i] = { desc, amount, category };
                saveTransactions();
                renderTransactions();
            };
            tr.querySelector('.cancel-btn').onclick = () => {
                transactions[i].editing = false;
                renderTransactions();
            };
        }
    });
}

function saveTransactions() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

form.onsubmit = function(e) {
    e.preventDefault();
    const desc = document.getElementById('trans-desc').value.trim();
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const category = document.getElementById('trans-category').value;
    if (!desc || isNaN(amount) || !category) return alert('Fill all fields!');
    transactions.push({ desc, amount, category });
    saveTransactions();
    renderTransactions();
    form.reset();
};

renderTransactions();
