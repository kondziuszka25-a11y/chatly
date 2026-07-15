const express = require('express');
const {
  sendMessage,
  listMessages,
  editMessage,
  deleteMessage,
  markConversationAsRead,
  addReaction,
  deleteReaction,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');
const upload = require('../utils/uploader');

const router = express.Router();

router.post('/', protect, upload.single('file'), sendMessage);
router.get('/:conversationId', protect, listMessages);
router.put('/:id', protect, editMessage);
router.delete('/:id', protect, deleteMessage);
router.post('/:conversationId/read', protect, markConversationAsRead);
router.post('/:id/reactions', protect, addReaction);
router.delete('/:id/reactions', protect, deleteReaction);

module.exports = router;
