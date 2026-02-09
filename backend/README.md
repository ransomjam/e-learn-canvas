# E-Learn Canvas Backend API

A comprehensive REST API backend for the E-Learn Canvas e-learning platform. Built with Node.js, Express, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based auth with refresh tokens
- **Role-Based Access Control (RBAC)**: Admin, Instructor, and Learner roles
- **Complete Course Management**: Courses, sections, and lessons
- **Enrollment System**: Enroll, track progress, and complete courses
- **Payment Processing**: Payment intents and confirmation flow
- **Certificate Generation**: Auto-issue certificates upon course completion
- **Input Validation**: Comprehensive request validation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: express-validator
- **Security**: helmet, cors, rate-limiting

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Create the PostgreSQL database**:
   ```sql
   CREATE DATABASE elearn_canvas;
   ```

5. **Run migrations**:
   ```bash
   npm run migrate
   ```

6. **Seed the database** (optional - creates test users):
   ```bash
   npm run seed
   ```

7. **Start the server**:
   ```bash
   # Development mode (with hot reload)
   npm run dev

   # Production mode
   npm start
   ```

The API will be available at `http://localhost:3001`

### Test Accounts (after seeding)

| Role       | Email                    | Password       |
|------------|--------------------------|----------------|
| Admin      | admin@elearn.com         | admin123       |
| Instructor | instructor@elearn.com    | instructor123  |
| Learner    | learner@elearn.com       | learner123     |

## API Documentation

### Base URL
```
http://localhost:3001/api/v1
```

### Authentication

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## API Endpoints

### 🔐 Authentication (`/api/v1/auth`)

| Method | Endpoint           | Description              | Access  |
|--------|-------------------|--------------------------|---------|
| POST   | `/register`       | Register new user        | Public  |
| POST   | `/login`          | Login and get tokens     | Public  |
| POST   | `/refresh`        | Refresh access token     | Public  |
| POST   | `/logout`         | Logout user              | Private |
| GET    | `/me`             | Get current user         | Private |
| PUT    | `/change-password`| Change password          | Private |
| POST   | `/forgot-password`| Request password reset   | Public  |
| POST   | `/reset-password` | Reset password           | Public  |

#### Example: Register
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "learner"
  }'
```

#### Example: Login
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123"
  }'
```

---

### 👥 Users (`/api/v1/users`)

| Method | Endpoint         | Description            | Access          |
|--------|-----------------|------------------------|-----------------|
| GET    | `/`             | List all users         | Admin           |
| GET    | `/instructors`  | List instructors       | Public          |
| GET    | `/:id`          | Get user by ID         | Private         |
| PUT    | `/:id`          | Update user profile    | Private (owner) |
| PUT    | `/:id/role`     | Update user role       | Admin           |
| PUT    | `/:id/status`   | Activate/deactivate    | Admin           |
| DELETE | `/:id`          | Delete user            | Admin           |

---

### 📚 Courses (`/api/v1/courses`)

| Method | Endpoint           | Description            | Access              |
|--------|--------------------|------------------------|---------------------|
| GET    | `/`               | List courses           | Public              |
| GET    | `/categories`     | List categories        | Public              |
| GET    | `/instructor/me`  | Get my courses         | Instructor          |
| GET    | `/:id`            | Get course details     | Public              |
| POST   | `/`               | Create course          | Instructor          |
| PUT    | `/:id`            | Update course          | Instructor (owner)  |
| PUT    | `/:id/publish`    | Publish course         | Instructor (owner)  |
| PUT    | `/:id/archive`    | Archive course         | Instructor (owner)  |
| DELETE | `/:id`            | Delete course          | Instructor (owner)  |

#### Example: Create Course
```bash
curl -X POST http://localhost:3001/api/v1/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Learn Node.js",
    "description": "Complete Node.js course",
    "price": 49.99,
    "level": "beginner"
  }'
```

---

### 📖 Lessons (`/api/v1/lessons`)

| Method | Endpoint                    | Description           | Access      |
|--------|-----------------------------|-----------------------|-------------|
| GET    | `/course/:courseId`        | Get course lessons    | Public*     |
| GET    | `/:id`                     | Get lesson details    | Public*     |
| POST   | `/`                        | Create lesson         | Instructor  |
| PUT    | `/:id`                     | Update lesson         | Instructor  |
| DELETE | `/:id`                     | Delete lesson         | Instructor  |
| POST   | `/sections`                | Create section        | Instructor  |
| PUT    | `/sections/:id`            | Update section        | Instructor  |
| DELETE | `/sections/:id`            | Delete section        | Instructor  |
| PUT    | `/sections/:id/reorder`    | Reorder lessons       | Instructor  |

*Full content available only to enrolled users

---

### 📋 Enrollments (`/api/v1/enrollments`)

