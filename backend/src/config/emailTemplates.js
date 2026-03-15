/**
 * Email Templates for Cradema E-Learning Platform
 * Beautiful, responsive HTML email templates with Cradema brand colors
 *
 * Brand palette (from logo & CSS):
 *   Primary blue : #1570EF  hsl(217,91%,50%)
 *   Purple accent : #8B5CF6
 *   Cyan accent   : #06B6D4
 *   Dark BG       : #0f172a  (slate-900)
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PLATFORM_NAME = 'Cradema';
// Logo hosted on the live site (works for both dev & production)
const LOGO_URL = (process.env.FRONTEND_URL || 'https://www.cradema.com') + '/New%20Logo.png';

// ─── Base layout wrapper ───────────────────────────────────────────────
const baseLayout = (title, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header with logo -->
          <tr>
            <td style="background:#0f172a;padding:28px 40px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${LOGO_URL}" alt="Cradema" width="44" height="44" style="display:block;border-radius:10px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Cradema</span>
                  </td>
                </tr>
              </table>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:13px;letter-spacing:0.5px;">E-Learning Platform</p>
            </td>
          </tr>
          <!-- Gradient accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#8B5CF6,#1570EF,#06B6D4);"></td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;line-height:1.5;">
                &copy; ${new Date().getFullYear()} ${PLATFORM_NAME}. All rights reserved.
              </p>
              <a href="${FRONTEND_URL}" style="color:#1570EF;text-decoration:none;font-size:12px;">${FRONTEND_URL.replace(/^https?:\/\//, '')}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── Reusable branded button ──────────────────────────────────────────
const btnPrimary = (text, url) => `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;">
  <tr>
    <td style="background:linear-gradient(135deg,#1570EF,#1e40af);border-radius:10px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 36px;color:#fff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.3px;">${text}</a>
    </td>
  </tr>
</table>`;

// ─── Info card ─────────────────────────────────────────────────────────
const infoCard = (items) => {
    const rows = items.map(([label, value]) =>
        `<tr><td style="padding:10px 14px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${label}</td><td style="padding:10px 14px;color:#0f172a;font-size:13px;font-weight:500;border-bottom:1px solid #f1f5f9;">${value}</td></tr>`
    ).join('');
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:10px;overflow:hidden;margin:16px 0;border:1px solid #e2e8f0;">${rows}</table>`;
};

// ─── Section heading ──────────────────────────────────────────────────
const heading = (text, emoji = '') => `
<h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;font-weight:700;">${text} ${emoji}</h2>`;

// ─── Feedback block ───────────────────────────────────────────────────
const feedbackBlock = (label, text, accentColor = '#1570EF') => `
<div style="background:#f8fafc;border-left:4px solid ${accentColor};border-radius:0 10px 10px 0;padding:14px 18px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">${label}</p>
  <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.6;">${text}</p>
</div>`;

// ─────────────────────────────────────────────────────────────────────
//  TEMPLATE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────

/**
 * Welcome email for new user registration
 */
const welcomeEmail = ({ firstName, lastName, email, role }) => {
    const roleName = role === 'instructor' ? 'Instructor' : 'Learner';
    return {
        subject: `Welcome to ${PLATFORM_NAME}! 🎉`,
        html: baseLayout(`Welcome to ${PLATFORM_NAME}`, `
            ${heading('Welcome aboard, ' + firstName + '!', '🎉')}
            <p style="color:#475569;font-size:15px;line-height:1.7;">
                Your ${PLATFORM_NAME} account has been created successfully. We're thrilled to have you join our learning community as a <strong>${roleName}</strong>.
            </p>
            ${infoCard([
                ['Name', `${firstName} ${lastName}`],
                ['Email', email],
                ['Account Type', roleName]
            ])}
            <p style="color:#475569;font-size:15px;line-height:1.7;">
                ${role === 'instructor'
                    ? 'Start creating your courses and sharing your knowledge with students around the world.'
                    : 'Browse our course catalog and start your learning journey today.'}
            </p>
            ${btnPrimary('Explore Courses', `${FRONTEND_URL}/courses`)}
        `)
    };
};

/**
 * Password reset email
 */
