const axios = require('axios');
const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');

/**
 * @desc    Generate a quiz from text
 * @route   POST /api/v1/quiz/generate
 * @access  Private/Instructor
 */
const generateQuiz = asyncHandler(async (req, res) => {
    const { text, options } = req.body;

    if (!text) {
        throw new ApiError(400, 'Text content is required to generate a quiz');
    }

    const { questionCount, difficulty = 'medium' } = options || {};

    // Helper: build prompt for a chunk of text
    const buildPrompt = (inputText, count) => {
        const countInstruction = count
            ? `Generate exactly ${count} questions.`
            : `Generate as many questions as the text supports. Extract EVERY possible fact, concept, and detail from the text and create a unique question for each. Do NOT limit yourself — aim for thoroughness. If the text can support 20+ questions, generate 20+ questions.`;

        return `You are a helpful education assistant. Generate a Multiple Choice Quiz based on the text provided below.
Requirements:
1. ${countInstruction}
2. Difficulty should be ${difficulty}.
3. Each question must have exactly 4 options.
4. Provide the correct answer index (0-3).
5. Cover ALL topics, facts, and details present in the text — do NOT skip any.
6. Output MUST be ONLY valid JSON matching this schema:
[
  {
    "question": "Question text?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": 0,
    "explanation": "Explanation for the answer"
  }
]

Text:
${inputText}
`;
    };

    // Helper: call the AI API for a given prompt
    const callAI = async (prompt) => {
        const response = await axios.post('https://api.deepseek.com/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'You are a quiz generator. You only output valid JSON arrays. No markdown formatting like ```json or anything else, just raw JSON text. Generate ALL questions the text supports — be thorough and exhaustive.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 16384
        }, {
            headers: {
                'Authorization': `Bearer sk-4a857c0c76cf4db89fef65b871da982a`,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // 2 min timeout for AI generation
        });

        let content = response.data.choices[0].message.content;

        // cleanup potential markdown formatting
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();

        let quizData;
        try {
            quizData = JSON.parse(content);
            if (!Array.isArray(quizData) && quizData.questions) {
                quizData = quizData.questions;
            }
        } catch (e) {
            console.error('Failed to parse AI response:', content);
            throw new ApiError(500, 'Failed to parse generated quiz');
        }

        return Array.isArray(quizData) ? quizData : [];
    };

    try {
        // For very large texts, split into chunks and merge results
        const MAX_CHARS_PER_CHUNK = 12000;
        let allQuestions = [];

        if (text.length <= MAX_CHARS_PER_CHUNK) {
            // Single call
            const prompt = buildPrompt(text, questionCount);
            allQuestions = await callAI(prompt);
        } else {
            // Split text into chunks by paragraphs
            const paragraphs = text.split(/\n\s*\n/);
            const chunks = [];
            let currentChunk = '';

            for (const para of paragraphs) {
                if ((currentChunk + '\n\n' + para).length > MAX_CHARS_PER_CHUNK && currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    currentChunk = para;
                } else {
                    currentChunk += (currentChunk ? '\n\n' : '') + para;
                }
            }
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }

            console.log(`Quiz generation: splitting text into ${chunks.length} chunks (total ${text.length} chars)`);

            // Process each chunk and collect questions
            for (const chunk of chunks) {
                const prompt = buildPrompt(chunk, null); // let AI generate as many as possible per chunk
                const chunkQuestions = await callAI(prompt);
                allQuestions.push(...chunkQuestions);
            }

            // If a specific count was requested, trim to that count
            if (questionCount && allQuestions.length > questionCount) {
                allQuestions = allQuestions.slice(0, questionCount);
            }
        }

        console.log(`Quiz generation complete: ${allQuestions.length} questions generated`);

        res.json({
            success: true,
            data: allQuestions
        });
    } catch (error) {
        console.error('Quiz generation error:', error.response?.data || error.message);
        throw new ApiError(500, 'Failed to generate quiz from AI');
    }
});

/**
 * @desc    Submit a quiz attempt
 * @route   POST /api/v1/quiz/:lessonId/submit
 * @access  Private
 */
const submitQuiz = asyncHandler(async (req, res) => {
    const { lessonId } = req.params;
    const { answers } = req.body; // array of submitted answers

    // Verify lesson exists & is a quiz
    const lessonResult = await query(
        'SELECT id, type, quiz_data, is_mandatory FROM lessons WHERE id = $1',
        [lessonId]
    );

    if (lessonResult.rows.length === 0) {
        throw new ApiError(404, 'Lesson not found');
    }

    const lesson = lessonResult.rows[0];
    if (lesson.type !== 'quiz') {
        throw new ApiError(400, 'This lesson is not a quiz');
    }

    const quizData = lesson.quiz_data || [];
    let correctCount = 0;

    // Evaluate answers
    const evaluatedAnswers = quizData.map((q, index) => {
        const userAnswer = answers[index];
        const isCorrect = userAnswer === q.correctAnswer;
        if (isCorrect) correctCount++;
        return {
            question: q.question,
            userAnswer,
            correctAnswer: q.correctAnswer,
            isCorrect
        };
    });

    let score = 0;
    if (quizData.length > 0) {
        score = (correctCount / quizData.length) * 100;
    }

    // Save attempt
    const attemptResult = await query(
        `INSERT INTO quiz_attempts (user_id, lesson_id, score, total_questions, answers)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.user.id, lessonId, score, quizData.length, JSON.stringify(evaluatedAnswers)]
    );

    const passed = score >= 60;

    // Update progress table to indicate completion ONLY if passed
    if (passed) {
        const progressCheck = await query(
            'SELECT id FROM progress WHERE user_id = $1 AND lesson_id = $2',
            [req.user.id, lessonId]
        );

        if (progressCheck.rows.length > 0) {
            await query(
                'UPDATE progress SET is_completed = true, completed_at = CURRENT_TIMESTAMP WHERE id = $1',
                [progressCheck.rows[0].id]
            );
        } else {
            const enrollmentCheck = await query(
                'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = (SELECT course_id FROM lessons WHERE id = $2)',
                [req.user.id, lessonId]
            );

            if (enrollmentCheck.rows.length > 0) {
                await query(
                    `INSERT INTO progress (user_id, lesson_id, enrollment_id, is_completed, completed_at)
                      VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)`,
                    [req.user.id, lessonId, enrollmentCheck.rows[0].id]
                );
            }
        }
    }

    res.json({
        success: true,
        data: {
            score,
            totalQuestions: quizData.length,
            correctAnswers: correctCount,
            passed: score >= 60
        }
    });
});

