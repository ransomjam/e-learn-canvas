/**
 * AI Course Studio routes — /api/v1/ai
 *
 * All endpoints are instructor/admin only. Generation endpoints get a
 * dedicated (stricter) rate limit since each call costs provider tokens.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const controller = require('../controllers/ai-studio.controller');

const instructorOnly = [authenticate, authorize('instructor', 'admin')];

// Token-spending endpoints: 60 generations / 15 min per user
const generationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: { success: false, message: 'Too many AI generations — please wait a few minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Availability (any authenticated user — the UI adapts)
router.get('/status', authenticate, controller.getStatus);

// Background jobs
router.post('/lessons/generate', ...instructorOnly, generationLimiter, controller.generateLessonPack);
router.get('/jobs', ...instructorOnly, controller.listJobs);
router.get('/jobs/:id', ...instructorOnly, controller.getJob);
router.post('/jobs/:id/cancel', ...instructorOnly, controller.cancelJob);
router.post('/jobs/:id/apply', ...instructorOnly, controller.applyJob);

// Synchronous assists / small generations
router.post('/assist', ...instructorOnly, generationLimiter, controller.assist);
router.post('/quiz', ...instructorOnly, generationLimiter, controller.generateQuiz);
router.post('/summary', ...instructorOnly, generationLimiter, controller.generateSummary);
router.post('/translate', ...instructorOnly, generationLimiter, controller.translate);
router.post('/course-outline', ...instructorOnly, generationLimiter, controller.generateCourseOutline);

// Whiteboard storyboards
router.post('/storyboards', ...instructorOnly, generationLimiter, controller.createStoryboard);
router.get('/storyboards/:id', authenticate, controller.getStoryboard);
router.post('/storyboards/:id/scenes/:index/regenerate', ...instructorOnly, generationLimiter, controller.regenerateScene);

// Lesson artifacts (flashcards / slides / storyboards attached to a lesson)
router.get('/lessons/:lessonId/artifacts', authenticate, controller.getLessonArtifacts);

module.exports = router;
