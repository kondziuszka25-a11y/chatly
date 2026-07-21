const prisma = require('../utils/db');

// @desc    Create a 1:1 or Group conversation
// @route   POST /api/conversations
// @access  Private
const createConversation = async (req, res) => {
  try {
    const { isGroup, name, memberIds, userId } = req.body;
    const currentUserId = req.user.id;

    // --- 1:1 Conversation Logic ---
    if (!isGroup) {
      const targetUserId = parseInt(userId);
      if (!targetUserId || isNaN(targetUserId)) {
        return res.status(400).json({ error: 'Please provide a valid userId for 1:1 chat' });
      }

      if (targetUserId === currentUserId) {
        return res.status(400).json({ error: 'You cannot start a conversation with yourself' });
      }

      // Check if blocked by either party
      const blockCheck = await prisma.blockedUser.findFirst({
        where: {
          OR: [
            { blockerId: currentUserId, blockedId: targetUserId },
            { blockerId: targetUserId, blockedId: currentUserId }
          ]
        }
      });

      if (blockCheck) {
        return res.status(400).json({ error: 'Cannot start conversation. One of the users is blocked.' });
      }

      // Check if conversation already exists between these 2 users
      const existingConvs = await prisma.conversation.findMany({
        where: {
          isGroup: false,
          members: {
            every: {
              userId: { in: [currentUserId, targetUserId] }
            }
          }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                  status: true,
                  lastActive: true
                }
              }
            }
          }
        }
      });

      // Filter exact matches (where member count is 2)
      const exactMatch = existingConvs.find(conv => conv.members.length === 2);
      if (exactMatch) {
        return res.status(200).json(exactMatch);
      }

      // Create new 1:1 conversation
      const newConv = await prisma.conversation.create({
        data: {
          isGroup: false,
          members: {
            create: [
              { userId: currentUserId },
              { userId: targetUserId }
            ]
          }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                  status: true,
                  lastActive: true
                }
              }
            }
          }
        }
      });

      return res.status(201).json(newConv);
    }

    // --- Group Conversation Logic ---
    if (isGroup) {
      if (!name) {
        return res.status(400).json({ error: 'Group name is required' });
      }

      // Parse memberIds - may come as JSON string from FormData or as array from JSON body
      let parsedMemberIds = memberIds;
      if (typeof memberIds === 'string') {
        try {
          parsedMemberIds = JSON.parse(memberIds);
        } catch (e) {
          parsedMemberIds = [memberIds]; // single ID as string
        }
      }

      if (!parsedMemberIds || !Array.isArray(parsedMemberIds) || parsedMemberIds.length === 0) {
        return res.status(400).json({ error: 'At least one other member is required to create a group' });
      }

      // Parse IDs to numbers and deduplicate
      const targetUserIds = [...new Set(
        parsedMemberIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id !== currentUserId)
      )];

      // Create unique array of member entries
      const membersToCreate = [
        { userId: currentUserId }, // Creator/Owner
        ...targetUserIds.map(id => ({ userId: id }))
      ];

      // Handle group avatar if uploaded
      let avatarUrl = null;
      if (req.file) {
        avatarUrl = `/uploads/${req.file.filename}`;
      }

      const newGroup = await prisma.conversation.create({
        data: {
          isGroup: true,
          name,
          avatarUrl,
          ownerId: currentUserId,
          members: {
            create: membersToCreate
          }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatarUrl: true,
                  status: true,
                  lastActive: true
                }
              }
            }
          }
        }
      });

      return res.status(201).json(newGroup);
    }
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Server error creating conversation' });
  }
};

// @desc    List user's conversations
// @route   GET /api/conversations
// @access  Private
const listConversations = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Fetch conversations where the user is a member
    const memberships = await prisma.conversationMember.findMany({
      where: { userId: currentUserId },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatarUrl: true,
                    status: true,
                    lastActive: true
                  }
                }
              }
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    // Map and enrich fields (isPinned, lastReadAt, lastMessage)
    const conversations = memberships.map(m => {
      const conv = m.conversation;
      const lastMessage = conv.messages[0] || null;

      // Determine sorting date (fall back to updatedAt if no messages exist)
      const sortDate = lastMessage ? lastMessage.createdAt : conv.updatedAt;

      return {
        id: conv.id,
        name: conv.name,
        avatarUrl: conv.avatarUrl,
        isGroup: conv.isGroup,
        ownerId: conv.ownerId,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        isPinned: m.isPinned,
        lastReadAt: m.lastReadAt,
        members: conv.members.map(member => ({
          userId: member.user.id,
          username: member.user.username,
          avatarUrl: member.user.avatarUrl,
          status: member.user.status,
          lastActive: member.user.lastActive,
          joinedAt: member.joinedAt
        })),
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          senderId: lastMessage.senderId,
          content: lastMessage.isDeleted ? 'Wiadomość została usunięta' : lastMessage.content,
          fileUrl: lastMessage.fileUrl,
          fileType: lastMessage.fileType,
          createdAt: lastMessage.createdAt
        } : null,
        sortDate
      };
    });

    // Sort: Pinned first, then sorted by latest message / update date descending
    conversations.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.sortDate) - new Date(a.sortDate);
    });

    res.status(200).json(conversations);
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'Server error listing conversations' });
  }
};

