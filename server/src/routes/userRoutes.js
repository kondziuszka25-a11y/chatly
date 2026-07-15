const express = require('express');
const {
  updateProfile,
  searchUsers,
  getUserById,
  blockUser,
  unblockUser,
  getBlockedUsers,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const upload = require('../utils/uploader');

const router = express.Router();

router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.get('/search', protect, searchUsers);
router.get('/blocked', protect, getBlockedUsers);
router.post('/block', protect, blockUser);
router.post('/unblock', protect, unblockUser);
router.get('/:id', protect, getUserById);

module.exports = router;
