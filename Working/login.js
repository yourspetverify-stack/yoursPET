// Minimal login/signup handler using localStorage for demo
window.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const mainSignupLink = document.getElementById('main-signup-link');
    const backToLoginLink = document.getElementById('back-to-login-link');

    if (mainSignupLink) {
        mainSignupLink.onclick = function(e) {
            e.preventDefault();
            loginForm.style.display = 'none';
            signupForm.style.display = 'flex';
        };
    }
    if (backToLoginLink) {
        backToLoginLink.onclick = function(e) {
            e.preventDefault();
            signupForm.style.display = 'none';
            loginForm.style.display = 'flex';
        };
    }

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = loginForm.querySelector('input[type="text"]').value.trim();
        // Get password value regardless of input type
        const passwordInput = document.getElementById('login-password');
        const password = passwordInput ? passwordInput.value : '';
        const stored = localStorage.getItem('user_' + username);
        if (stored && JSON.parse(stored).password === password) {
            window.location.href = 'dashboard.html';
        } else {
            alert('Invalid credentials!');
        }
    });

    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = signupForm.querySelector('input[type="text"]').value.trim();
        // Get password value regardless of input type
        const passwordInput = document.getElementById('signup-password');
        const password = passwordInput ? passwordInput.value : '';
        if (!username || !password) {
            alert('Please fill all fields!');
            return;
        }
        if (localStorage.getItem('user_' + username)) {
            alert('User already exists!');
            return;
        }
        localStorage.setItem('user_' + username, JSON.stringify({ password }));
        alert('Sign up successful! Please log in.');
        signupForm.style.display = 'none';
        loginForm.style.display = 'flex';
    });
});
