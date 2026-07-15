const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../utils/db');
const { signToken } = require('../utils/jwt');

// Helper to set Cookie
const sendTokenCookie = (res, token) => {
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };
  res.cookie('token', token, cookieOptions);
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Please provide username, email and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const usernameExists = await prisma.user.findUnique({ where: { username } });
    if (usernameExists) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        status: 'ONLINE',
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });

    // Sign JWT
    const token = signToken(newUser.id);
    sendTokenCookie(res, token);

    res.status(201).json({
      message: 'Registration successful',
      user: newUser,
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update status to ONLINE
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ONLINE', lastActive: new Date() },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });

    // Sign JWT
    const token = signToken(updatedUser.id);
    sendTokenCookie(res, token);

    res.status(200).json({
      message: 'Login successful',
      user: updatedUser,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    if (req.user) {
      // Set status to OFFLINE on logout
      await prisma.user.update({
        where: { id: req.user.id },
        data: { status: 'OFFLINE', lastActive: new Date() },
      });
    }

    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
};

// @desc    Request password reset token
// @route   POST /api/auth/reset-password-request
// @access  Public
const resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Please provide your email address' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Security best practice: don't reveal if email exists, but for local dev
      // we'll return a 404 to make debugging easier
      return res.status(404).json({ error: 'User with this email does not exist' });
    }

    // Generate random token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save token to DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    // Return the token in response so the frontend can mock the reset link
    res.status(200).json({
      message: 'Password reset token generated successfully. In production, this would be emailed to you.',
      resetToken, // Return for dev mockup
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Server error during reset request' });
  }
};

// @desc    Confirm password reset with token
// @route   POST /api/auth/reset-password-confirm
// @access  Public
const resetPasswordConfirm = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Find valid token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(), // Expires date is in the future
        },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user password and clear token fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    res.status(500).json({ error: 'Server error during password reset' });
  }
};

// @desc    Get current authenticated user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  res.status(200).json({ user: req.user });
};

module.exports = {
  register,
  login,
  logout,
  resetPasswordRequest,
  resetPasswordConfirm,
  getMe,
};