const passwordResetEmail = ({ firstName, resetToken }) => ({
    subject: `Reset Your ${PLATFORM_NAME} Password`,
    html: baseLayout('Password Reset', `
        ${heading('Password Reset Request')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Hi ${firstName}, we received a request to reset your password. Click the button below to create a new password. This link expires in <strong>1 hour</strong>.
        </p>
        ${btnPrimary('Reset Password', `${FRONTEND_URL}/reset-password?token=${resetToken}`)}
        <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin-top:20px;">
            If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
        </p>
    `)
});

/**
 * Password changed confirmation
 */
const passwordChangedEmail = ({ firstName }) => ({
    subject: `Your ${PLATFORM_NAME} Password Was Changed`,
    html: baseLayout('Password Changed', `
        ${heading('Password Changed Successfully', '✅')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Hi ${firstName}, your password has been changed successfully. If you did not make this change, please contact our support team immediately.
        </p>
        ${btnPrimary('Go to My Courses', `${FRONTEND_URL}/my-courses`)}
    `)
});

/**
 * Course enrollment confirmation — sent to student
 */
const enrollmentConfirmationEmail = ({ firstName, courseTitle, courseSlug, instructorName }) => ({
    subject: `You're enrolled in "${courseTitle}" 📚`,
    html: baseLayout('Enrollment Confirmed', `
        ${heading('Enrollment Confirmed!', '🎓')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Hi ${firstName}, you've been successfully enrolled in a new course. Start learning today!
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Instructor', instructorName]
        ])}
        ${btnPrimary('Start Learning', `${FRONTEND_URL}/course/${courseSlug}`)}
    `)
});

/**
 * New enrollment notification — sent to instructor
 */
const newStudentEnrollmentEmail = ({ instructorName, studentName, studentEmail, courseTitle }) => ({
    subject: `New student enrolled in "${courseTitle}" 🎉`,
    html: baseLayout('New Enrollment', `
        ${heading('New Student Enrolled!', '🎉')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Hi ${instructorName}, a new student has enrolled in your course.
        </p>
        ${infoCard([
            ['Student', studentName],
            ['Email', studentEmail],
            ['Course', courseTitle]
        ])}
        ${btnPrimary('View Dashboard', `${FRONTEND_URL}/instructor`)}
    `)
});

/**
 * Payment receipt — sent to student
 */
const paymentReceiptEmail = ({ firstName, courseTitle, amount, currency, transactionId, paidAt }) => ({
    subject: `Payment Receipt — ${courseTitle}`,
    html: baseLayout('Payment Receipt', `
        ${heading('Payment Received', '✅')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Hi ${firstName}, thank you for your purchase! Here's your payment receipt.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Amount', `${currency} ${parseFloat(amount).toLocaleString()}`],
            ['Transaction ID', transactionId],
            ['Date', new Date(paidAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })]
        ])}
        ${btnPrimary('View My Courses', `${FRONTEND_URL}/my-courses`)}
        <p style="color:#94a3b8;font-size:12px;margin-top:16px;text-align:center;">Keep this email for your records.</p>
    `)
});

/**
 * New lesson notification — sent to enrolled students
 */
const newLessonEmail = ({ firstName, courseTitle, courseSlug, lessonTitle, lessonType }) => ({
    subject: `New lesson added to "${courseTitle}" 📖`,
    html: baseLayout('New Lesson Available', `
        ${heading('New Lesson Available!', '📖')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Hi ${firstName}, a new ${lessonType || 'lesson'} has been added to a course you're enrolled in.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Lesson', lessonTitle],
            ['Type', (lessonType || 'video').charAt(0).toUpperCase() + (lessonType || 'video').slice(1)]
        ])}
        ${btnPrimary('Go to Course', `${FRONTEND_URL}/course/${courseSlug}`)}
    `)
});

/**
 * Practice submission notification — sent to instructor
 */
const practiceSubmissionEmail = ({ instructorName, studentName, studentEmail, courseTitle, lessonTitle }) => ({
    subject: `New submission for "${lessonTitle}" in ${courseTitle}`,
    html: baseLayout('New Practice Submission', `
        ${heading('New Practice Submission', '📝')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Hi ${instructorName}, a student has submitted their practice work for review.
        </p>
        ${infoCard([
            ['Student', studentName],
            ['Email', studentEmail],
            ['Course', courseTitle],
            ['Lesson', lessonTitle]
        ])}
        ${btnPrimary('Review Submissions', `${FRONTEND_URL}/instructor/submissions`)}
    `)
});

