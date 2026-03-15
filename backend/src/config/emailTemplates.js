/**
 * Email Templates for Cradema E-Learning Platform
 * Beautiful, responsive HTML email templates
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PLATFORM_NAME = 'Cradema';

// ─── Base layout wrapper ───────────────────────────────────────────────
const baseLayout = (title, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">${PLATFORM_NAME}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">E-Learning Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #eee;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                &copy; ${new Date().getFullYear()} ${PLATFORM_NAME}. All rights reserved.<br>
                <a href="${FRONTEND_URL}" style="color:#6366f1;text-decoration:none;">${FRONTEND_URL.replace(/^https?:\/\//, '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ─── Reusable button ───────────────────────────────────────────────────
const btnPrimary = (text, url) => `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;">
  <tr>
    <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.3px;">${text}</a>
    </td>
  </tr>
</table>`;

// ─── Info card ─────────────────────────────────────────────────────────
const infoCard = (items) => {
    const rows = items.map(([label, value]) =>
        `<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #f1f5f9;">${label}</td><td style="padding:8px 12px;color:#1e293b;font-size:13px;font-weight:500;border-bottom:1px solid #f1f5f9;">${value}</td></tr>`
    ).join('');
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;margin:16px 0;border:1px solid #e2e8f0;">${rows}</table>`;
};

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
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Welcome aboard, ${firstName}! 🎉</h2>
            <p style="color:#64748b;font-size:15px;line-height:1.6;">
                Your ${PLATFORM_NAME} account has been created successfully. We're thrilled to have you join our learning community as a <strong>${roleName}</strong>.
            </p>
            ${infoCard([
                ['Name', `${firstName} ${lastName}`],
                ['Email', email],
                ['Account Type', roleName]
            ])}
            <p style="color:#64748b;font-size:15px;line-height:1.6;">
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
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Password Reset Request</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
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
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Password Changed Successfully ✅</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Hi ${firstName}, your password has been changed successfully. If you did not make this change, please contact our support team immediately.
        </p>
        ${btnPrimary('Go to Dashboard', `${FRONTEND_URL}/dashboard`)}
    `)
});

/**
 * Course enrollment confirmation — sent to student
 */
const enrollmentConfirmationEmail = ({ firstName, courseTitle, courseSlug, instructorName }) => ({
    subject: `You're enrolled in "${courseTitle}" 📚`,
    html: baseLayout('Enrollment Confirmed', `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Enrollment Confirmed! 🎓</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Hi ${firstName}, you've been successfully enrolled in a new course. Start learning today!
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Instructor', instructorName]
        ])}
        ${btnPrimary('Start Learning', `${FRONTEND_URL}/courses/${courseSlug}`)}
    `)
});

/**
 * New enrollment notification — sent to instructor
 */
const newStudentEnrollmentEmail = ({ instructorName, studentName, studentEmail, courseTitle }) => ({
    subject: `New student enrolled in "${courseTitle}" 🎉`,
    html: baseLayout('New Enrollment', `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">New Student Enrolled! 🎉</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Hi ${instructorName}, a new student has enrolled in your course.
        </p>
        ${infoCard([
            ['Student', studentName],
            ['Email', studentEmail],
            ['Course', courseTitle]
        ])}
        ${btnPrimary('View Students', `${FRONTEND_URL}/instructor/dashboard`)}
    `)
});

/**
 * Payment receipt — sent to student
 */
const paymentReceiptEmail = ({ firstName, courseTitle, amount, currency, transactionId, paidAt }) => ({
    subject: `Payment Receipt — ${courseTitle}`,
    html: baseLayout('Payment Receipt', `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Payment Received ✅</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Hi ${firstName}, thank you for your purchase! Here's your payment receipt.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Amount', `${currency} ${parseFloat(amount).toLocaleString()}`],
            ['Transaction ID', transactionId],
            ['Date', new Date(paidAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })]
        ])}
        ${btnPrimary('View My Courses', `${FRONTEND_URL}/dashboard`)}
        <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Keep this email for your records.</p>
    `)
});

/**
 * New lesson notification — sent to enrolled students
 */
const newLessonEmail = ({ firstName, courseTitle, courseSlug, lessonTitle, lessonType }) => ({
    subject: `New lesson added to "${courseTitle}" 📖`,
    html: baseLayout('New Lesson Available', `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">New Lesson Available! 📖</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Hi ${firstName}, a new ${lessonType || 'lesson'} has been added to a course you're enrolled in.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Lesson', lessonTitle],
            ['Type', (lessonType || 'video').charAt(0).toUpperCase() + (lessonType || 'video').slice(1)]
        ])}
        ${btnPrimary('Go to Course', `${FRONTEND_URL}/courses/${courseSlug}`)}
    `)
});

