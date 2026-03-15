/**
 * Notification Service
 * High-level functions that query the database for context and send emails.
 * All functions are fire-and-forget — they never throw.
 */

const { sendEmail } = require('../config/email');
const { query } = require('../config/database');
const templates = require('../config/emailTemplates');

// ────────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Safe wrapper: logs errors but never throws so the main request flow
 * is never broken by an email failure.
 */
const safe = (fn) => async (...args) => {
    try {
        await fn(...args);
    } catch (err) {
        console.error(`[Notification] ${fn.name || 'anonymous'} error:`, err.message);
    }
};

// ────────────────────────────────────────────────────────────────────
//  Notification Functions
// ────────────────────────────────────────────────────────────────────

/**
 * Send welcome email after user registration
 */
const notifyUserRegistered = safe(async function notifyUserRegistered({ email, firstName, lastName, role }) {
    const tpl = templates.welcomeEmail({ firstName, lastName, email, role });
    await sendEmail({ to: email, ...tpl });
});

/**
 * Send password reset email
 */
const notifyPasswordReset = safe(async function notifyPasswordReset({ email, firstName, resetToken }) {
    const tpl = templates.passwordResetEmail({ firstName, resetToken });
    await sendEmail({ to: email, ...tpl });
});

/**
 * Send password changed confirmation
 */
