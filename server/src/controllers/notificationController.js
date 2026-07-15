const prisma = require('../utils/db');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const listNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        },
        conversation: {
          select: {
            id: true,
            name: true,
            isGroup: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ error: 'Server error fetching notifications' });
  }
};

// @desc    Mark a specific notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markNotificationRead = async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Server error marking notification as read' });
  }
};

// @desc    Mark all user notifications as read
// @route   POST /api/notifications/read-all
// @access  Private
const markAllRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Server error marking all notifications as read' });
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.notification.delete({
      where: { id: notificationId }
    });

    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Server error deleting notification' });
  }
};

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification
};