// @desc    Get details for a conversation
// @route   GET /api/conversations/:id
// @access  Private
const getConversationDetails = async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    if (isNaN(convId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Verify membership
    const member = await prisma.conversationMember.findUnique({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: convId
        }
      }
    });

    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this conversation' });
    }

    const conv = await prisma.conversation.findUnique({
      where: { id: convId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                status: true,
                lastActive: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      id: conv.id,
      name: conv.name,
      avatarUrl: conv.avatarUrl,
      isGroup: conv.isGroup,
      ownerId: conv.ownerId,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      isPinned: member.isPinned,
      lastReadAt: member.lastReadAt,
      members: conv.members.map(m => ({
        userId: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        status: m.user.status,
        lastActive: m.user.lastActive,
        joinedAt: m.joinedAt
      }))
    });
  } catch (error) {
    console.error('Get conversation details error:', error);
    res.status(500).json({ error: 'Server error retrieving conversation details' });
  }
};

// @desc    Update group details (name and/or avatar)
// @route   PUT /api/conversations/:id/settings
// @access  Private
const updateGroupSettings = async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    const { name } = req.body;

    if (isNaN(convId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Check membership
    const membership = await prisma.conversationMember.findUnique({
      where: { userId_conversationId: { userId: currentUserId, conversationId: convId } }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: convId }
    });

    if (!conversation.isGroup) {
      return res.status(400).json({ error: 'This is not a group conversation' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (req.file) updateData.avatarUrl = `/uploads/${req.file.filename}`;

    const updatedConv = await prisma.conversation.update({
      where: { id: convId },
      data: updateData,
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true, status: true, lastActive: true } }
          }
        }
      }
    });

    // Emit real-time update to all group members
    try {
      const io = req.app.get('io');
      if (io) {
        const formattedMembers = updatedConv.members.map(m => ({
          userId: m.user.id,
          username: m.user.username,
          avatarUrl: m.user.avatarUrl,
          status: m.user.status,
          lastActive: m.user.lastActive,
          joinedAt: m.joinedAt
        }));
        updatedConv.members.forEach(member => {
          io.to(`user_${member.user.id}`).emit('conversation_updated', {
            id: updatedConv.id,
            name: updatedConv.name,
            avatarUrl: updatedConv.avatarUrl,
            isGroup: updatedConv.isGroup,
            ownerId: updatedConv.ownerId,
            updatedAt: updatedConv.updatedAt,
            members: formattedMembers,
            lastMessage: null
          });
        });
      }
    } catch (emitErr) {
      console.error('Error emitting group settings update:', emitErr);
    }

    res.status(200).json(updatedConv);
  } catch (error) {
    console.error('Update group settings error:', error);
    res.status(500).json({ error: 'Server error updating group settings' });
  }
};

// @desc    Add member to group
// @route   POST /api/conversations/:id/members
// @access  Private
const addGroupMember = async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    const { userId } = req.body;

    if (isNaN(convId) || !userId) {
      return res.status(400).json({ error: 'Invalid group or member ID' });
    }

    // Verify current user is in group
    const senderMembership = await prisma.conversationMember.findUnique({
      where: { userId_conversationId: { userId: currentUserId, conversationId: convId } }
    });

    if (!senderMembership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targetUserId = parseInt(userId);

    // Verify target user isn't already a member
    const existingMember = await prisma.conversationMember.findUnique({
      where: { userId_conversationId: { userId: targetUserId, conversationId: convId } }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this group' });
    }

    // Add to group
    await prisma.conversationMember.create({
      data: {
        userId: targetUserId,
        conversationId: convId
      }
    });

    const updatedConv = await prisma.conversation.findUnique({
      where: { id: convId },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true, status: true, lastActive: true } }
          }
        }
      }
    });

    // Create a database notification for the added user
    try {
      const groupName = updatedConv.name || 'Grupowa';
      const notification = await prisma.notification.create({
        data: {
          userId: targetUserId,
          senderId: currentUserId,
          conversationId: convId,
          type: 'GROUP_INVITE',
          content: `Użytkownik ${req.user.username} dodał Cię do grupy "${groupName}"`
        },
        include: {
          sender: { select: { id: true, username: true, avatarUrl: true } },
          conversation: { select: { id: true, name: true, isGroup: true } }
        }
      });

      // Emit real-time events to the added user
      const io = req.app.get('io');
      if (io) {
        // Emit in-app toast/notification
        io.to(`user_${targetUserId}`).emit('new_notification', notification);

        // Emit conversation update so group appears in their sidebar
        io.to(`user_${targetUserId}`).emit('conversation_updated', {
          id: updatedConv.id,
          name: updatedConv.name,
          avatarUrl: updatedConv.avatarUrl,
          isGroup: updatedConv.isGroup,
          ownerId: updatedConv.ownerId,
          updatedAt: updatedConv.updatedAt,
          lastMessage: null
        });
      }
    } catch (notifError) {
      console.error('Error creating group invite notification:', notifError);
    }

    // Emit conversation_updated to ALL current members (including newly added)
    try {
      const io = req.app.get('io');
      if (io) {
        const formattedMembers = updatedConv.members.map(m => ({
          userId: m.user.id,
          username: m.user.username,
          avatarUrl: m.user.avatarUrl,
          status: m.user.status,
          lastActive: m.user.lastActive,
          joinedAt: m.joinedAt
        }));
        updatedConv.members.forEach(member => {
          io.to(`user_${member.user.id}`).emit('conversation_updated', {
            id: updatedConv.id,
            name: updatedConv.name,
            avatarUrl: updatedConv.avatarUrl,
            isGroup: updatedConv.isGroup,
            ownerId: updatedConv.ownerId,
            updatedAt: updatedConv.updatedAt,
            members: formattedMembers,
            lastMessage: null
          });
        });
      }
    } catch (emitErr) {
      console.error('Error emitting member added event:', emitErr);
    }

    res.status(200).json(updatedConv);
  } catch (error) {
    console.error('Add group member error:', error);
    res.status(500).json({ error: 'Server error adding group member' });
  }
};

