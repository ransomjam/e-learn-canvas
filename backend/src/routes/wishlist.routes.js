const express = require('express');
const router = express.Router();
const { getWishlist, addToWishlist, removeFromWishlist } = require('../controllers/wishlist.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/', authenticate, getWishlist);
router.post('/', authenticate, addToWishlist);
router.delete('/:courseId', authenticate, removeFromWishlist);

module.exports = router;
