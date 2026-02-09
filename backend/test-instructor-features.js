const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';

// Test credentials (update with actual credentials)
const ADMIN_EMAIL = 'admin@elearn.com';
const ADMIN_PASSWORD = 'admin123';

const INSTRUCTOR_EMAIL = 'instructor@elearn.com';
const INSTRUCTOR_PASSWORD = 'instructor123';

let adminToken = '';
let instructorToken = '';

async function testLogin(email, password) {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password
        });
        return response.data.data.accessToken;
    } catch (error) {
        console.error(`Login failed for ${email}:`, error.response?.data?.message || error.message);
        return null;
    }
}

async function testInstructorEndpoints() {
    console.log('\n📚 Testing Instructor Endpoints...\n');

    try {
        // Test dashboard
        const dashboard = await axios.get(`${API_URL}/instructor/dashboard`, {
            headers: { Authorization: `Bearer ${instructorToken}` }
        });
        console.log('✅ Instructor Dashboard:', dashboard.data.data);

        // Test students
        const students = await axios.get(`${API_URL}/instructor/students`, {
            headers: { Authorization: `Bearer ${instructorToken}` }
        });
        console.log('✅ Instructor Students:', students.data.data.students.length, 'students');

        // Test earnings
        const earnings = await axios.get(`${API_URL}/instructor/earnings`, {
            headers: { Authorization: `Bearer ${instructorToken}` }
        });
        console.log('✅ Instructor Earnings:', earnings.data.data);

    } catch (error) {
        console.error('❌ Instructor test failed:', error.response?.data?.message || error.message);
    }
}

async function testAdminEndpoints() {
    console.log('\n👑 Testing Admin Endpoints...\n');

    try {
        // Test users list
        const users = await axios.get(`${API_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✅ Admin Users:', users.data.data.users.length, 'users');

        // Test courses list
        const courses = await axios.get(`${API_URL}/admin/courses`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✅ Admin Courses:', courses.data.data.courses.length, 'courses');
        console.log('   Stats:', courses.data.data.stats);

        // Test transactions
        const transactions = await axios.get(`${API_URL}/admin/transactions`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✅ Admin Transactions:', transactions.data.data.transactions.length, 'transactions');

        // Test audit logs
        const auditLogs = await axios.get(`${API_URL}/admin/audit-logs`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✅ Audit Logs:', auditLogs.data.data.logs.length, 'logs');

    } catch (error) {
        console.error('❌ Admin test failed:', error.response?.data?.message || error.message);
    }
}

async function testAnalyticsEndpoints() {
    console.log('\n📊 Testing Analytics Endpoints...\n');

    try {
        // Test instructor analytics
        const instructorOverview = await axios.get(`${API_URL}/analytics/instructor/overview`, {
            headers: { Authorization: `Bearer ${instructorToken}` }
        });
        console.log('✅ Instructor Analytics:', instructorOverview.data.data);

        // Test admin analytics
        const adminOverview = await axios.get(`${API_URL}/analytics/admin/overview`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        console.log('✅ Admin Analytics:', adminOverview.data.data);

    } catch (error) {
        console.error('❌ Analytics test failed:', error.response?.data?.message || error.message);
    }
}

async function runTests() {
    console.log('🚀 Starting API Tests...\n');

    // Login as admin
    console.log('🔐 Logging in as admin...');
    adminToken = await testLogin(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (!adminToken) {
        console.log('⚠️  Admin login failed. Skipping admin tests.');
    }

    // Login as instructor
    console.log('🔐 Logging in as instructor...');
    instructorToken = await testLogin(INSTRUCTOR_EMAIL, INSTRUCTOR_PASSWORD);
    if (!instructorToken) {
        console.log('⚠️  Instructor login failed. Skipping instructor tests.');
    }

    // Run tests
    if (instructorToken) {
        await testInstructorEndpoints();
        await testAnalyticsEndpoints();
    }

    if (adminToken) {
        await testAdminEndpoints();
    }

    console.log('\n✨ Tests completed!\n');
}

// Run tests
runTests().catch(console.error);
