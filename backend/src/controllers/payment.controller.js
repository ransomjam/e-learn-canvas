const { query } = require('../config/database');
const { asyncHandler, ApiError } = require('../middleware/error.middleware');
const { v4: uuidv4 } = require('uuid');

/**
 * @desc    Create payment intent
 * @route   POST /api/v1/payments
 * @access  Private
 */
const createPayment = asyncHandler(async (req, res) => {
    const { courseId, paymentMethod } = req.body;

    // Check if course exists
    const courseResult = await query(
        'SELECT id, title, price, discount_price, currency, status FROM courses WHERE id = $1',
        [courseId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    const course = courseResult.rows[0];

    if (course.status !== 'published') {
        throw new ApiError(400, 'This course is not available for purchase');
    }

    // Check if already enrolled
    const enrollmentResult = await query(
        "SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
        [req.user.id, courseId]
    );

    if (enrollmentResult.rows.length > 0) {
        throw new ApiError(400, 'You are already enrolled in this course');
    }

    // Check if there's a pending payment
    const pendingPayment = await query(
        "SELECT id FROM payments WHERE user_id = $1 AND course_id = $2 AND status = 'pending' AND created_at > NOW() - INTERVAL '30 minutes'",
        [req.user.id, courseId]
    );

    if (pendingPayment.rows.length > 0) {
        throw new ApiError(400, 'You have a pending payment for this course');
    }

    // Calculate amount
    const amount = course.discount_price || course.price;

    // Create payment record
    const transactionId = `TXN-${Date.now()}-${uuidv4().substring(0, 8)}`;

    const result = await query(
        `INSERT INTO payments (user_id, course_id, amount, currency, status, payment_method, transaction_id)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6)
     RETURNING *`,
        [req.user.id, courseId, amount, course.currency, paymentMethod || 'card', transactionId]
    );

    const payment = result.rows[0];

    // In a real application, you would integrate with Stripe or another payment provider here
    // For now, we'll return the payment details for the client to process

    res.status(201).json({
        success: true,
        message: 'Payment initiated',
        data: {
            paymentId: payment.id,
            transactionId: payment.transaction_id,
            amount: parseFloat(payment.amount),
            currency: payment.currency,
            status: payment.status,
            course: {
                id: course.id,
                title: course.title
            },
            // In production, this would be a Stripe client secret or similar
            clientSecret: `cs_${uuidv4()}`
        }
    });
});

/**
 * @desc    Confirm payment (after client-side processing)
 * @route   POST /api/v1/payments/:id/confirm
 * @access  Private
 */
const confirmPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { transactionId, providerPaymentId } = req.body;

    // Get payment
    const paymentResult = await query(
        'SELECT * FROM payments WHERE id = $1',
        [id]
    );

    if (paymentResult.rows.length === 0) {
        throw new ApiError(404, 'Payment not found');
    }

    const payment = paymentResult.rows[0];

    // Verify ownership
    if (payment.user_id !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    if (payment.status !== 'pending') {
        throw new ApiError(400, `Payment is already ${payment.status}`);
    }

    // In production, verify the payment with the payment provider
    // For now, we'll simulate a successful payment

    // Update payment status
    await query(
        `UPDATE payments 
     SET status = 'completed', 
         provider_payment_id = $1,
         paid_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
        [providerPaymentId || `pi_${uuidv4()}`, id]
    );

    // Create enrollment
    const enrollmentResult = await query(
        `INSERT INTO enrollments (user_id, course_id, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active'
     RETURNING id`,
        [req.user.id, payment.course_id]
    );

    // Update payment with enrollment ID
    await query(
        'UPDATE payments SET enrollment_id = $1 WHERE id = $2',
        [enrollmentResult.rows[0].id, id]
    );

    // Update course enrollment count
    await query(
        'UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = $1',
        [payment.course_id]
    );

    res.json({
        success: true,
        message: 'Payment confirmed and enrollment successful',
        data: {
            paymentId: id,
            enrollmentId: enrollmentResult.rows[0].id,
            status: 'completed'
        }
    });
});

/**
 * @desc    Get payment by ID
 * @route   GET /api/v1/payments/:id
 * @access  Private
 */
const getPaymentById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
        `SELECT p.*, c.title as course_title, c.thumbnail_url
     FROM payments p
     JOIN courses c ON p.course_id = c.id
     WHERE p.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new ApiError(404, 'Payment not found');
    }

    const payment = result.rows[0];

    // Check access
    if (req.user.role !== 'admin' && payment.user_id !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    res.json({
        success: true,
        data: {
            id: payment.id,
            amount: parseFloat(payment.amount),
            currency: payment.currency,
            status: payment.status,
            paymentMethod: payment.payment_method,
            transactionId: payment.transaction_id,
            paidAt: payment.paid_at,
            createdAt: payment.created_at,
            course: {
                id: payment.course_id,
                title: payment.course_title,
                thumbnailUrl: payment.thumbnail_url
            }
        }
    });
});

/**
 * @desc    Get user's payments
 * @route   GET /api/v1/payments
 * @access  Private
 */
const getMyPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.user_id = $1';
    const params = [req.user.id];
    let paramIndex = 2;

    if (status) {
        whereClause += ` AND p.status = $${paramIndex++}`;
        params.push(status);
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM payments p ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
        `SELECT p.id, p.amount, p.currency, p.status, p.transaction_id, p.paid_at, p.created_at,
            c.id as course_id, c.title as course_title, c.thumbnail_url
     FROM payments p
     JOIN courses c ON p.course_id = c.id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            payments: result.rows.map(p => ({
                id: p.id,
                amount: parseFloat(p.amount),
                currency: p.currency,
                status: p.status,
                transactionId: p.transaction_id,
                paidAt: p.paid_at,
                createdAt: p.created_at,
                course: {
                    id: p.course_id,
                    title: p.course_title,
                    thumbnailUrl: p.thumbnail_url
                }
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        }
    });
});

/**
 * @desc    Get all payments (admin)
 * @route   GET /api/v1/payments/all
 * @access  Private/Admin
 */
const getAllPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, startDate, endDate, courseId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
        whereClause += ` AND p.status = $${paramIndex++}`;
        params.push(status);
    }

    if (courseId) {
        whereClause += ` AND p.course_id = $${paramIndex++}`;
        params.push(courseId);
    }

    if (startDate) {
        whereClause += ` AND p.created_at >= $${paramIndex++}`;
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ` AND p.created_at <= $${paramIndex++}`;
        params.push(endDate);
    }

    const countResult = await query(
        `SELECT COUNT(*) FROM payments p ${whereClause}`,
        params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get total revenue
    const revenueResult = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_revenue FROM payments p ${whereClause} AND p.status = 'completed'`,
        params
    );

    const result = await query(
        `SELECT p.*, 
            c.title as course_title,
            u.first_name, u.last_name, u.email
     FROM payments p
     JOIN courses c ON p.course_id = c.id
     JOIN users u ON p.user_id = u.id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        data: {
            totalRevenue: parseFloat(revenueResult.rows[0].total_revenue),
            payments: result.rows.map(p => ({
                id: p.id,
                amount: parseFloat(p.amount),
                currency: p.currency,
                status: p.status,
                transactionId: p.transaction_id,
                paidAt: p.paid_at,
                createdAt: p.created_at,
                course: {
                    id: p.course_id,
                    title: p.course_title
                },
                user: {
                    id: p.user_id,
                    firstName: p.first_name,
                    lastName: p.last_name,
                    email: p.email
                }
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        }
    });
});

/**
 * @desc    Refund payment (admin)
 * @route   POST /api/v1/payments/:id/refund
 * @access  Private/Admin
 */
const refundPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason, amount } = req.body;

    // Get payment
    const paymentResult = await query(
        'SELECT * FROM payments WHERE id = $1',
        [id]
    );

    if (paymentResult.rows.length === 0) {
        throw new ApiError(404, 'Payment not found');
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'completed') {
        throw new ApiError(400, 'Only completed payments can be refunded');
    }

    if (payment.status === 'refunded') {
        throw new ApiError(400, 'Payment has already been refunded');
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > parseFloat(payment.amount)) {
        throw new ApiError(400, 'Refund amount cannot exceed original payment');
    }

    // In production, process refund with payment provider

    // Update payment
    await query(
        `UPDATE payments 
     SET status = 'refunded', 
         refund_amount = $1, 
         refund_reason = $2, 
         refunded_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
        [refundAmount, reason, id]
    );

    // Cancel enrollment
    if (payment.enrollment_id) {
        await query(
            "UPDATE enrollments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [payment.enrollment_id]
        );

        // Update course enrollment count
        await query(
            'UPDATE courses SET enrollment_count = GREATEST(enrollment_count - 1, 0) WHERE id = $1',
            [payment.course_id]
        );
    }

    res.json({
        success: true,
        message: 'Payment refunded successfully',
        data: {
            paymentId: id,
            refundAmount: parseFloat(refundAmount),
            status: 'refunded'
        }
    });
});

/**
 * @desc    Get instructor earnings
 * @route   GET /api/v1/payments/earnings
 * @access  Private/Instructor
 */
const getInstructorEarnings = asyncHandler(async (req, res) => {
    const { period = 'all' } = req.query;

    let dateFilter = '';
    if (period === 'month') {
        dateFilter = "AND p.paid_at >= NOW() - INTERVAL '1 month'";
    } else if (period === 'year') {
        dateFilter = "AND p.paid_at >= NOW() - INTERVAL '1 year'";
    }

    const result = await query(
        `SELECT 
       c.id as course_id, c.title as course_title,
       COUNT(p.id) as sales_count,
       COALESCE(SUM(p.amount), 0) as total_revenue,
       COALESCE(SUM(CASE WHEN p.paid_at >= NOW() - INTERVAL '30 days' THEN p.amount ELSE 0 END), 0) as monthly_revenue
     FROM courses c
     LEFT JOIN payments p ON c.id = p.course_id AND p.status = 'completed' ${dateFilter}
     WHERE c.instructor_id = $1
     GROUP BY c.id
     ORDER BY total_revenue DESC`,
        [req.user.id]
    );

    const totalResult = await query(
        `SELECT 
       COALESCE(SUM(p.amount), 0) as total_earnings,
       COUNT(p.id) as total_sales
     FROM payments p
     JOIN courses c ON p.course_id = c.id
     WHERE c.instructor_id = $1 AND p.status = 'completed' ${dateFilter}`,
        [req.user.id]
    );

    res.json({
        success: true,
        data: {
            totalEarnings: parseFloat(totalResult.rows[0].total_earnings),
            totalSales: parseInt(totalResult.rows[0].total_sales),
            courseEarnings: result.rows.map(r => ({
                courseId: r.course_id,
                courseTitle: r.course_title,
                salesCount: parseInt(r.sales_count),
                totalRevenue: parseFloat(r.total_revenue),
                monthlyRevenue: parseFloat(r.monthly_revenue)
            }))
        }
    });
});

/**
 * @desc    Initiate Fapshi mobile money payment
 * @route   POST /api/v1/payments/fapshi
 * @access  Private
 */
const createFapshiPayment = asyncHandler(async (req, res) => {
    const { courseId } = req.body;
    const fapshi = require('../config/fapshi');

    if (!courseId) {
        throw new ApiError(400, 'Course ID is required');
    }

    // Check if course exists
    const courseResult = await query(
        'SELECT id, title, price, discount_price, currency, status FROM courses WHERE id = $1',
        [courseId]
    );

    if (courseResult.rows.length === 0) {
        throw new ApiError(404, 'Course not found');
    }

    const course = courseResult.rows[0];

    if (course.status !== 'published') {
        throw new ApiError(400, 'This course is not available for purchase');
    }

    // Check if already enrolled
    const enrollmentResult = await query(
        "SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
        [req.user.id, courseId]
    );

    if (enrollmentResult.rows.length > 0) {
        throw new ApiError(400, 'You are already enrolled in this course');
    }

    const amount = parseFloat(course.discount_price || course.price);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const externalId = `${courseId}-${req.user.id}-${Date.now()}`;
    
    const payload = {
        amount: Math.round(amount),
        externalId: externalId,
        redirectUrl: `${frontendUrl}/payment/callback`,
        message: `Payment for course: ${course.title}`
    };

    // Initiate Fapshi payment
    let fapshiResponse;
    try {
        fapshiResponse = await fapshi.initiatePay(payload);
    } catch (err) {
        const errMsg = err.response?.data?.message || err.message || 'Payment initiation failed';
        console.error('Fapshi payment error:', err.response?.data || err.message);
        throw new ApiError(400, `Payment failed: ${errMsg}`);
    }

    const transactionId = fapshiResponse.transId || `TXN-FAPSHI-${Date.now()}-${uuidv4().substring(0, 8)}`;

    // Create payment record in DB
    const result = await query(
        `INSERT INTO payments (user_id, course_id, amount, currency, status, payment_method, payment_provider, transaction_id, provider_response, external_id)
         VALUES ($1, $2, $3, $4, 'pending', 'mobile_money', 'fapshi', $5, $6, $7)
         RETURNING *`,
        [req.user.id, courseId, amount, course.currency, transactionId, JSON.stringify(fapshiResponse), externalId]
    );

    const payment = result.rows[0];

    res.status(201).json({
        success: true,
        message: 'Payment initiated. Redirecting to payment page.',
        data: {
            paymentId: payment.id,
            transactionId: transactionId,
            amount: parseFloat(payment.amount),
            currency: payment.currency,
            status: 'pending',
            link: fapshiResponse.link || null,
            course: {
                id: course.id,
                title: course.title
            }
        }
    });
});

/**
 * @desc    Check Fapshi payment status
 * @route   GET /api/v1/payments/fapshi/status/:transactionId
 * @access  Private
 */
const checkFapshiPaymentStatus = asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    const fapshi = require('../config/fapshi');

    // Get payment from DB
    const paymentResult = await query(
        'SELECT * FROM payments WHERE transaction_id = $1',
        [transactionId]
    );

    if (paymentResult.rows.length === 0) {
        throw new ApiError(404, 'Payment not found');
    }

    const payment = paymentResult.rows[0];

    // Verify ownership
    if (req.user.role !== 'admin' && payment.user_id !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    // If already completed, return status
    if (payment.status === 'completed') {
        return res.json({
            success: true,
            data: { status: 'completed', paymentId: payment.id }
        });
    }

    // Check with Fapshi
    try {
        const fapshiStatus = await fapshi.getPaymentStatus(transactionId);
        const statusMap = {
            CREATED: 'pending',
            PENDING: 'pending',
            SUCCESSFUL: 'completed',
            FAILED: 'failed',
            EXPIRED: 'failed'
        };
        const normalizedStatus = statusMap[(fapshiStatus.status || '').toUpperCase()] || 'pending';

        if (normalizedStatus === 'completed' && payment.status !== 'completed') {
            // Update payment
            await query(
                `UPDATE payments SET status = 'completed', provider_payment_id = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [transactionId, payment.id]
            );

            // Create enrollment
            const enrollmentResult = await query(
                `INSERT INTO enrollments (user_id, course_id, status)
                 VALUES ($1, $2, 'active')
                 ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active'
                 RETURNING id`,
                [payment.user_id, payment.course_id]
            );

            // Update payment with enrollment ID
            await query(
                'UPDATE payments SET enrollment_id = $1 WHERE id = $2',
                [enrollmentResult.rows[0].id, payment.id]
            );

            // Update course enrollment count
            await query(
                'UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = $1',
                [payment.course_id]
            );
        } else if (normalizedStatus === 'failed' && payment.status !== 'failed') {
            await query(
                `UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [payment.id]
            );
        }

        res.json({
            success: true,
            data: {
                status: normalizedStatus,
                paymentId: payment.id,
                fapshiStatus: fapshiStatus.status
            }
        });
    } catch (error) {
        // If Fapshi check fails, return current DB status
        res.json({
            success: true,
            data: {
                status: payment.status,
                paymentId: payment.id,
                error: 'Could not verify with payment provider'
            }
        });
    }
});

