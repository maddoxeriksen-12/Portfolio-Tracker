const express = require('express');
const router = express.Router();
const retirementController = require('../controllers/retirementController');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get all retirement accounts with contributions
router.get('/', retirementController.getRetirementAccounts);

// Get retirement projections
router.get('/projections', retirementController.getRetirementProjections);

// Create a new retirement account
router.post('/', retirementController.createRetirementAccount);

// Update a retirement account
router.put('/:id', retirementController.updateRetirementAccount);

// Delete a retirement account
router.delete('/:id', retirementController.deleteRetirementAccount);

// Get value history for an account
router.get('/:accountId/history', retirementController.getValueHistory);

// Add a contribution to an account
router.post('/:accountId/contributions', retirementController.addContribution);

// Update a contribution
router.put('/contributions/:contributionId', retirementController.updateContribution);

// Delete a contribution
router.delete('/contributions/:contributionId', retirementController.deleteContribution);

module.exports = router;
