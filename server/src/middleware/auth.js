const { verifyToken } = require('../utils/jwt');
const prisma = require('../utils/db');

const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Try to get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // 2. Try to get token from HTTP-only cookie
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token provided' });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Not authorized, invalid token' });
    }

    // Fetch user details from database, omitting password
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        status: true,
        lastActive: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Not authorized, user not found' });
    }

    // Attach user to req object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Not authorized' });
  }
};

module.exports = { protect };
