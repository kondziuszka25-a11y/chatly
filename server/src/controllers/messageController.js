const prisma = require('../utils/db');

// @desc    Send a message (text and/or file)
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const currentUserId = req.user.id;

    const convId = parseInt(conversationId);
    if (isNaN(convId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Verify current user is a member of this conversation
    const membership = await prisma.conversationMember.findUnique({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: convId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this conversation' });
    }

    // Check if either user has blocked the other (1:1 chats only)
    const convDetails = await prisma.conversation.findUnique({
      where: { id: convId },
      select: { isGroup: true, members: { select: { userId: true } } }
    });

    if (convDetails && !convDetails.isGroup) {
      const otherUserId = convDetails.members.find(m => m.userId !== currentUserId)?.userId;
      if (otherUserId) {
        const blockExists = await prisma.blockedUser.findFirst({
          where: {
            OR: [
              { blockerId: currentUserId, blockedId: otherUserId },
              { blockerId: otherUserId, blockedId: currentUserId }
            ]
          }
        });
        if (blockExists) {
          return res.status(403).json({ error: 'Cannot send message. One of the users is blocked.' });
        }
      }
    }

    let fileUrl = null;
    let fileType = null;

    if (req.file) {
      fileUrl = `/uploads/${req.file.filename}`;
      fileType = req.file.mimetype;
    }

    if (!content && !fileUrl) {
      return res.status(400).json({ error: 'Message content or file attachment is required' });
    }

    // Save message
    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        senderId: currentUserId,
        content: content || '',
        fileUrl,
        fileType
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      }
    });

    // Update conversation updatedAt timestamp
    await prisma.conversation.update({
      where: { id: convId },
      data: { updatedAt: new Date() }
    });

    // Automatically update lastReadAt for sender
    await prisma.conversationMember.update({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: convId
        }
      },
      data: { lastReadAt: new Date() }
    });

    // Emit Socket Events for Real-time delivery
    const io = req.app.get('io');
    if (io) {
      // Send message to the conversation room
      io.to(`conv_${convId}`).emit('message_received', message);

      // Fetch conversation details to broadcast sidebar updates and manage notifications
      const conv = await prisma.conversation.findUnique({
        where: { id: convId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true
                }
              }
            }
          }
        }
      });

      if (conv) {
        // Emit conversation updates to all members
        conv.members.forEach(member => {
          io.to(`user_${member.userId}`).emit('conversation_updated', {
            id: conv.id,
            name: conv.name,
            avatarUrl: conv.avatarUrl,
            isGroup: conv.isGroup,
            ownerId: conv.ownerId,
            updatedAt: conv.updatedAt,
            lastMessage: {
              id: message.id,
              senderId: message.senderId,
              content: message.content,
              fileUrl: message.fileUrl,
              fileType: message.fileType,
              createdAt: message.createdAt
            }
          });
        });

        // Generate notifications for other members
        try {
          // Parse mentions: @username
          const mentionRegex = /@(\w+)/g;
          const mentions = [];
          let match;
          while ((match = mentionRegex.exec(content || '')) !== null) {
            mentions.push(match[1]);
          }

          const otherMembers = conv.members.filter(m => m.userId !== currentUserId);

          for (const member of otherMembers) {
            const targetUserId = member.userId;
            let notification = null;
            const isMentioned = mentions.includes(member.user.username);

            if (isMentioned) {
              notification = await prisma.notification.create({
                data: {
                  userId: targetUserId,
                  senderId: currentUserId,
                  conversationId: convId,
                  type: 'MENTION',
                  content: `Użytkownik @${req.user.username} wspomniał o Tobie w ${conv.isGroup ? `grupie "${conv.name}"` : 'czacie'}`
                },
                include: {
                  sender: { select: { id: true, username: true, avatarUrl: true } },
                  conversation: { select: { id: true, name: true, isGroup: true } }
                }
              });
            } else {
              // Aggregate new message notification: check for an unread one
              const existingNotification = await prisma.notification.findFirst({
                where: {
                  userId: targetUserId,
                  conversationId: convId,
                  type: 'NEW_MESSAGE',
                  isRead: false
                }
              });

              if (existingNotification) {
                notification = await prisma.notification.update({
                  where: { id: existingNotification.id },
                  data: {
                    content: conv.isGroup 
                      ? `Nowe wiadomości w grupie "${conv.name}"`
                      : `Nowe wiadomości od użytkownika ${req.user.username}`,
                    createdAt: new Date()
                  },
                  include: {
                    sender: { select: { id: true, username: true, avatarUrl: true } },
                    conversation: { select: { id: true, name: true, isGroup: true } }
                  }
                });
              } else {
                notification = await prisma.notification.create({
                  data: {
                    userId: targetUserId,
                    senderId: currentUserId,
                    conversationId: convId,
                    type: 'NEW_MESSAGE',
                    content: conv.isGroup
                      ? `Nowa wiadomość w grupie "${conv.name}" od ${req.user.username}`
                      : `Nowa wiadomość od użytkownika ${req.user.username}`
                  },
                  include: {
                    sender: { select: { id: true, username: true, avatarUrl: true } },
                    conversation: { select: { id: true, name: true, isGroup: true } }
                  }
                });
              }
            }

            // Emit toast notification via socket
            if (notification) {
              io.to(`user_${targetUserId}`).emit('new_notification', notification);
            }
          }
        } catch (notifErr) {
          console.error('Error generating message notifications:', notifErr);
        }
      }
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error sending message' });
  }
};

