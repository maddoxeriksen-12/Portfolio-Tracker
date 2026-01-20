const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').optional().trim().escape(),
  body('lastName').optional().trim().escape()
], authController.register);

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], authController.login);

// Get profile (protected)
router.get('/profile', authMiddleware, authController.getProfile);

// Update profile (protected)
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;