// @desc    Remove member from group (Owner only)
// @route   DELETE /api/conversations/:id/members/:userId
// @access  Private
const removeGroupMember = async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);
    const currentUserId = req.user.id;

    if (isNaN(convId) || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid inputs' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: convId },
      include: { members: true }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!conversation.isGroup) {
      return res.status(400).json({ error: 'Conversation is not a group' });
    }

    // Verify current user is the owner
    if (conversation.ownerId !== currentUserId) {
      return res.status(403).json({ error: 'Only the group owner can remove members' });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'Owner cannot be removed. You must leave the group or transfer ownership first.' });
    }

    // Delete membership
    await prisma.conversationMember.delete({
      where: {
        userId_conversationId: {
          userId: targetUserId,
          conversationId: convId
        }
      }
    });

    // Emit real-time events
    try {
      const io = req.app.get('io');
      if (io) {
        // Notify removed user
        io.to(`user_${targetUserId}`).emit('group_left', { conversationId: convId });
        // Notify remaining members
        const remainingMembers = conversation.members.filter(m => m.userId !== targetUserId);
        remainingMembers.forEach(member => {
          io.to(`user_${member.userId}`).emit('conversation_updated', {
            id: convId,
            membersChanged: true,
            removedUserId: targetUserId
          });
        });
      }
    } catch (emitErr) {
      console.error('Error emitting member removed event:', emitErr);
    }

    res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Server error removing member' });
  }
};

// @desc    Leave a group
// @route   POST /api/conversations/:id/leave
// @access  Private
const leaveGroup = async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    if (isNaN(convId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: convId },
      include: { members: true }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const isMember = conversation.members.some(m => m.userId === currentUserId);
    if (!isMember) {
      return res.status(400).json({ error: 'You are not a member of this group' });
    }

    // If owner is leaving, they must hand off ownership if other members exist
    if (conversation.ownerId === currentUserId && conversation.members.length > 1) {
      const otherMember = conversation.members.find(m => m.userId !== currentUserId);
      
      // Update owner to the first other member
      await prisma.conversation.update({
        where: { id: convId },
        data: { ownerId: otherMember.userId }
      });
    }

    // Delete membership
    await prisma.conversationMember.delete({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: convId
        }
      }
    });

    // If no members are left, delete conversation entirely
    const remainingCount = conversation.members.length - 1;
    if (remainingCount === 0) {
      await prisma.conversation.delete({
        where: { id: convId }
      });
    }

    // Emit real-time events
    try {
      const io = req.app.get('io');
      if (io) {
        const remainingMembers = conversation.members.filter(m => m.userId !== currentUserId);
        remainingMembers.forEach(member => {
          io.to(`user_${member.userId}`).emit('conversation_updated', {
            id: convId,
            membersChanged: true,
            removedUserId: currentUserId
          });
        });
      }
    } catch (emitErr) {
      console.error('Error emitting leave group event:', emitErr);
    }

    res.status(200).json({ message: 'Left the group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Server error leaving group' });
  }
};

// @desc    Toggle pin conversation status
// @route   POST /api/conversations/:id/pin
// @access  Private
const togglePinConversation = async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    if (isNaN(convId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const member = await prisma.conversationMember.findUnique({
      where: { userId_conversationId: { userId: currentUserId, conversationId: convId } }
    });

    if (!member) {
      return res.status(404).json({ error: 'Conversation member not found' });
    }

    const updatedMember = await prisma.conversationMember.update({
      where: { userId_conversationId: { userId: currentUserId, conversationId: convId } },
      data: { isPinned: !member.isPinned }
    });

    res.status(200).json({
      conversationId: convId,
      isPinned: updatedMember.isPinned,
      message: updatedMember.isPinned ? 'Conversation pinned' : 'Conversation unpinned'
    });
  } catch (error) {
    console.error('Pin conversation error:', error);
    res.status(500).json({ error: 'Server error toggling pin status' });
  }
};

module.exports = {
  createConversation,
  listConversations,
  getConversationDetails,
  updateGroupSettings,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  togglePinConversation
};