// @desc    List message history in a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
const listMessages = async (req, res) => {
  try {
    const convId = parseInt(req.params.conversationId);
    const currentUserId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    if (isNaN(convId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Verify membership
    const membership = await prisma.conversationMember.findUnique({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: convId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch messages (latest first for pagination, but we will reverse them before returning)
    const messages = await prisma.message.findMany({
      where: { conversationId: convId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: skip
    });

    // Reverse to display oldest first in chat window
    res.status(200).json(messages.reverse());
  } catch (error) {
    console.error('List messages error:', error);
    res.status(500).json({ error: 'Server error listing messages' });
  }
};

// @desc    Edit a message
// @route   PUT /api/messages/:id
// @access  Private
const editMessage = async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    const { content } = req.body;

    if (isNaN(messageId) || !content) {
      return res.status(400).json({ error: 'Message ID and new content are required' });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== currentUserId) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: 'Cannot edit a deleted message' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        isEdited: true
      },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true }
        },
        reactions: {
          include: {
            user: { select: { id: true, username: true } }
          }
        }
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`conv_${updatedMessage.conversationId}`).emit('message_edited', updatedMessage);
    }

    res.status(200).json(updatedMessage);
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Server error editing message' });
  }
};

// @desc    Delete (soft-delete) a message
// @route   DELETE /api/messages/:id
// @access  Private
const deleteMessage = async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== currentUserId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    // Soft delete
    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: 'Wiadomość została usunięta',
        fileUrl: null,
        fileType: null,
        isDeleted: true
      },
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true }
        },
        reactions: {
          include: {
            user: { select: { id: true, username: true } }
          }
        }
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`conv_${deletedMessage.conversationId}`).emit('message_deleted', deletedMessage);
    }

    res.status(200).json(deletedMessage);
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Server error deleting message' });
  }
};

// @desc    Mark a conversation as read
// @route   POST /api/messages/:conversationId/read
// @access  Private
const markConversationAsRead = async (req, res) => {
  try {
    const convId = parseInt(req.params.conversationId);
    const currentUserId = req.user.id;

    if (isNaN(convId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    await prisma.conversationMember.update({
      where: {
        userId_conversationId: {
          userId: currentUserId,
          conversationId: convId
        }
      },
      data: { lastReadAt: new Date() }
    });

    res.status(200).json({ success: true, conversationId: convId });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error marking read status' });
  }
};

// @desc    Add or update a reaction to a message
// @route   POST /api/messages/:id/reactions
// @access  Private
const addReaction = async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    const { emoji } = req.body;

    if (isNaN(messageId) || !emoji) {
      return res.status(400).json({ error: 'Message ID and emoji are required' });
    }

    // Verify message exists
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { members: true } } }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify user belongs to the conversation of the message
    const isMember = message.conversation.members.some(m => m.userId === currentUserId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Upsert reaction (max 1 reaction type per user per message)
    const reaction = await prisma.messageReaction.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: currentUserId
        }
      },
      update: { emoji },
      create: {
        messageId,
        userId: currentUserId,
        emoji
      },
      include: {
        user: {
          select: { id: true, username: true }
        }
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`conv_${message.conversationId}`).emit('reaction_added', {
        messageId,
        reaction
      });
    }

    res.status(200).json(reaction);
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Server error adding reaction' });
  }
};

// @desc    Remove a reaction from a message
// @route   DELETE /api/messages/:id/reactions
// @access  Private
const deleteReaction = async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    // Delete matching reaction row
    await prisma.messageReaction.delete({
      where: {
        messageId_userId: {
          messageId,
          userId: currentUserId
        }
      }
    });

    // We need to fetch the message to know which conversation room to emit to
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true }
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io && message) {
      io.to(`conv_${message.conversationId}`).emit('reaction_removed', {
        messageId,
        userId: currentUserId
      });
    }

    res.status(200).json({ message: 'Reaction removed successfully', messageId, userId: currentUserId });
  } catch (error) {
    // If reaction wasn't found, just return 200/404. Let's return 200 to be safe.
    if (error.code === 'P2025') {
      try {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
          select: { conversationId: true }
        });
        const io = req.app.get('io');
        if (io && message) {
          io.to(`conv_${message.conversationId}`).emit('reaction_removed', {
            messageId,
            userId: currentUserId
          });
        }
      } catch (e) {}
      return res.status(200).json({ message: 'Reaction already removed', messageId, userId: currentUserId });
    }
    console.error('Delete reaction error:', error);
    res.status(500).json({ error: 'Server error removing reaction' });
  }
};

module.exports = {
  sendMessage,
  listMessages,
  editMessage,
  deleteMessage,
  markConversationAsRead,
  addReaction,
  deleteReaction
};