/**
 * @desc    Fapshi webhook handler
 * @route   POST /api/v1/payments/webhook/fapshi
 * @access  Public
 */
const handleFapshiWebhook = asyncHandler(async (req, res) => {
    const body = req.body || {};
    const transId = body.transId || body.trans_id || body.id;
    const fapshi = require('../config/fapshi');

    if (!transId) {
        return res.status(400).json({ message: 'transId required' });
    }

    try {
        // Verify by fetching status from Fapshi
        const data = await fapshi.getPaymentStatus(transId);
        const status = (data.status || '').toUpperCase();

        const statusMap = {
            SUCCESSFUL: 'completed',
            FAILED: 'failed',
            EXPIRED: 'failed',
            PENDING: 'pending',
            CREATED: 'pending'
        };
        const normalized = statusMap[status] || 'pending';

        // Get payment from DB
        const paymentResult = await query(
            'SELECT * FROM payments WHERE transaction_id = $1',
            [transId]
        );

        if (paymentResult.rows.length > 0) {
            const payment = paymentResult.rows[0];

            if (normalized === 'completed' && payment.status !== 'completed') {
                // Update payment
                await query(
                    `UPDATE payments SET status = 'completed', provider_payment_id = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                    [transId, payment.id]
                );

                // Create enrollment
                const enrollmentResult = await query(
                    `INSERT INTO enrollments (user_id, course_id, status)
                     VALUES ($1, $2, 'active')
                     ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active'
                     RETURNING id`,
                    [payment.user_id, payment.course_id]
                );

                await query(
                    'UPDATE payments SET enrollment_id = $1 WHERE id = $2',
                    [enrollmentResult.rows[0].id, payment.id]
                );

                await query(
                    'UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = $1',
                    [payment.course_id]
                );

                console.log(`Webhook: Payment ${transId} completed, enrollment created`);
            } else if (normalized === 'failed' && payment.status !== 'failed') {
                await query(
                    `UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [payment.id]
                );
            }
        }

        return res.json({ message: 'ok' });
    } catch (error) {
        console.error('Webhook verify error:', error.response?.data || error.message);
        return res.status(500).json({ message: 'failed to verify' });
    }
});

module.exports = {
    createPayment,
    confirmPayment,
    getPaymentById,
    getMyPayments,
    getAllPayments,
    refundPayment,
    getInstructorEarnings,
    createFapshiPayment,
    checkFapshiPaymentStatus,
    handleFapshiWebhook
};
