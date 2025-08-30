// Minimal login/signup handler using localStorage for demo
document.addEventListener('DOMContentLoaded', function() {
    var loginForm = document.getElementById('login-form');
    var signupForm = document.getElementById('signup-form');
    var mainSignupLink = document.getElementById('main-signup-link');
    var backToLoginLink = document.getElementById('back-to-login-link');

    if (mainSignupLink) {
        mainSignupLink.onclick = function(e) {
            e.preventDefault();
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
        };
    }
    if (backToLoginLink) {
        backToLoginLink.onclick = function(e) {
            e.preventDefault();
            signupForm.style.display = 'none';
            loginForm.style.display = 'block';
        };
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = loginForm.querySelector('input[type="text"]').value.trim();
        const password = loginForm.querySelector('input[type="password"]').value;
        try {
            const res = await fetch('https://yourspet.onrender.com/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('user_id', data.user_id);
                window.location.href = 'dashboard.html#notify';
            } else {
                alert(data.message || 'Invalid credentials or user not signed up!');
            }
        } catch (err) {
            alert('Login failed.');
        }
    });

    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = signupForm.querySelector('input[type="email"]').value.trim();
        const username = signupForm.querySelector('input[type="text"]').value.trim();
        const password = signupForm.querySelector('input[type="password"]').value;
        if (!email || !username || !password) {
            alert('Please fill all fields!');
            return;
        }
        // Password conditions: min 8 chars, 1 special, 1 lowercase, 1 uppercase, 1 number
        const pwdCond = [
            password.length >= 8,
            /[!@#$%^&*(),.?":{}|<>]/.test(password),
            /[a-z]/.test(password),
            /[A-Z]/.test(password),
            /[0-9]/.test(password)
        ];
        if (pwdCond.includes(false)) {
            alert('Password must be at least 8 characters and include one special character, one lowercase letter, one uppercase letter, and one number.');
            return;
        }

        // Send signup data to backend
        try {
            const res = await fetch('https://yourspet.onrender.com/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username, password })
            });
            const data = await res.json();
            if (data.success) {
                alert('Sign up successful! Please log in.');
                signupForm.style.display = 'none';
                loginForm.style.display = 'block';
            } else {
                alert(data.message || 'Sign up failed.');
            }
        } catch (err) {
            alert('Sign up failed.');
        }
    });

    // Example for signup page
    const sendOtpBtn = document.getElementById('signup-send-otp-btn');
    if (sendOtpBtn) {
        sendOtpBtn.onclick = async function() {
            const email = document.getElementById('signup-email').value.trim();
            if (!email) return alert('Enter your email');
            sendOtpBtn.disabled = true;
            const originalText = sendOtpBtn.textContent;
            sendOtpBtn.textContent = 'Sending...';
            try {
                const res = await fetch('https://yourspet.onrender.com/send-otp', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email, purpose: 'signup' })
                });
                const data = await res.json();
                alert(data.message || (data.success ? 'OTP sent to your email' : 'Failed to send OTP'));
            } finally {
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = originalText;
            }
        };
    }

    document.getElementById('signup-final-btn').onclick = async function() {
        const email = document.getElementById('signup-email').value.trim();
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value;
        if (!username || !password) return alert('Fill all fields');
        const res = await fetch('https://yourspet.onrender.com/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, username, password })
        });
        const data = await res.json();
        if (data.success) {
            alert('Account created! Please login.');
            window.location.href = "login.html";
        } else {
            alert(data.message || 'Registration failed');
        }
    };
});

# Example Flask route
from werkzeug.security import generate_password_hash
from flask import request, jsonify
import random

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data['email']
    username = data['username']
    password = data['password']
    # Hash the password!
    hashed_password = generate_password_hash(password)
    # Store email, username, and hashed_password in your users table
    # Example SQL: INSERT INTO users (email, username, password) VALUES (?, ?, ?)
    # Make sure to check for duplicate emails/usernames
    # Return success or error as JSON

@app.route('/send-reset-otp', methods=['POST'])
def send_reset_otp():
    data = request.get_json()
    email = data['email']
    user = db.users.find_one({'email': email})  # or your SQL query
    if not user:
        return jsonify({'success': False, 'message': 'Email not found'})
    otp = str(random.randint(100000, 999999))
    # Store OTP in DB or cache, linked to email
    db.otps.insert_one({'email': email, 'otp': otp})
    # Send email with OTP and username
    send_email(email, f"Your OTP is {otp}. Your username is {user['username']}.")
    return jsonify({'success': True})

@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data['email']
    otp = data['otp']
    new_password = data['new_password']
    # Verify OTP
    otp_entry = db.otps.find_one({'email': email, 'otp': otp})
    if not otp_entry:
        return jsonify({'success': False, 'message': 'Invalid OTP'})
    # Update password
    hashed_password = generate_password_hash(new_password)
    db.users.update_one({'email': email}, {'$set': {'password': hashed_password}})
    # Optionally, delete the OTP entry
    db.otps.delete_one({'_id': otp_entry['_id']})
    return jsonify({'success': True})
