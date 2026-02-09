# Instructor Features Migration

This migration adds the following features to the e-learning platform:

## New Features Added:

### 1. Course Moderation System
- Instructors can submit courses for review
- Admins can approve/reject courses
- Moderation status tracking (pending_review, approved, rejected)

### 2. User Ban System
- Admins can ban/unban users
- Ban reasons and expiration dates
- Automatic token invalidation on ban

### 3. Audit Logging
- Comprehensive audit trail for all admin actions
- Tracks user actions, course changes, payments, etc.
- IP address and user agent tracking

### 4. Notifications System
- In-app notifications for users
- Course approval/rejection notifications
- Refund notifications

### 5. Instructor Dashboard
- Overview statistics
- Student management
- Reviews management
- Earnings tracking

### 6. Admin Features
- User management with bulk actions
- Course moderation queue
- Transaction management with refunds
- Audit log viewing
- System settings management

## How to Run the Migration:

```bash
cd backend
node src/database/migrate-instructor-features.js
```

## New API Endpoints:

### Instructor Endpoints:
- GET /api/v1/instructor/dashboard - Dashboard overview
- GET /api/v1/instructor/students - List students
- GET /api/v1/instructor/reviews - List reviews
- GET /api/v1/instructor/earnings - Earnings data
- GET /api/v1/instructor/notifications - Get notifications
- PUT /api/v1/instructor/notifications/read - Mark as read

### Course Endpoints (Updated):
- PUT /api/v1/courses/:id/submit-review - Submit for review

### Admin Endpoints (Enhanced):
- GET /api/v1/admin/users - List users with filters
- PUT /api/v1/admin/users/:id/ban - Ban user
- PUT /api/v1/admin/users/:id/unban - Unban user
- POST /api/v1/admin/users/bulk - Bulk user actions
- GET /api/v1/admin/courses - List all courses
- GET /api/v1/admin/courses/pending - Pending courses
- PUT /api/v1/admin/courses/:id/approve - Approve course
- PUT /api/v1/admin/courses/:id/reject - Reject course
- GET /api/v1/admin/transactions - List transactions
- POST /api/v1/admin/transactions/:id/refund - Refund transaction
- GET /api/v1/admin/audit-logs - View audit logs
- GET /api/v1/admin/settings - Get settings
- PUT /api/v1/admin/settings - Update settings

## Database Changes:

### New Tables:
- `audit_logs` - Audit trail
- `notifications` - User notifications
- `system_settings` - System configuration

### Updated Tables:
- `courses` - Added moderation fields
- `users` - Added ban fields
- `payments` - Enhanced transaction tracking

## Notes:
- All admin actions are automatically logged
- Rate limiting is applied to all API endpoints
- CORS is configured for local development
