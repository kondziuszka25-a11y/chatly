const express = require('express');
const {
  createConversation,
  listConversations,
  getConversationDetails,
  updateGroupSettings,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  togglePinConversation,
} = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');
const upload = require('../utils/uploader');

const router = express.Router();

router.post('/', protect, upload.single('avatar'), createConversation);
router.get('/', protect, listConversations);
router.get('/:id', protect, getConversationDetails);
router.put('/:id/settings', protect, upload.single('avatar'), updateGroupSettings);
router.post('/:id/members', protect, addGroupMember);
router.delete('/:id/members/:userId', protect, removeGroupMember);
router.post('/:id/leave', protect, leaveGroup);
router.post('/:id/pin', protect, togglePinConversation);

module.exports = router;
