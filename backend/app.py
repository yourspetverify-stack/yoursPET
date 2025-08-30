from flask import Flask, request, jsonify, session
from flask_session import Session
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import random
import smtplib
from email.mime.text import MIMEText
import time
import re
import os

app = Flask(__name__)
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)
CORS(app)

# PostgreSQL config
def get_db():
    return psycopg2.connect(
        host=os.environ['DB_HOST'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        dbname=os.environ['DB_NAME']
    )

def init_db():
    db = get_db()
    cursor = db.cursor()
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL
        )
    ''')
    # Budgets table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS budgets (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    # Transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            description VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    # Reports table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    # Notifications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    db.commit()
    cursor.close()
    db.close()

init_db()

# In-memory store for OTPs: { email: (otp, expiry_time) }
otp_store = {}
OTP_EXPIRY_SECONDS = 300  # 5 minutes

SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
SMTP_USER = 'yourspetverify@gmail.com'
SMTP_PASS = 'stlwfkftuvdujrtz'

def send_email(to_email, subject, body):
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = SMTP_USER
    msg['To'] = to_email
    server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
    server.starttls()
    server.login(SMTP_USER, SMTP_PASS)
    server.sendmail(SMTP_USER, to_email, msg.as_string())
    server.quit()

# --- Helper ---
def get_user_id_by_email(email, cursor=None):
    if cursor is None:
        db = get_db()
        cursor = db.cursor()
        close_db = True
    else:
        close_db = False
    cursor.execute('SELECT id FROM users WHERE email=%s', (email,))
    row = cursor.fetchone()
    if close_db:
        cursor.close()
        db.close()
    if row:
        return row[0]
    return None

# --- OTP Endpoints ---
@app.route('/send-otp', methods=['POST'])
def send_otp():
    data = request.json
    email = data.get('email')
    purpose = data.get('purpose')  # 'signup' or 'forgot'
    if not email or purpose not in ['signup', 'forgot']:
        return jsonify({'success': False, 'message': 'Invalid request'}), 400

    db = get_db()
    cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT username FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    cursor.close()
    db.close()

    if purpose == 'signup' and user:
        return jsonify({'success': False, 'message': 'Email already registered'}), 400
    if purpose == 'forgot' and not user:
        return jsonify({'success': False, 'message': 'Email not found'}), 404

    otp = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    otp_store[email] = (otp, int(time.time()) + OTP_EXPIRY_SECONDS)

    if purpose == 'forgot':
        body = f"Your OTP for password reset is: {otp} (username: {user['username']})\nThis OTP is valid for 5 minutes."
    else:
        body = f"Your OTP for registration is: {otp}\nThis OTP is valid for 5 minutes."
    try:
        send_email(email, "YoursPET OTP", body)
    except Exception as e:
        return jsonify({'success': False, 'message': f'Failed to send email: {str(e)}'}), 500
    return jsonify({'success': True, 'message': 'OTP sent'})

@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    email = data.get('email')
    otp = data.get('otp')
    if not email or not otp:
        return jsonify({'success': False, 'message': 'Email and OTP required'}), 400
    stored = otp_store.get(email)
    if not stored:
        return jsonify({'success': False, 'message': 'No OTP found'}), 400
    real_otp, expiry = stored
    if int(time.time()) > expiry:
        del otp_store[email]
        return jsonify({'success': False, 'message': 'OTP expired'}), 400
    if otp != real_otp:
        return jsonify({'success': False, 'message': 'Invalid OTP'}), 400
    del otp_store[email]
    return jsonify({'success': True, 'message': 'OTP verified'})

# --- Registration ---
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    username = data.get('username')
    password = data.get('password')
    db = get_db()
    cursor = db.cursor()
    cursor.execute('INSERT INTO users (email, username, password) VALUES (%s, %s, %s)', (email, username, password))
    db.commit()
    cursor.close()
    db.close()
    return jsonify(success=True)

# --- Login ---
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    db = get_db()
    cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT id, password, email FROM users WHERE username=%s', (username,))
    user = cursor.fetchone()
    cursor.close()
    db.close()
    if not user or user['password'] != password:
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
    session['email'] = user['email']
    return jsonify({'success': True, 'email': user['email']})

# --- Forgot Password & Reset ---
@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    email = data.get('email')
    new_password = data.get('new_password')
    if not email or not new_password:
        return jsonify({'success': False, 'message': 'Email and new password required'}), 400
    if (len(new_password) < 8 or
        not re.search(r'[!@#$%^&*(),.?":{}|<>]', new_password) or
        not re.search(r'[a-z]', new_password) or
        not re.search(r'[A-Z]', new_password) or
        not re.search(r'[0-9]', new_password)):
        return jsonify({'success': False, 'message': 'Password does not meet requirements'}), 400
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'success': False, 'message': 'User not found'}), 404
    cursor.execute('UPDATE users SET password=%s WHERE email=%s', (new_password, email))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({'success': True, 'message': 'Password reset successful'})

# --- Budgets ---
@app.route('/add-budget', methods=['POST'])
def add_budget():
    data = request.get_json()
    email = data.get('email')
    name = data.get('name')
    amount = data.get('amount')
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'success': False, 'message': 'User not found'}), 404
    user_id = user[0]
    cursor.execute('SELECT id FROM budgets WHERE user_id=%s AND name=%s', (user_id, name))
    budget = cursor.fetchone()
    if budget:
        cursor.execute('UPDATE budgets SET amount=%s WHERE id=%s', (amount, budget[0]))
    else:
        cursor.execute('INSERT INTO budgets (user_id, name, amount) VALUES (%s, %s, %s)', (user_id, name, amount))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({'success': True, 'message': 'Budget updated'})

@app.route('/get-budgets', methods=['POST'])
def get_budgets():
    data = request.get_json()
    email = data.get('email')
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify(success=False, budgets=[])
    user_id = user[0]
    cursor.execute('SELECT name, amount FROM budgets WHERE user_id=%s', (user_id,))
    budgets = cursor.fetchall()
    cursor.close()
    db.close()
    result = [{'name': b[0], 'amount': b[1]} for b in budgets]
    return jsonify(success=True, budgets=result)

# --- Transactions ---
@app.route('/add-transaction', methods=['POST'])
def add_transaction():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify(success=False, message='No email provided')
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify(success=False, message='Invalid user')
    user_id = user[0]
    date = data.get('date')
    if date:
        cursor.execute(
            'INSERT INTO transactions (user_id, type, amount, description, created_at) VALUES (%s, %s, %s, %s, %s)',
            (user_id, data.get('type'), data.get('amount'), data.get('description'), date)
        )
    else:
        cursor.execute(
            'INSERT INTO transactions (user_id, type, amount, description) VALUES (%s, %s, %s, %s)',
            (user_id, data.get('type'), data.get('amount'), data.get('description'))
        )
    db.commit()
    cursor.close()
    db.close()
    return jsonify(success=True)

@app.route('/get-transactions', methods=['POST'])
def get_transactions():
    data = request.get_json()
    email = data.get('email')
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify(success=False, transactions=[])
    user_id = user[0]
    cursor.execute('SELECT id, description, amount, type, created_at FROM transactions WHERE user_id=%s', (user_id,))
    transactions = cursor.fetchall()
    cursor.close()
    db.close()
    result = [
        {
            'id': t[0],
            'description': t[1],
            'amount': t[2],
            'type': t[3],
            'created_at': t[4]
        }
        for t in transactions
    ]
    return jsonify(success=True, transactions=result)

# --- Reports ---
@app.route('/add-report', methods=['POST'])
def add_report():
    data = request.json
    email = data.get('email')
    title = data.get('title')
    content = data.get('content')
    if not email or not title or not content:
        return jsonify({'success': False, 'message': 'All fields required'}), 400
    user_id = get_user_id_by_email(email)
    if not user_id:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    db = get_db()
    cursor = db.cursor()
    cursor.execute('INSERT INTO reports (user_id, title, content) VALUES (%s, %s, %s)', (user_id, title, content))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({'success': True, 'message': 'Report added'})

@app.route('/get-reports', methods=['POST'])
def get_reports():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Email required'}), 400
    user_id = get_user_id_by_email(email)
    if not user_id:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    db = get_db()
    cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT id, title, content, created_at FROM reports WHERE user_id=%s', (user_id,))
    reports = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify({'success': True, 'reports': reports})

# --- Notifications ---
@app.route('/add-notification', methods=['POST'])
def add_notification():
    data = request.json
    email = data.get('email')
    message = data.get('message')
    if not email or not message:
        return jsonify({'success': False, 'message': 'All fields required'}), 400
    user_id = get_user_id_by_email(email)
    if not user_id:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    db = get_db()
    cursor = db.cursor()
    cursor.execute('INSERT INTO notifications (user_id, message) VALUES (%s, %s)', (user_id, message))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({'success': True, 'message': 'Notification added'})

@app.route('/get-notifications', methods=['POST'])
def get_notifications():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({'success': False, 'message': 'Email required'}), 400
    user_id = get_user_id_by_email(email)
    if not user_id:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    db = get_db()
    cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT id, message, is_read, created_at FROM notifications WHERE user_id=%s', (user_id,))
    notifications = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify({'success': True, 'notifications': notifications})

@app.route('/mark-notification-read', methods=['POST'])
def mark_notification_read():
    data = request.json
    email = data.get('email')
    notification_id = data.get('notification_id')
    if not email or not notification_id:
        return jsonify({'success': False, 'message': 'Email and notification ID required'}), 400
    user_id = get_user_id_by_email(email)
    if not user_id:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    db = get_db()
    cursor = db.cursor()
    cursor.execute('UPDATE notifications SET is_read=TRUE WHERE id=%s AND user_id=%s', (notification_id, user_id))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({'success': True, 'message': 'Notification marked as read'})

# --- Example Dashboard Endpoint ---
@app.route('/dashboard', methods=['POST'])
def dashboard():
    data = request.json
    email = data.get('email')
    user_id = get_user_id_by_email(email)
    if not user_id:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    db = get_db()
    cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT COUNT(*) AS budget_count FROM budgets WHERE user_id=%s', (user_id,))
    budget_count = cursor.fetchone()['budget_count']
    cursor.execute('SELECT COUNT(*) AS transaction_count FROM transactions WHERE user_id=%s', (user_id,))
    transaction_count = cursor.fetchone()['transaction_count']
    cursor.execute('SELECT COUNT(*) AS report_count FROM reports WHERE user_id=%s', (user_id,))
    report_count = cursor.fetchone()['report_count']
    cursor.close()
    db.close()
    return jsonify({
        'success': True,
        'dashboard': {
            'budget_count': budget_count,
            'transaction_count': transaction_count,
            'report_count': report_count
        }
    })

@app.route('/delete-transaction', methods=['POST'])
def delete_transaction():
    data = request.json
    email = data.get('email')
    transaction_id = data.get('transaction_id')
    db = get_db()
    cursor = db.cursor()
    user_id = get_user_id_by_email(email, cursor)
    if not user_id or not transaction_id:
        cursor.close()
        db.close()
        return jsonify({'success': False, 'message': 'Invalid request'}), 400
    cursor.execute('DELETE FROM transactions WHERE id=%s AND user_id=%s', (transaction_id, user_id))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({'success': True})

@app.route('/edit-transaction', methods=['POST'])
def edit_transaction():
    data = request.json
    email = data.get('email')
    transaction_id = data.get('transaction_id')
    description = data.get('description')
    amount = data.get('amount')
    category = data.get('category')
    db = get_db()
    cursor = db.cursor()
    user_id = get_user_id_by_email(email, cursor)
    if not user_id or not transaction_id or not description or not amount or not category:
        cursor.close()
        db.close()
        return jsonify({'success': False, 'message': 'Invalid request'}), 400
    cursor.execute('UPDATE transactions SET description=%s, amount=%s, type=%s WHERE id=%s AND user_id=%s',
                   (description, amount, category, transaction_id, user_id))
    db.commit()
    cursor.close()
    db.close()
    return jsonify({'success': True})

@app.route('/get-user', methods=['POST'])
def get_user():
    data = request.get_json()
    email = data.get('email')
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT username FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    cursor.close()
    db.close()
    if user:
        return jsonify(success=True, username=user[0])
    else:
        return jsonify(success=False)

@app.route('/get-user-profile', methods=['POST'])
def get_user_profile():
    data = request.get_json()
    email = data.get('email')
    db = get_db()
    cursor = db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute('SELECT username FROM users WHERE email=%s', (email,))
    profile = cursor.fetchone()
    cursor.close()
    db.close()
    if profile:
        return jsonify(success=True, profile=profile)
    return jsonify(success=False)

@app.route('/get-user-id', methods=['POST'])
def get_user_id():
    data = request.get_json()
    email = data.get('email')
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id FROM users WHERE email=%s', (email,))
    user = cursor.fetchone()
    cursor.close()
    db.close()
    if user:
        return jsonify(success=True, user_id=user[0])
    return jsonify(success=False)

@app.route('/')
def home():
    return "YoursPET API is running!"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)