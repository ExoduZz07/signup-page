import { DatabaseService } from './db.js';

// DOM Elements
const formCard = document.getElementById('formCard');
const signupForm = document.getElementById('signupForm');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePassBtn = document.getElementById('togglePass');
const submitBtn = document.getElementById('submitBtn');
const statusNotice = document.getElementById('statusNotice');

const successCard = document.getElementById('successCard');
const newSignupBtn = document.getElementById('newSignupBtn');

// Toggle Password Visibility
togglePassBtn.addEventListener('click', () => {
  const isPass = passwordInput.type === 'password';
  passwordInput.type = isPass ? 'text' : 'password';
  togglePassBtn.textContent = isPass ? 'Hide' : 'Show';
});

// Notice Helpers
function showNotice(msg, type = 'error') {
  statusNotice.className = `notice ${type}`;
  statusNotice.textContent = msg;
  statusNotice.classList.remove('hidden');
}

function clearNotice() {
  statusNotice.className = 'notice hidden';
  statusNotice.textContent = '';
}

[nameInput, emailInput, passwordInput].forEach(inp => {
  inp.addEventListener('input', clearNotice);
});

// Public Form Submission
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearNotice();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Form Validation
  if (!name) {
    showNotice('Please enter your full name.');
    nameInput.focus();
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailPattern.test(email)) {
    showNotice('Please enter a valid email address.');
    emailInput.focus();
    return;
  }

  if (!password || password.length < 6) {
    showNotice('Password must be at least 6 characters.');
    passwordInput.focus();
    return;
  }

  // Set Loading
  submitBtn.disabled = true;
  submitBtn.querySelector('span').textContent = 'Creating...';

  try {
    await DatabaseService.registerUser({ name, email, password });

    // Switch to clean success view
    formCard.classList.add('hidden');
    successCard.classList.remove('hidden');

  } catch (err) {
    showNotice(err.message || 'Something went wrong. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('span').textContent = 'Create account';
  }
});

// "Register another account" button
newSignupBtn.addEventListener('click', () => {
  signupForm.reset();
  passwordInput.type = 'password';
  togglePassBtn.textContent = 'Show';
  clearNotice();

  successCard.classList.add('hidden');
  formCard.classList.remove('hidden');
  nameInput.focus();
});
