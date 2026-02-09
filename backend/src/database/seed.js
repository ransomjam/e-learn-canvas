require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const seed = async () => {
    const client = await pool.connect();

    try {
        console.log('🌱 Starting database seeding...\n');

        await client.query('BEGIN');

        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        const adminId = uuidv4();
        await client.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO NOTHING
    `, [adminId, 'admin@elearn.com', adminPassword, 'Admin', 'User', 'admin', true]);
        console.log('  ✅ Admin user created: admin@elearn.com / admin123');

        // Create instructor user
        const instructorPassword = await bcrypt.hash('instructor123', 10);
        const instructorId = uuidv4();
        await client.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified, bio)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (email) DO NOTHING
    `, [instructorId, 'instructor@elearn.com', instructorPassword, 'John', 'Instructor', 'instructor', true, 'Experienced software developer and educator with 10+ years in the industry.']);
        console.log('  ✅ Instructor user created: instructor@elearn.com / instructor123');

        // Create learner user
        const learnerPassword = await bcrypt.hash('learner123', 10);
        const learnerId = uuidv4();
        await client.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO NOTHING
    `, [learnerId, 'learner@elearn.com', learnerPassword, 'Jane', 'Learner', 'learner', true]);
        console.log('  ✅ Learner user created: learner@elearn.com / learner123');

        // Create categories
        const categories = [
            { name: 'Web Development', slug: 'web-development', description: 'Learn to build modern web applications' },
            { name: 'Mobile Development', slug: 'mobile-development', description: 'Build iOS and Android applications' },
            { name: 'Data Science', slug: 'data-science', description: 'Master data analysis and machine learning' },
            { name: 'Design', slug: 'design', description: 'UI/UX and graphic design courses' },
            { name: 'Business', slug: 'business', description: 'Business and entrepreneurship skills' }
        ];

        const categoryIds = {};
        for (const cat of categories) {
            const catId = uuidv4();
            categoryIds[cat.slug] = catId;
            await client.query(`
        INSERT INTO categories (id, name, slug, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (slug) DO NOTHING
      `, [catId, cat.name, cat.slug, cat.description]);
        }
        console.log('  ✅ Categories created');

        // Create sample courses
        const courses = [
            {
                title: 'Complete Web Development Bootcamp',
                slug: 'complete-web-development-bootcamp',
                description: 'Learn HTML, CSS, JavaScript, React, Node.js and more in this comprehensive course.',
                short_description: 'Master full-stack web development from scratch',
                category: 'web-development',
                price: 99.99,
                level: 'beginner',
                duration_hours: 45
            },
            {
                title: 'Advanced React Patterns',
                slug: 'advanced-react-patterns',
                description: 'Master advanced React patterns including hooks, context, and performance optimization.',
                short_description: 'Take your React skills to the next level',
                category: 'web-development',
                price: 79.99,
                level: 'advanced',
                duration_hours: 20
            },
            {
                title: 'Python for Data Science',
                slug: 'python-for-data-science',
                description: 'Learn Python programming and data science libraries like NumPy, Pandas, and Matplotlib.',
                short_description: 'Start your data science journey with Python',
                category: 'data-science',
                price: 89.99,
                level: 'intermediate',
                duration_hours: 35
            }
        ];

        const courseIds = {};
        for (const course of courses) {
            const courseId = uuidv4();
            courseIds[course.slug] = courseId;
            await client.query(`
        INSERT INTO courses (id, instructor_id, category_id, title, slug, description, short_description, price, level, duration_hours, status, published_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published', CURRENT_TIMESTAMP)
        ON CONFLICT (slug) DO NOTHING
      `, [courseId, instructorId, categoryIds[course.category], course.title, course.slug, course.description, course.short_description, course.price, course.level, course.duration_hours]);
        }
        console.log('  ✅ Sample courses created');

        // Create sections and lessons for the first course
        const webDevCourseId = courseIds['complete-web-development-bootcamp'];

        const sections = [
            { title: 'Introduction to Web Development', order: 0 },
            { title: 'HTML Fundamentals', order: 1 },
            { title: 'CSS Styling', order: 2 },
            { title: 'JavaScript Basics', order: 3 }
        ];

        for (const section of sections) {
            const sectionId = uuidv4();
            await client.query(`
        INSERT INTO sections (id, course_id, title, order_index)
        VALUES ($1, $2, $3, $4)
      `, [sectionId, webDevCourseId, section.title, section.order]);

            // Add lessons to each section
            const lessons = [
                { title: `${section.title} - Lesson 1`, type: 'video', duration: 600, order: 0 },
                { title: `${section.title} - Lesson 2`, type: 'video', duration: 900, order: 1 },
                { title: `${section.title} - Practice`, type: 'assignment', duration: 0, order: 2 }
            ];

            for (const lesson of lessons) {
                const lessonSlug = lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                await client.query(`
          INSERT INTO lessons (id, section_id, course_id, title, slug, type, video_duration, order_index, is_free)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [uuidv4(), sectionId, webDevCourseId, lesson.title, lessonSlug, lesson.type, lesson.duration, lesson.order, lesson.order === 0 && section.order === 0]);
            }
        }
        console.log('  ✅ Sections and lessons created');

        // Create sample enrollment
        const enrollmentId = uuidv4();
        await client.query(`
      INSERT INTO enrollments (id, user_id, course_id, status, progress_percentage)
      VALUES ($1, $2, $3, 'active', 25.00)
    `, [enrollmentId, learnerId, webDevCourseId]);
        console.log('  ✅ Sample enrollment created');

        await client.query('COMMIT');
        console.log('\n✅ Database seeding completed successfully!');

        console.log('\n📋 Test Accounts:');
        console.log('   Admin:      admin@elearn.com / admin123');
        console.log('   Instructor: instructor@elearn.com / instructor123');
        console.log('   Learner:    learner@elearn.com / learner123');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Seeding failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
