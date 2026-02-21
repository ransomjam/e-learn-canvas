const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { generateQuiz, submitQuiz, getQuizResults, getAvailableQuizzes } = require('../controllers/quiz.controller');

// Generate quiz (Instructor only)
router.post('/generate', authenticate, authorize('instructor', 'admin'), generateQuiz);

// Get available quizzes for logged in user
router.get('/available', authenticate, getAvailableQuizzes);

// Get results for a specific quiz
router.get('/:lessonId/results', authenticate, getQuizResults);

// Submit a quiz attempt
router.post('/:lessonId/submit', authenticate, submitQuiz);

module.exports = router;