/**
 * @desc    Get user attempts and leaderboards
 * @route   GET /api/v1/quiz/:lessonId/results
 * @access  Private
 */
const getQuizResults = asyncHandler(async (req, res) => {
    const { lessonId } = req.params;

    // Get user's best score
    const userBest = await query(
        `SELECT score, created_at FROM quiz_attempts 
         WHERE user_id = $1 AND lesson_id = $2
         ORDER BY score DESC LIMIT 1`,
        [req.user.id, lessonId]
    );

    // Get leaderboard
    const leaderboard = await query(
        `SELECT u.first_name, u.last_name, MAX(qa.score) as score
         FROM quiz_attempts qa
         JOIN users u ON qa.user_id = u.id
         WHERE qa.lesson_id = $1
         GROUP BY u.id, u.first_name, u.last_name
         ORDER BY score DESC
         LIMIT 10`,
        [lessonId]
    );

    res.json({
        success: true,
        data: {
            myBestScore: userBest.rows.length > 0 ? parseFloat(userBest.rows[0].score) : null,
            leaderboard: leaderboard.rows.map(r => ({
                name: `${r.first_name} ${r.last_name}`,
                score: parseFloat(r.score)
            }))
        }
    });
});

/**
 * @desc    Get all quizzes available to take
 * @route   GET /api/v1/quiz/available
 * @access  Private
 */
const getAvailableQuizzes = asyncHandler(async (req, res) => {
    // A query that fetches all 'quiz' type lessons for courses the user is enrolled in
    const quizzes = await query(`
         SELECT l.id, l.title, l.description, l.course_id, c.title as course_title, l.quiz_data
         FROM lessons l
         JOIN enrollments e ON e.course_id = l.course_id
         JOIN courses c ON c.id = l.course_id
         WHERE e.user_id = $1 AND e.status = 'active' AND l.type = 'quiz'
         ORDER BY c.title ASC, l.order_index ASC
    `, [req.user.id]);

    // Format them
    const data = quizzes.rows.map(q => ({
        id: q.id,
        title: q.title,
        description: q.description,
        courseId: q.course_id,
        courseTitle: q.course_title,
        questionCount: q.quiz_data ? (typeof q.quiz_data === 'string' ? JSON.parse(q.quiz_data).length : q.quiz_data.length) : 0
    }));

    res.json({
        success: true,
        data
    });
});

module.exports = {
    generateQuiz,
    submitQuiz,
    getQuizResults,
    getAvailableQuizzes
};