/**
 * Practice submission notification — sent to instructor
 */
const practiceSubmissionEmail = ({ instructorName, studentName, studentEmail, courseTitle, lessonTitle }) => ({
    subject: `New submission for "${lessonTitle}" in ${courseTitle}`,
    html: baseLayout('New Practice Submission', `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">New Practice Submission 📝</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Hi ${instructorName}, a student has submitted their practice work for review.
        </p>
        ${infoCard([
            ['Student', studentName],
            ['Email', studentEmail],
            ['Course', courseTitle],
            ['Lesson', lessonTitle]
        ])}
        ${btnPrimary('Review Submissions', `${FRONTEND_URL}/instructor/dashboard`)}
    `)
});

/**
 * Submission reviewed — sent to student
 */
const submissionReviewedEmail = ({ firstName, courseTitle, lessonTitle, status, feedback }) => {
    const isApproved = status === 'approved';
    const emoji = isApproved ? '✅' : '❌';
    const statusText = isApproved ? 'Approved' : 'Needs Revision';
    return {
        subject: `Your submission was ${statusText.toLowerCase()} ${emoji}`,
        html: baseLayout('Submission Reviewed', `
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Submission ${statusText} ${emoji}</h2>
            <p style="color:#64748b;font-size:15px;line-height:1.6;">
                Hi ${firstName}, your practice submission has been reviewed by the instructor.
            </p>
            ${infoCard([
                ['Course', courseTitle],
                ['Lesson', lessonTitle],
                ['Status', `<span style="color:${isApproved ? '#16a34a' : '#dc2626'};font-weight:600;">${statusText}</span>`]
            ])}
            ${feedback ? `
                <div style="background:#f8fafc;border-left:4px solid ${isApproved ? '#16a34a' : '#f59e0b'};border-radius:0 8px 8px 0;padding:14px 18px;margin:16px 0;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Instructor Feedback</p>
                    <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.5;">${feedback}</p>
                </div>
            ` : ''}
            ${btnPrimary('View Submission', `${FRONTEND_URL}/dashboard`)}
        `)
    };
};

/**
 * Certificate issued — sent to student
 */
const certificateIssuedEmail = ({ firstName, courseTitle, certificateNumber }) => ({
    subject: `Congratulations! Your certificate for "${courseTitle}" 🏆`,
    html: baseLayout('Certificate Issued', `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Certificate Earned! 🏆</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Congratulations ${firstName}! You've successfully completed the course and earned your certificate.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Certificate #', certificateNumber]
        ])}
        ${btnPrimary('View Certificate', `${FRONTEND_URL}/dashboard/certificates`)}
        <p style="color:#64748b;font-size:14px;line-height:1.5;margin-top:8px;text-align:center;">
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
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">New Course Review ⭐</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Hi ${instructorName}, a student has left a review on your course.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Student', studentName],
            ['Rating', '★'.repeat(rating) + '☆'.repeat(5 - rating)]
        ])}
        ${comment ? `
            <div style="background:#f8fafc;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:14px 18px;margin:16px 0;">
                <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Review Comment</p>
                <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.5;font-style:italic;">"${comment}"</p>
            </div>
        ` : ''}
        ${btnPrimary('View Reviews', `${FRONTEND_URL}/instructor/dashboard`)}
    `)
});

/**
 * Payment notification — sent to instructor
 */
const instructorPaymentNotificationEmail = ({ instructorName, studentName, courseTitle, amount, currency }) => ({
    subject: `New sale: "${courseTitle}" 💰`,
    html: baseLayout('New Sale', `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">New Sale! 💰</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Hi ${instructorName}, great news! You've made a new sale.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Student', studentName],
            ['Amount', `${currency} ${parseFloat(amount).toLocaleString()}`]
        ])}
        ${btnPrimary('View Earnings', `${FRONTEND_URL}/instructor/dashboard`)}
    `)
});

/**
 * Course completion notification — sent to student
 */
const courseCompletionEmail = ({ firstName, courseTitle }) => ({
    subject: `You've completed "${courseTitle}"! 🎓`,
    html: baseLayout('Course Completed', `
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Course Completed! 🎓</h2>
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Congratulations ${firstName}! You've successfully completed all lessons in the course.
        </p>
        ${infoCard([
            ['Course', courseTitle],
            ['Status', '<span style="color:#16a34a;font-weight:600;">Completed</span>']
        ])}
        <p style="color:#64748b;font-size:15px;line-height:1.6;">
            Your certificate may be available now or will be issued soon by the instructor.
        </p>
        ${btnPrimary('View Certificates', `${FRONTEND_URL}/dashboard/certificates`)}
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
