const prisma = require('../utils/db');

// @desc    Update user profile (username, email, and/or avatar)
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email } = req.body;
    
    // Build update payload
    const updateData = {};

    if (username) {
      // Check if username is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          id: { not: userId }
        }
      });
      if (existingUser) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      updateData.username = username;
    }

    if (email) {
      // Check if email is already registered by another user
      const existingEmail = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId }
        }
      });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email is already registered' });
      }
      updateData.email = email;
    }

    if (req.file) {
      // If file was uploaded via Multer, save the public URL path
      updateData.avatarUrl = `/uploads/${req.file.filename}`;
    }

    // Perform update
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        status: true,
        lastActive: true,
        createdAt: true
      }
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error updating profile' });
  }
};

// @desc    Search users by username
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user.id;

    if (!q) {
      return res.status(200).json([]);
    }

    // Find users with matching username, excluding current user
    const users = await prisma.user.findMany({
      where: {
        username: {
          contains: q
        },
        id: {
          not: userId
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        status: true,
        lastActive: true
      },
      take: 15 // limit results
    });

    res.status(200).json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Server error searching users' });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const targetUserId = parseInt(id);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        status: true,
        lastActive: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error retrieving user' });
  }
};

// @desc    Block a user
// @route   POST /api/users/block
// @access  Private
const blockUser = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const { blockedId } = req.body;

    const targetUserId = parseInt(blockedId);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (blockerId === targetUserId) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User to block not found' });
    }

    // Check if already blocked
    const existingBlock = await prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: { blockerId, blockedId: targetUserId }
      }
    });

    if (existingBlock) {
      return res.status(400).json({ error: 'User is already blocked' });
    }

    // Create block record
    const block = await prisma.blockedUser.create({
      data: { blockerId, blockedId: targetUserId }
    });

    // Optional: pin or membership removal logic can be here, but we will simply enforce block state on message sends

    res.status(200).json({ message: 'User blocked successfully', block });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Server error blocking user' });
  }
};

// @desc    Unblock a user
// @route   POST /api/users/unblock
// @access  Private
const unblockUser = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const { blockedId } = req.body;

    const targetUserId = parseInt(blockedId);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Delete block record
    await prisma.blockedUser.delete({
      where: {
        blockerId_blockedId: { blockerId, blockedId: targetUserId }
      }
    });

    res.status(200).json({ message: 'User unblocked successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(400).json({ error: 'User is not blocked' });
    }
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Server error unblocking user' });
  }
};

// @desc    Get blocked users list
// @route   GET /api/users/blocked
// @access  Private
const getBlockedUsers = async (req, res) => {
  try {
    const blockerId = req.user.id;

    const blockedList = await prisma.blockedUser.findMany({
      where: { blockerId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(200).json(blockedList.map(b => b.blocked));
  } catch (error) {
    console.error('Get blocked list error:', error);
    res.status(500).json({ error: 'Server error fetching blocked users' });
  }
};

module.exports = {
  updateProfile,
  searchUsers,
  getUserById,
  blockUser,
  unblockUser,
  getBlockedUsers
};
