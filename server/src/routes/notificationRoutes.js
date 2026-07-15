const express = require('express');
const {
  listNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, listNotifications);
router.put('/:id/read', protect, markNotificationRead);
router.post('/read-all', protect, markAllRead);
router.delete('/:id', protect, deleteNotification);

module.exports = router;