/**
 * Submission reviewed — sent to student
 */
const submissionReviewedEmail = ({ firstName, courseTitle, lessonTitle, status, feedback }) => {
    const isApproved = status === 'approved';
    const emoji = isApproved ? '✅' : '❌';
    const statusText = isApproved ? 'Approved' : 'Needs Revision';
    const statusColor = isApproved ? '#16a34a' : '#dc2626';
    return {
        subject: `Your submission was ${statusText.toLowerCase()} ${emoji}`,
        html: baseLayout('Submission Reviewed', `
            ${heading('Submission ' + statusText, emoji)}
            <p style="color:#475569;font-size:15px;line-height:1.7;">
                Hi ${firstName}, your practice submission has been reviewed by the instructor.
            </p>
            ${infoCard([
                ['Course', courseTitle],
                ['Lesson', lessonTitle],
                ['Status', `<span style="color:${statusColor};font-weight:700;">${statusText}</span>`]
            ])}
            ${feedback ? feedbackBlock('Instructor Feedback', feedback, isApproved ? '#16a34a' : '#f59e0b') : ''}
            ${btnPrimary('View My Courses', `${FRONTEND_URL}/my-courses`)}
        `)
    };
};

/**
 * Certificate issued — sent to student
 */
const certificateIssuedEmail = ({ firstName, courseTitle, certificateNumber }) => ({
    subject: `Congratulations! Your certificate for "${courseTitle}" 🏆`,
    html: baseLayout('Certificate Issued', `
        ${heading('Certificate Earned!', '🏆')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Congratulations ${firstName}! You've successfully completed the course and earned your certificate.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Certificate #', certificateNumber]
        ])}
        ${btnPrimary('View My Courses', `${FRONTEND_URL}/my-courses`)}
        <p style="color:#475569;font-size:14px;line-height:1.5;margin-top:8px;text-align:center;">
            Share your achievement with the world! 🌟
        </p>
    `)
});

/**
 * New review notification — sent to instructor
 */
const newReviewEmail = ({ instructorName, studentName, courseTitle, rating, comment }) => ({
    subject: `New ${rating}★ review on "${courseTitle}"`,
    html: baseLayout('New Course Review', `
        ${heading('New Course Review', '⭐')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Hi ${instructorName}, a student has left a review on your course.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Student', studentName],
            ['Rating', '★'.repeat(rating) + '☆'.repeat(5 - rating)]
        ])}
        ${comment ? feedbackBlock('Review Comment', `"${comment}"`, '#8B5CF6') : ''}
        ${btnPrimary('View Dashboard', `${FRONTEND_URL}/instructor`)}
    `)
});

/**
 * Payment notification — sent to instructor
 */
const instructorPaymentNotificationEmail = ({ instructorName, studentName, courseTitle, amount, currency }) => ({
    subject: `New sale: "${courseTitle}" 💰`,
    html: baseLayout('New Sale', `
        ${heading('New Sale!', '💰')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Hi ${instructorName}, great news! You've made a new sale.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Student', studentName],
            ['Amount', `${currency} ${parseFloat(amount).toLocaleString()}`]
        ])}
        ${btnPrimary('View Dashboard', `${FRONTEND_URL}/instructor`)}
    `)
});

/**
 * Course completion notification — sent to student
 */
const courseCompletionEmail = ({ firstName, courseTitle }) => ({
    subject: `You've completed "${courseTitle}"! 🎓`,
    html: baseLayout('Course Completed', `
        ${heading('Course Completed!', '🎓')}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Congratulations ${firstName}! You've successfully completed all lessons in the course.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Status', '<span style="color:#16a34a;font-weight:700;">Completed</span>']
        ])}
        <p style="color:#475569;font-size:15px;line-height:1.7;">
            Your certificate may be available now or will be issued soon by the instructor.
        </p>
        ${btnPrimary('View My Courses', `${FRONTEND_URL}/my-courses`)}
    `)
});

module.exports = {
    welcomeEmail,
    passwordResetEmail,
    passwordChangedEmail,
    enrollmentConfirmationEmail,
    newStudentEnrollmentEmail,
    paymentReceiptEmail,
    newLessonEmail,
    practiceSubmissionEmail,
    submissionReviewedEmail,
    certificateIssuedEmail,
    newReviewEmail,
    instructorPaymentNotificationEmail,
    courseCompletionEmail
};
