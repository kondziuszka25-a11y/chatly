const express = require('express');
const {
  register,
  login,
  logout,
  resetPasswordRequest,
  resetPasswordConfirm,
  getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.post('/reset-password-request', resetPasswordRequest);
router.post('/reset-password-confirm', resetPasswordConfirm);
router.get('/me', protect, getMe);

module.exports = router;