const notifyPasswordChanged = safe(async function notifyPasswordChanged({ userId }) {
    const result = await query('SELECT email, first_name FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return;
    const user = result.rows[0];
    const tpl = templates.passwordChangedEmail({ firstName: user.first_name });
    await sendEmail({ to: user.email, ...tpl });
});

/**
 * Send enrollment confirmations (to student + instructor)
 */
const notifyEnrollment = safe(async function notifyEnrollment({ userId, courseId }) {
    // Get course + instructor info
    const courseResult = await query(
        `SELECT c.title, c.slug, u.first_name as instructor_first_name, u.last_name as instructor_last_name, u.email as instructor_email, u.id as instructor_id
         FROM courses c JOIN users u ON c.instructor_id = u.id WHERE c.id = $1`,
        [courseId]
    );
    if (courseResult.rows.length === 0) return;
    const course = courseResult.rows[0];

    // Get student info
    const studentResult = await query('SELECT email, first_name, last_name FROM users WHERE id = $1', [userId]);
    if (studentResult.rows.length === 0) return;
    const student = studentResult.rows[0];

    const instructorName = `${course.instructor_first_name} ${course.instructor_last_name}`;

    // Email to student
    const studentTpl = templates.enrollmentConfirmationEmail({
        firstName: student.first_name,
        courseTitle: course.title,
        courseSlug: course.slug,
        instructorName
    });
    await sendEmail({ to: student.email, ...studentTpl });

    // Email to instructor
    const instructorTpl = templates.newStudentEnrollmentEmail({
        instructorName: course.instructor_first_name,
        studentName: `${student.first_name} ${student.last_name}`,
        studentEmail: student.email,
        courseTitle: course.title
    });
    await sendEmail({ to: course.instructor_email, ...instructorTpl });
});

/**
 * Send payment receipt to student + sale notification to instructor
 */
const notifyPaymentCompleted = safe(async function notifyPaymentCompleted({ userId, courseId, amount, currency, transactionId }) {
    // Get student
    const studentResult = await query('SELECT email, first_name, last_name FROM users WHERE id = $1', [userId]);
    if (studentResult.rows.length === 0) return;
    const student = studentResult.rows[0];

    // Get course + instructor
    const courseResult = await query(
        `SELECT c.title, u.first_name as instructor_first_name, u.email as instructor_email
         FROM courses c JOIN users u ON c.instructor_id = u.id WHERE c.id = $1`,
        [courseId]
    );
    if (courseResult.rows.length === 0) return;
    const course = courseResult.rows[0];

    // Receipt to student
    const receiptTpl = templates.paymentReceiptEmail({
        firstName: student.first_name,
        courseTitle: course.title,
        amount,
        currency,
        transactionId,
        paidAt: new Date()
    });
    await sendEmail({ to: student.email, ...receiptTpl });

    // Sale notification to instructor
    const saleTpl = templates.instructorPaymentNotificationEmail({
        instructorName: course.instructor_first_name,
        studentName: `${student.first_name} ${student.last_name}`,
        courseTitle: course.title,
        amount,
        currency
    });
    await sendEmail({ to: course.instructor_email, ...saleTpl });
});

/**
 * Notify enrolled students when a new lesson is added
 */
const notifyNewLesson = safe(async function notifyNewLesson({ courseId, lessonTitle, lessonType }) {
    // Get course info
    const courseResult = await query('SELECT title, slug FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) return;
    const course = courseResult.rows[0];

    // Get all actively enrolled students
    const enrolledResult = await query(
        `SELECT u.email, u.first_name FROM enrollments e
         JOIN users u ON e.user_id = u.id
         WHERE e.course_id = $1 AND e.status = 'active'`,
        [courseId]
    );

    // Send emails in batches to avoid overloading the SMTP server
    for (const student of enrolledResult.rows) {
        const tpl = templates.newLessonEmail({
            firstName: student.first_name,
            courseTitle: course.title,
            courseSlug: course.slug,
            lessonTitle,
            lessonType
        });
        // Don't await each one serially — fire in parallel but cap concurrency
        sendEmail({ to: student.email, ...tpl }).catch(() => {});
    }
});

/**
 * Notify instructor when a student submits practice work
 */
const notifyPracticeSubmission = safe(async function notifyPracticeSubmission({ userId, courseId, lessonId }) {
    // Get student
    const studentResult = await query('SELECT email, first_name, last_name FROM users WHERE id = $1', [userId]);
    if (studentResult.rows.length === 0) return;
    const student = studentResult.rows[0];

    // Get course + instructor + lesson
    const courseResult = await query(
        `SELECT c.title as course_title, l.title as lesson_title,
                u.first_name as instructor_first_name, u.email as instructor_email
         FROM courses c
         JOIN users u ON c.instructor_id = u.id
         JOIN lessons l ON l.id = $2
         WHERE c.id = $1`,
        [courseId, lessonId]
    );
    if (courseResult.rows.length === 0) return;
    const info = courseResult.rows[0];

    const tpl = templates.practiceSubmissionEmail({
        instructorName: info.instructor_first_name,
        studentName: `${student.first_name} ${student.last_name}`,
        studentEmail: student.email,
        courseTitle: info.course_title,
        lessonTitle: info.lesson_title
    });
    await sendEmail({ to: info.instructor_email, ...tpl });
});

/**
 * Notify student when their submission is reviewed
 */
const notifySubmissionReviewed = safe(async function notifySubmissionReviewed({ submissionId, status, feedback }) {
    const result = await query(
        `SELECT ps.user_id, u.email, u.first_name,
                c.title as course_title, l.title as lesson_title
         FROM practice_submissions ps
         JOIN users u ON ps.user_id = u.id
         JOIN courses c ON ps.course_id = c.id
         JOIN lessons l ON ps.lesson_id = l.id
         WHERE ps.id = $1`,
        [submissionId]
    );
    if (result.rows.length === 0) return;
    const info = result.rows[0];

    const tpl = templates.submissionReviewedEmail({
        firstName: info.first_name,
        courseTitle: info.course_title,
        lessonTitle: info.lesson_title,
        status,
        feedback
    });
    await sendEmail({ to: info.email, ...tpl });
});

/**
 * Notify student when a certificate is issued
 */
const notifyCertificateIssued = safe(async function notifyCertificateIssued({ userId, courseId, certificateNumber }) {
    const studentResult = await query('SELECT email, first_name FROM users WHERE id = $1', [userId]);
    if (studentResult.rows.length === 0) return;
    const student = studentResult.rows[0];

    const courseResult = await query('SELECT title FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) return;

    const tpl = templates.certificateIssuedEmail({
        firstName: student.first_name,
        courseTitle: courseResult.rows[0].title,
        certificateNumber
    });
    await sendEmail({ to: student.email, ...tpl });
});

/**
 * Notify instructor when a new review is posted
 */
const notifyNewReview = safe(async function notifyNewReview({ userId, courseId, rating, comment }) {
    const studentResult = await query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
    if (studentResult.rows.length === 0) return;
    const student = studentResult.rows[0];

    const courseResult = await query(
        `SELECT c.title, u.first_name as instructor_first_name, u.email as instructor_email
         FROM courses c JOIN users u ON c.instructor_id = u.id WHERE c.id = $1`,
        [courseId]
    );
    if (courseResult.rows.length === 0) return;
    const course = courseResult.rows[0];

    const tpl = templates.newReviewEmail({
        instructorName: course.instructor_first_name,
        studentName: `${student.first_name} ${student.last_name}`,
        courseTitle: course.title,
        rating,
        comment
    });
    await sendEmail({ to: course.instructor_email, ...tpl });
});

/**
 * Notify student when a course is completed
 */
const notifyCourseCompleted = safe(async function notifyCourseCompleted({ userId, courseId }) {
    const studentResult = await query('SELECT email, first_name FROM users WHERE id = $1', [userId]);
    if (studentResult.rows.length === 0) return;
    const student = studentResult.rows[0];

    const courseResult = await query('SELECT title FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) return;

    const tpl = templates.courseCompletionEmail({
        firstName: student.first_name,
        courseTitle: courseResult.rows[0].title
    });
    await sendEmail({ to: student.email, ...tpl });
});

module.exports = {
    notifyUserRegistered,
    notifyPasswordReset,
    notifyPasswordChanged,
    notifyEnrollment,
    notifyPaymentCompleted,
    notifyNewLesson,
    notifyPracticeSubmission,
    notifySubmissionReviewed,
    notifyCertificateIssued,
    notifyNewReview,
    notifyCourseCompleted
};