| Method | Endpoint            | Description             | Access      |
|--------|--------------------|-----------------------  |-------------|
| GET    | `/`                | Get my enrollments      | Private     |
| GET    | `/all`             | Get all enrollments     | Admin       |
| GET    | `/course/:courseId`| Get course enrollments  | Instructor  |
| GET    | `/:id`             | Get enrollment details  | Private     |
| POST   | `/`                | Enroll in course        | Private     |
| PUT    | `/:id/cancel`      | Cancel enrollment       | Private     |

#### Example: Enroll
```bash
curl -X POST http://localhost:3001/api/v1/enrollments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "courseId": "course-uuid-here"
  }'
```

---

### 📊 Progress (`/api/v1/progress`)

| Method | Endpoint              | Description              | Access   |
|--------|----------------------|--------------------------|----------|
| GET    | `/stats`             | Get learning stats       | Private  |
| GET    | `/course/:courseId`  | Get course progress      | Private  |
| GET    | `/lesson/:lessonId`  | Get lesson progress      | Private  |
| POST   | `/`                  | Update progress          | Private  |
| POST   | `/complete/:lessonId`| Mark lesson complete     | Private  |

---

### 💳 Payments (`/api/v1/payments`)

| Method | Endpoint        | Description              | Access      |
|--------|----------------|--------------------------|-------------|
| GET    | `/`            | Get my payments          | Private     |
| GET    | `/all`         | Get all payments         | Admin       |
| GET    | `/earnings`    | Get instructor earnings  | Instructor  |
| GET    | `/:id`         | Get payment details      | Private     |
| POST   | `/`            | Create payment           | Private     |
| POST   | `/:id/confirm` | Confirm payment          | Private     |
| POST   | `/:id/refund`  | Refund payment           | Admin       |

---

### 🎓 Certificates (`/api/v1/certificates`)

| Method | Endpoint                     | Description              | Access      |
|--------|------------------------------|--------------------------|-------------|
| GET    | `/`                          | Get my certificates      | Private     |
| GET    | `/all`                       | Get all certificates     | Admin       |
| GET    | `/course/:courseId`          | Get course certificates  | Instructor  |
| GET    | `/:id`                       | Get certificate details  | Private     |
| GET    | `/verify/:certificateNumber` | Verify certificate       | Public      |
| POST   | `/`                          | Issue certificate        | Instructor  |

---

## Database Schema

### Tables

- **users** - User accounts with roles
- **refresh_tokens** - JWT refresh tokens
- **categories** - Course categories
- **courses** - Course information
- **sections** - Course sections/chapters
- **lessons** - Individual lessons
- **enrollments** - User course enrollments
- **progress** - Lesson completion tracking
- **payments** - Payment transactions
- **certificates** - Completion certificates
- **reviews** - Course reviews

### Entity Relationships

```
users (1) ───── (*) courses (as instructor)
users (1) ───── (*) enrollments
courses (1) ─── (*) enrollments
courses (1) ─── (*) sections
sections (1) ── (*) lessons
enrollments (1) (*) progress
enrollments (1) (1) certificates
users (1) ───── (*) payments
courses (1) ─── (*) payments
```

## Scripts

```bash
# Development server with hot reload
npm run dev

# Production server
npm start

# Run database migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Seed database with test data
npm run seed

# Run tests
npm test
```

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Validation errors if applicable
}
```

### HTTP Status Codes

| Code | Description           |
|------|-----------------------|
| 200  | Success               |
| 201  | Created               |
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 402  | Payment Required      |
| 403  | Forbidden             |
| 404  | Not Found             |
| 409  | Conflict              |
| 429  | Too Many Requests     |
| 500  | Internal Server Error |

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Short-lived access tokens + long-lived refresh tokens
- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: All inputs validated and sanitized
- **CORS**: Configurable cross-origin policies
- **Helmet**: Security headers

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js      # PostgreSQL connection
│   │   └── constants.js     # App constants, roles, permissions
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── course.controller.js
│   │   ├── lesson.controller.js
│   │   ├── enrollment.controller.js
│   │   ├── progress.controller.js
│   │   ├── payment.controller.js
│   │   └── certificate.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   └── validation.middleware.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── course.routes.js
│   │   ├── lesson.routes.js
│   │   ├── enrollment.routes.js
│   │   ├── progress.routes.js
│   │   ├── payment.routes.js
│   │   └── certificate.routes.js
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── user.validator.js
│   │   ├── course.validator.js
│   │   ├── lesson.validator.js
│   │   ├── enrollment.validator.js
│   │   ├── progress.validator.js
│   │   ├── payment.validator.js
│   │   └── certificate.validator.js
│   ├── database/
│   │   ├── migrate.js       # Migration runner
│   │   └── seed.js          # Database seeder
│   ├── app.js               # Express app setup
│   └── index.js             # Entry point
├── .env                      # Environment variables
├── .env.example              # Environment template
├── package.json
└── README.md
```

## License

MIT
