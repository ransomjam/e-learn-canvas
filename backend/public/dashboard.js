const API_URL = 'http://localhost:3001/api/v1';
let token = localStorage.getItem('token');
let refreshToken = localStorage.getItem('refreshToken');
let currentUser = null;
let currentView = 'overview';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Setup navigation event listeners
    document.querySelectorAll('#mainNav .nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switch (view) {
                case 'overview': loadDashboard(); break;
                case 'mycourses': loadMyCourses(); break;
                case 'profile': loadProfile(); break;
                case 'users': loadUsers(); break;
                case 'courses': loadCourses(); break;
                case 'transactions': loadTransactions(); break;
                case 'enrollment-codes': loadEnrollmentCodes(); break;
                case 'students': loadStudentEnrollments(); break;
            }
        });
    });

    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Check authentication
    if (!token) {
        showLogin();
    } else {
        fetchCurrentUser();
    }

    // Listen for storage changes (cross-tab sync)
    window.addEventListener('storage', (e) => {
        if (e.key === 'token' && !e.newValue) {
            token = null;
            currentUser = null;
            location.reload();
        }
    });
});

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
            token = data.data.accessToken;
            refreshToken = data.data.refreshToken;
            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', refreshToken);
            document.getElementById('loginOverlay').classList.add('hidden');
            fetchCurrentUser();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert('Login failed');
    }
});

function showLogin() {
    document.getElementById('loginOverlay').classList.remove('hidden');
}

/* === DEMO DATA === Remove this function before production */
async function demoLogin(email) {
    const password = 'demo123';
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            token = data.data.accessToken;
            refreshToken = data.data.refreshToken;
            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', refreshToken);
            document.getElementById('loginOverlay').classList.add('hidden');
            fetchCurrentUser();
        } else {
            alert('Demo login failed: ' + (data.message || 'Unknown error') + '\n\nMake sure you have run: node backend/src/database/seed-demo.js');
        }
    } catch (err) {
        alert('Demo login failed. Make sure the seed script has been run:\nnode backend/src/database/seed-demo.js');
    }
}
/* === END DEMO DATA === */

async function logout() {
    try {
        if (refreshToken) {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
        }
    } catch (err) {
        console.error('Logout failed', err);
    } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        token = null;
        refreshToken = null;
        currentUser = null;
        location.reload();
    }
}

// Wrapper for fetch with token refresh
async function fetchWithAuth(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    let response = await fetch(url, options);

    if (response.status === 401) {
        // Try refresh
        if (!refreshToken) {
            logout();
            return response;
        }

        try {
            const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            const refreshData = await refreshRes.json();

            if (refreshData.success) {
                token = refreshData.data.accessToken;
                refreshToken = refreshData.data.refreshToken;
                localStorage.setItem('token', token);
                localStorage.setItem('refreshToken', refreshToken);

                // Retry original request
                options.headers['Authorization'] = `Bearer ${token}`;
                response = await fetch(url, options);
            } else {
                logout();
            }
        } catch (err) {
            logout();
        }
    }

    return response;
}

// Fetch Current User
async function fetchCurrentUser() {
    try {
        const res = await fetchWithAuth(`${API_URL}/auth/me`);
        const data = await res.json();

        if (data.success) {
            currentUser = data.data;
            document.getElementById('userName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
            document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Instructor';
            document.getElementById('userAvatar').textContent = currentUser.firstName[0];
            document.getElementById('loginOverlay').classList.add('hidden');

            // Show/hide nav items based on role
            if (currentUser.role === 'instructor') {
                document.getElementById('usersNav').style.display = 'none';
                document.getElementById('transactionsNav').style.display = 'none';
                document.getElementById('coursesNav').style.display = 'none';
                document.getElementById('enrollmentCodesNav').style.display = 'none';
                document.getElementById('studentsNav').style.display = 'none';
            } else {
                document.getElementById('myCoursesNav').style.display = 'none';
            }

            loadDashboard();
        } else {
            logout();
        }
    } catch (err) {
        logout();
    }
}

// Navigation helper
function setActiveNav(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === view) {
            item.classList.add('active');
        }
    });
}

// Load Dashboard Data
async function loadDashboard() {
    setActiveNav('overview');

    if (!currentUser) return;

    const endpoint = currentUser.role === 'admin'
        ? `${API_URL}/analytics/admin/overview`
        : `${API_URL}/analytics/instructor/overview`;

    try {
        const res = await fetchWithAuth(endpoint);
        const data = await res.json();

        if (data.success) {
            renderDashboardView(data.data);
        }
    } catch (err) {
        console.error('Failed to load dashboard', err);
    }
}

function renderDashboardView(stats) {
    const mainContent = document.getElementById('mainContent');

    mainContent.innerHTML = `
        <div class="header">
            <h1>Dashboard Overview</h1>
            <button class="btn" style="width: auto;" onclick="logout()">Logout</button>
        </div>

        <div class="stats-grid" id="statsGrid">
            ${currentUser.role === 'admin' ? `
                <div class="stat-card">
                    <div class="stat-label">Total Users</div>
                    <div class="stat-value">${stats.users?.total || 0}</div>
                    <div class="stat-label" style="color: var(--secondary);">+${stats.users?.newThisMonth || 0} this month</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Revenue</div>
                    <div class="stat-value">${(stats.revenue?.total || 0).toLocaleString()} CFA</div>
                    <div class="stat-label" style="color: var(--secondary);">+${(stats.revenue?.thisMonth || 0).toLocaleString()} CFA this month</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Active Enrollments</div>
                    <div class="stat-value">${stats.enrollments?.total || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Pending Courses</div>
                    <div class="stat-value" style="color: var(--warning);">${stats.courses?.pendingReview || 0}</div>
                </div>
            ` : `
                <div class="stat-card">
                    <div class="stat-label">Total Courses</div>
                    <div class="stat-value">${stats.totalCourses || 0}</div>
                    <div class="stat-label" style="color: var(--warning);">Pending: ${stats.pendingCourses || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Active Students</div>
                    <div class="stat-value">${stats.activeStudents || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Revenue</div>
                    <div class="stat-value">${(stats.totalRevenue || 0).toLocaleString()} CFA</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Average Rating</div>
                    <div class="stat-value">${stats.averageRating || 0} ★</div>
                </div>
            `}
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <h3 style="margin-bottom: 1rem;">Revenue (Last 30 Days)</h3>
                <canvas id="revenueChart"></canvas>
            </div>
            <div class="chart-card">
                <h3 style="margin-bottom: 1rem;">${currentUser.role === 'admin' ? 'User Growth' : 'Enrollments'}</h3>
                <canvas id="userChart"></canvas>
            </div>
        </div>

        ${currentUser.role === 'admin' ? `
            <h3 style="margin-bottom: 1rem;">Recent Transactions</h3>
            <div class="table-card">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>User</th>
                            <th>Course</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody id="transactionsTable"></tbody>
                </table>
            </div>
        ` : `
            <h3 style="margin-bottom: 1rem;">My Courses</h3>
            <div class="table-card">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Students</th>
                            <th>Revenue</th>
                            <th>Rating</th>
                        </tr>
                    </thead>
                    <tbody id="instructorCoursesTable"></tbody>
                </table>
            </div>
        `}
    `;

    loadCharts();
    if (currentUser.role === 'admin') {
        loadRecentTransactions();
    } else {
        loadInstructorCourses();
    }
}

async function loadCharts() {
    const ctx1 = document.getElementById('revenueChart')?.getContext('2d');
    const ctx2 = document.getElementById('userChart')?.getContext('2d');
    if (!ctx1 || !ctx2) return;

    // Revenue Chart
    try {
        const revEndpoint = currentUser.role === 'admin' ? '/analytics/admin/revenue' : '/analytics/instructor/revenue';
        const revRes = await fetchWithAuth(`${API_URL}${revEndpoint}`);
        const revData = await revRes.json();

        if (revData.success && revData.data.revenue) {
            new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: revData.data.revenue.map(r => new Date(r.date).toLocaleDateString()),
                    datasets: [{
                        label: 'Revenue',
                        data: revData.data.revenue.map(r => r.revenue),
                        borderColor: '#4F46E5',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    } catch (err) {
        console.error('Failed to load revenue chart', err);
    }

    // User/Enrollment Chart
    if (currentUser.role === 'admin') {
        try {
            const userRes = await fetchWithAuth(`${API_URL}/analytics/admin/users`);
            const userData = await userRes.json();

            if (userData.success && userData.data.growth) {
                new Chart(ctx2, {
                    type: 'bar',
                    data: {
                        labels: userData.data.growth.map(r => new Date(r.date).toLocaleDateString()),
                        datasets: [{
                            label: 'New Users',
                            data: userData.data.growth.map(r => r.total),
                            backgroundColor: '#10B981'
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } }
                    }
                });
            }
        } catch (err) {
            console.error('Failed to load user chart', err);
        }
    } else {
        try {
            const enrollRes = await fetchWithAuth(`${API_URL}/analytics/instructor/enrollments`);
            const enrollData = await enrollRes.json();

            if (enrollData.success && enrollData.data.enrollments) {
                new Chart(ctx2, {
                    type: 'line',
                    data: {
                        labels: enrollData.data.enrollments.map(r => new Date(r.date).toLocaleDateString()),
                        datasets: [{
                            label: 'Enrollments',
                            data: enrollData.data.enrollments.map(r => r.count),
                            borderColor: '#10B981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true } }
                    }
                });
            }
        } catch (err) {
            console.error('Failed to load enrollment chart', err);
        }
    }
}

async function loadRecentTransactions() {
    if (currentUser.role !== 'admin') return;

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/transactions?limit=5`);
        const data = await res.json();

        if (data.success && data.data.transactions) {
            const tbody = document.getElementById('transactionsTable');
            tbody.innerHTML = data.data.transactions.map(t => `
                <tr>
                    <td>${t.transactionId.substring(0, 8)}...</td>
                    <td>${t.user?.name || 'N/A'}</td>
                    <td>${t.course?.title || 'N/A'}</td>
                    <td>${(t.amount || 0).toLocaleString()} CFA</td>
                    <td><span class="status-badge status-${t.status === 'completed' ? 'success' : 'warning'}">${t.status}</span></td>
                    <td>${new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load transactions', err);
    }
}

async function loadInstructorCourses() {
    try {
        const res = await fetchWithAuth(`${API_URL}/courses/instructor/me?limit=5`);
        const data = await res.json();

        if (data.success && data.data.courses) {
            const tbody = document.getElementById('instructorCoursesTable');
            if (data.data.courses.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No courses yet</td></tr>';
            } else {
                tbody.innerHTML = data.data.courses.map(c => `
                    <tr>
                        <td>${c.title}</td>
                        <td><span class="status-badge status-${c.status === 'published' ? 'success' : c.status === 'draft' ? 'warning' : 'danger'}">${c.status}</span></td>
                        <td>${c.enrollmentCount || 0}</td>
                        <td>${(c.price * (c.enrollmentCount || 0)).toLocaleString()} CFA</td>
                        <td>${c.ratingAvg ? c.ratingAvg.toFixed(1) + ' ★' : 'N/A'}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load instructor courses', err);
    }
}

// ============ USERS VIEW ============
async function loadUsers() {
    setActiveNav('users');

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>User Management</h1>
            <button class="btn" style="width: auto;" onclick="logout()">Logout</button>
        </div>
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="usersTable">
                    <tr><td colspan="6" style="text-align: center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/users`);
        const data = await res.json();

        if (data.success) {
            const tbody = document.getElementById('usersTable');
            if (data.data.users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No users found</td></tr>';
            } else {
                tbody.innerHTML = data.data.users.map(user => `
                    <tr>
                        <td>${user.firstName} ${user.lastName}</td>
                        <td>${user.email}</td>
                        <td><span class="status-badge status-${user.role === 'admin' ? 'warning' : 'success'}">${user.role}</span></td>
                        <td><span class="status-badge status-${user.isBanned ? 'danger' : 'success'}">${user.isBanned ? 'Banned' : 'Active'}</span></td>
                        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>
                            ${user.role !== 'admin' ? `
                                <button class="btn" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.75rem; background: ${user.isBanned ? 'var(--secondary)' : 'var(--danger)'};" onclick="${user.isBanned ? `unbanUser('${user.id}')` : `banUser('${user.id}')`}">
                                    ${user.isBanned ? 'Unban' : 'Ban'}
                                </button>
                            ` : '-'}
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load users', err);
        document.getElementById('usersTable').innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Failed to load users</td></tr>';
    }
}

async function banUser(userId) {
    if (!confirm('Are you sure you want to ban this user?')) return;

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}/ban`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Banned by admin' })
        });
        const data = await res.json();

        if (data.success) {
            alert('User banned successfully');
            loadUsers();
        } else {
            alert(data.message || 'Failed to ban user');
        }
    } catch (err) {
        alert('Failed to ban user');
    }
}

async function unbanUser(userId) {
    try {
        const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}/unban`, {
            method: 'PUT'
        });
        const data = await res.json();

        if (data.success) {
            alert('User unbanned successfully');
            loadUsers();
        } else {
            alert(data.message || 'Failed to unban user');
        }
    } catch (err) {
        alert('Failed to unban user');
    }
}

// ============ COURSES VIEW ============
async function loadCourses() {
    setActiveNav('courses');

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>Course Management</h1>
            <button class="btn" style="width: auto;" onclick="logout()">Logout</button>
        </div>
        <div class="stats-grid" style="margin-bottom: 1.5rem;">
            <div class="stat-card" id="courseStats">
                <div class="stat-label">Loading course stats...</div>
            </div>
        </div>
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Instructor</th>
                        <th>Status</th>
                        <th>Price</th>
                        <th>Enrollments</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="coursesTable">
                    <tr><td colspan="6" style="text-align: center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/courses`);
        const data = await res.json();

        if (data.success) {
            // Update stats
            const statsEl = document.getElementById('courseStats');
            const stats = data.data.stats || {};
            statsEl.innerHTML = `
                <div style="display: flex; gap: 2rem;">
                    <div><div class="stat-label">Total</div><div class="stat-value">${stats.total || data.data.courses.length}</div></div>
                    <div><div class="stat-label">Published</div><div class="stat-value" style="color: var(--secondary);">${stats.published || 0}</div></div>
                    <div><div class="stat-label">Pending</div><div class="stat-value" style="color: var(--warning);">${stats.pending || 0}</div></div>
                    <div><div class="stat-label">Draft</div><div class="stat-value" style="color: var(--text-muted);">${stats.draft || 0}</div></div>
                </div>
            `;

            const tbody = document.getElementById('coursesTable');
            if (data.data.courses.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No courses found</td></tr>';
            } else {
                tbody.innerHTML = data.data.courses.map(course => `
                    <tr>
                        <td>${course.title}</td>
                        <td>${course.instructor?.firstName || ''} ${course.instructor?.lastName || ''}</td>
                        <td><span class="status-badge status-${course.status === 'published' ? 'success' : course.status === 'draft' ? 'warning' : 'danger'}">${course.status}</span></td>
                        <td>${(course.price || 0).toLocaleString()} CFA</td>
                        <td>${course.enrollmentCount || 0}</td>
                        <td>
                            <div style="display: flex; gap: 0.25rem;">
                                <button class="btn btn-sm" onclick="editCourse('${course.id}')">Edit</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteCourse('${course.id}')">Delete</button>
                                ${course.moderationStatus === 'pending_review' ? `
                                    <button class="btn btn-sm btn-success" onclick="approveCourse('${course.id}')">Approve</button>
                                    <button class="btn btn-sm btn-danger" onclick="rejectCourse('${course.id}')">Reject</button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load courses', err);
        document.getElementById('coursesTable').innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Failed to load courses</td></tr>';
    }
}

async function approveCourse(courseId) {
    try {
        const res = await fetchWithAuth(`${API_URL}/admin/courses/${courseId}/approve`, {
            method: 'PUT'
        });
        const data = await res.json();

        if (data.success) {
            alert('Course approved successfully');
            loadCourses();
        } else {
            alert(data.message || 'Failed to approve course');
        }
    } catch (err) {
        alert('Failed to approve course');
    }
}

async function rejectCourse(courseId) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/courses/${courseId}/reject`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();

        if (data.success) {
            alert('Course rejected');
            loadCourses();
        } else {
            alert(data.message || 'Failed to reject course');
        }
    } catch (err) {
        alert('Failed to reject course');
    }
}

// ============ TRANSACTIONS VIEW ============
async function loadTransactions() {
    setActiveNav('transactions');

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>Transactions</h1>
            <button class="btn" style="width: auto;" onclick="logout()">Logout</button>
        </div>
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Transaction ID</th>
                        <th>User</th>
                        <th>Course</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="allTransactionsTable">
                    <tr><td colspan="7" style="text-align: center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/transactions?limit=50`);
        const data = await res.json();

        if (data.success) {
            const tbody = document.getElementById('allTransactionsTable');
            if (!data.data.transactions || data.data.transactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No transactions found</td></tr>';
            } else {
                tbody.innerHTML = data.data.transactions.map(t => `
                    <tr>
                        <td>${t.transactionId}</td>
                        <td>${t.user?.name || 'N/A'}</td>
                        <td>${t.course?.title || 'N/A'}</td>
                        <td>${(t.amount || 0).toLocaleString()} CFA</td>
                        <td><span class="status-badge status-${t.status === 'completed' ? 'success' : t.status === 'refunded' ? 'danger' : 'warning'}">${t.status}</span></td>
                        <td>${new Date(t.createdAt).toLocaleDateString()}</td>
                        <td>
                            ${t.status === 'completed' ? `
                                <button class="btn" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--danger);" onclick="refundTransaction('${t.id}')">Refund</button>
                            ` : '-'}
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load transactions', err);
        document.getElementById('allTransactionsTable').innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Failed to load transactions</td></tr>';
    }
}

async function refundTransaction(transactionId) {
    const reason = prompt('Enter refund reason:');
    if (!reason) return;

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/transactions/${transactionId}/refund`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();

        if (data.success) {
            alert('Transaction refunded successfully');
            loadTransactions();
        } else {
            alert(data.message || 'Failed to refund transaction');
        }
    } catch (err) {
        alert('Failed to refund transaction');
    }
}

// ============ MY COURSES VIEW (INSTRUCTOR) ============
async function loadMyCourses() {
    setActiveNav('mycourses');

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>My Courses</h1>
            <button class="btn" style="width: auto;" onclick="showCreateCourse()">+ Create Course</button>
        </div>
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Moderation</th>
                        <th>Price</th>
                        <th>Students</th>
                        <th>Rating</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="myCoursesTable">
                    <tr><td colspan="7" style="text-align: center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const res = await fetchWithAuth(`${API_URL}/courses/instructor/me`);
        const data = await res.json();

        if (data.success) {
            const tbody = document.getElementById('myCoursesTable');
            if (data.data.courses.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No courses yet. Create your first course!</td></tr>';
            } else {
                tbody.innerHTML = data.data.courses.map(course => `
                    <tr>
                        <td>${course.title}</td>
                        <td><span class="status-badge status-${course.status === 'published' ? 'success' : course.status === 'draft' ? 'warning' : 'danger'}">${course.status}</span></td>
                        <td><span class="status-badge status-${course.moderationStatus === 'approved' ? 'success' : course.moderationStatus === 'pending_review' ? 'warning' : 'danger'}">${course.moderationStatus || 'draft'}</span></td>
                        <td>${(course.price || 0).toLocaleString()} CFA</td>
                        <td>${course.enrollmentCount || 0}</td>
                        <td>${course.ratingAvg ? course.ratingAvg.toFixed(1) + ' ★' : 'N/A'}</td>
                        <td>
                            <button class="btn btn-sm" onclick="editCourse('${course.id}')">Edit</button>
                            ${course.status === 'draft' ? `
                                <button class="btn btn-sm btn-success" onclick="submitForReview('${course.id}')">Submit</button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load courses', err);
        document.getElementById('myCoursesTable').innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Failed to load courses</td></tr>';
    }
}

function showCreateCourse() {
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>Create New Course</h1>
            <button class="btn" style="width: auto;" onclick="loadMyCourses()">← Back</button>
        </div>
        <div class="stat-card" style="max-width: 800px;">
            <form id="createCourseForm">
                <div class="form-group">
                    <label class="form-label">Course Title *</label>
                    <input type="text" class="form-input" name="title" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Short Description *</label>
                    <input type="text" class="form-input" name="shortDescription" required maxlength="500">
                </div>
                <div class="form-group">
                    <label class="form-label">Full Description</label>
                    <textarea class="form-input" name="description" rows="5"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Thumbnail Image</label>
                    <input type="file" class="form-input" name="thumbnail" accept="image/*">
                </div>
                <div class="form-group">
                    <label class="form-label">Price (USD) *</label>
                    <input type="number" class="form-input" name="price" required min="0" step="0.01" value="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Level *</label>
                    <select class="form-input" name="level" required>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Language</label>
                    <input type="text" class="form-input" name="language" value="English">
                </div>
                <button type="submit" class="btn">Create Course</button>
                <!-- === DEMO DATA === Remove this button before production -->
                <button type="button" class="btn" id="fillDemoDataBtn" style="margin-left: 0.5rem; background: #7c3aed;">🧪 Fill Demo Data</button>
                <!-- === END DEMO DATA === -->
            </form>
        </div>
    `;

    /* === DEMO DATA === Remove this block before production */
    const demoCoursesData = [
        {
            title: 'Complete Web Development Bootcamp 2024',
            shortDescription: 'Learn HTML, CSS, JavaScript, React, Node.js and more. Build 10+ real-world projects from scratch.',
            description: 'This comprehensive bootcamp takes you from absolute beginner to job-ready web developer. You\'ll learn HTML5, CSS3, JavaScript ES6+, React.js, Node.js, Express, PostgreSQL, and deployment. Includes 10+ hands-on projects including an e-commerce platform, social media app, and portfolio website. Perfect for career changers and self-taught developers looking to fill knowledge gaps.',
            price: '49.99',
            level: 'beginner',
            language: 'English'
        },
        {
            title: 'Advanced Python for Data Science & Machine Learning',
            shortDescription: 'Master Python, Pandas, NumPy, Scikit-learn, and TensorFlow. Real-world data science projects included.',
            description: 'Dive deep into Python for data science and machine learning. This course covers advanced Python techniques, data manipulation with Pandas, numerical computing with NumPy, visualization with Matplotlib and Seaborn, machine learning with Scikit-learn, and deep learning with TensorFlow/Keras. Includes 5 capstone projects using real datasets from Kaggle competitions.',
            price: '59.99',
            level: 'intermediate',
            language: 'English'
        },
        {
            title: 'UI/UX Design Masterclass: Figma to Production',
            shortDescription: 'Design beautiful interfaces using Figma. Learn design thinking, user research, prototyping and handoff.',
            description: 'Learn professional UI/UX design from concept to developer handoff. Master Figma for wireframing, prototyping, and design systems. Covers design thinking methodology, user research techniques, information architecture, visual design principles, micro-interactions, responsive design, and accessibility standards. Build a complete design portfolio with 3 case studies.',
            price: '39.99',
            level: 'beginner',
            language: 'English'
        }
    ];
    let demoIndex = 0;
    document.getElementById('fillDemoDataBtn').addEventListener('click', () => {
        const demo = demoCoursesData[demoIndex % demoCoursesData.length];
        const form = document.getElementById('createCourseForm');
        form.querySelector('[name="title"]').value = demo.title;
        form.querySelector('[name="shortDescription"]').value = demo.shortDescription;
        form.querySelector('[name="description"]').value = demo.description;
        form.querySelector('[name="price"]').value = demo.price;
        form.querySelector('[name="level"]').value = demo.level;
        form.querySelector('[name="language"]').value = demo.language;
        demoIndex++;
    });
    /* === END DEMO DATA === */

    document.getElementById('createCourseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Upload thumbnail first if provided
        let thumbnailUrl = '';
        const thumbnailFile = formData.get('thumbnail');
        if (thumbnailFile && thumbnailFile.size > 0) {
            const uploadFormData = new FormData();
            uploadFormData.append('file', thumbnailFile);

            try {
                const uploadRes = await fetchWithAuth(`${API_URL}/upload`, {
                    method: 'POST',
                    body: uploadFormData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success) {
                    thumbnailUrl = uploadData.data.url;
                }
            } catch (err) {
                console.error('Upload failed:', err);
            }
        }

        const courseData = {
            title: formData.get('title'),
            shortDescription: formData.get('shortDescription'),
            description: formData.get('description'),
            thumbnailUrl: thumbnailUrl,
            price: parseFloat(formData.get('price')),
            level: formData.get('level'),
            language: formData.get('language')
        };

        try {
            const res = await fetchWithAuth(`${API_URL}/courses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(courseData)
            });
            const data = await res.json();

            if (data.success) {
                alert('Course created successfully!');
                loadMyCourses();
            } else {
                alert(data.message || 'Failed to create course');
            }
        } catch (err) {
            alert('Failed to create course');
        }
    });
}

function editCourse(courseId) {
    loadCourseEditor(courseId);
}

async function loadCourseEditor(courseId) {
    const backNav = currentUser.role === 'admin' ? 'courses' : 'mycourses';
    setActiveNav(backNav);

    try {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}`);
        const data = await res.json();

        if (!data.success) {
            alert('Failed to load course');
            return;
        }

        const course = data.data;
        const mainContent = document.getElementById('mainContent');
        const backAction = currentUser.role === 'admin' ? 'loadCourses()' : 'loadMyCourses()';

        mainContent.innerHTML = `
            <div class="header">
                <h1>Edit Course: ${course.title}</h1>
                <button class="btn" style="width: auto;" onclick="${backAction}">← Back</button>
            </div>
            
            <div class="stat-card" style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">Course Details</h3>
                <form id="editCourseForm">
                    <div class="form-group">
                        <label class="form-label">Title</label>
                        <input type="text" class="form-input" name="title" value="${course.title}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Short Description</label>
                        <input type="text" class="form-input" name="shortDescription" value="${course.shortDescription || ''}" maxlength="500">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea class="form-input" name="description" rows="4">${course.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Thumbnail Image</label>
                        <input type="file" class="form-input" name="thumbnail" accept="image/*">
                        ${course.thumbnailUrl ? `<img src="${course.thumbnailUrl}" style="max-width: 200px; margin-top: 0.5rem; border-radius: 0.5rem;">` : ''}
                    </div>
                    <div class="form-group">
                        <label class="form-label">Price (USD)</label>
                        <input type="number" class="form-input" name="price" value="${course.price}" min="0" step="0.01">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Level</label>
                        <select class="form-input" name="level">
                            <option value="beginner" ${course.level === 'beginner' ? 'selected' : ''}>Beginner</option>
                            <option value="intermediate" ${course.level === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                            <option value="advanced" ${course.level === 'advanced' ? 'selected' : ''}>Advanced</option>
                        </select>
                    </div>
                    <button type="submit" class="btn">Update Course</button>
                </form>
            </div>
            
            <div class="stat-card">
                <div class="header" style="margin-bottom: 1rem;">
                    <h3>Lessons</h3>
                    <button class="btn" style="width: auto;" onclick="showAddLesson('${courseId}')">+ Add Lesson</button>
                </div>
                <div id="lessonsContainer">
                    ${course.sections && course.sections.length > 0 ?
                course.sections.map(section => `
                            <div style="margin-bottom: 1rem;">
                                <h4>${section.title}</h4>
                                ${section.lessons && section.lessons.length > 0 ?
                        section.lessons.map(lesson => `
                                        <div style="padding: 0.5rem; background: var(--bg-dark); margin: 0.5rem 0; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                                            <span style="cursor: pointer; flex: 1;" onclick="editLesson('${lesson.id}', '${courseId}')">
                                                ${lesson.type === 'pdf' ? '<span style="color: #ef4444;">📄</span>' :
                                lesson.type === 'ppt' ? '<span style="color: #f97316;">📊</span>' :
                                    lesson.type === 'doc' ? '<span style="color: #3b82f6;">📝</span>' :
                                        lesson.type === 'video' ? '🎥' :
                                            lesson.type === 'quiz' ? '❓' :
                                                lesson.type === 'assignment' ? '📋' : '📄'}
                                                ${lesson.title}
                                                <small style="color: var(--text-muted); margin-left: 0.5rem;">(${lesson.type})</small>
                                                ${lesson.isFree ? '<span style="background: var(--secondary); color: white; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.7rem; margin-left: 0.5rem;">FREE</span>' : ''}
                                            </span>
                                            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteLesson('${lesson.id}', '${courseId}')">Delete</button>
                                        </div>
                                    `).join('') : '<p style="color: var(--text-muted);">No lessons</p>'
                    }
                            </div>
                        `).join('') : '<p style="color: var(--text-muted);">No sections yet. Add a lesson to create a section.</p>'
            }
                </div>
            </div>

            <!-- Projects Section -->
            <div class="stat-card" style="margin-top: 1.5rem;">
                <div class="header" style="margin-bottom: 1rem;">
                    <h3>📋 Projects & Assignments</h3>
                    <button class="btn" style="width: auto;" onclick="showAddProject('${courseId}')">+ Add Project</button>
                </div>
                <div id="projectsContainer">
                    <p style="color: var(--text-muted); text-align: center;">Loading projects...</p>
                </div>
            </div>
        `;

        // Load projects into the container
        loadCourseProjects(courseId);

        document.getElementById('editCourseForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            // Upload thumbnail if new file provided
            let thumbnailUrl = course.thumbnailUrl;
            const thumbnailFile = formData.get('thumbnail');
            if (thumbnailFile && thumbnailFile.size > 0) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', thumbnailFile);

                try {
                    const uploadRes = await fetchWithAuth(`${API_URL}/upload`, {
                        method: 'POST',
                        body: uploadFormData
                    });
                    const uploadData = await uploadRes.json();
                    if (uploadData.success) {
                        thumbnailUrl = uploadData.data.url;
                    }
                } catch (err) {
                    console.error('Upload failed:', err);
                }
            }

            const updateData = {
                title: formData.get('title'),
                shortDescription: formData.get('shortDescription'),
                description: formData.get('description'),
                thumbnailUrl: thumbnailUrl,
                price: parseFloat(formData.get('price')),
                level: formData.get('level')
            };

            try {
                const res = await fetchWithAuth(`${API_URL}/courses/${courseId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                const data = await res.json();

                if (data.success) {
                    alert('Course updated!');
                    loadCourseEditor(courseId);
                } else {
                    alert(data.message || 'Failed to update');
                }
            } catch (err) {
                alert('Failed to update course');
            }
        });
    } catch (err) {
        alert('Failed to load course');
    }
}

// ===== PROJECT MANAGEMENT FUNCTIONS =====

async function loadCourseProjects(courseId) {
    const container = document.getElementById('projectsContainer');
    if (!container) return;

    try {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/projects`);
        const data = await res.json();

        if (data.success && data.data.length > 0) {
            container.innerHTML = data.data.map(project => `
                <div style="padding: 0.75rem 1rem; background: var(--bg-dark); margin: 0.5rem 0; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">📋 ${project.title}</div>
                        ${project.description ? `<small style="color: var(--text-muted); display: block; margin-top: 0.25rem;">${project.description}</small>` : ''}
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                            ${project.due_date ? `<small style="color: var(--warning);">📅 Due: ${new Date(project.due_date).toLocaleDateString()}</small>` : ''}
                            <small style="color: var(--text-muted);">📝 ${project.submission_count || 0} submissions</small>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-shrink: 0; margin-left: 1rem;">
                        <button class="btn btn-sm" onclick="viewProjectSubmissions('${project.id}', '${courseId}')">Submissions</button>
                        <button class="btn btn-sm" style="background: var(--warning);" onclick="showEditProject('${project.id}', '${courseId}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProject('${project.id}', '${courseId}')">Delete</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No projects yet. Click "+ Add Project" to create one.</p>';
        }
    } catch (err) {
        console.error('Failed to load projects:', err);
        container.innerHTML = '<p style="color: var(--danger); text-align: center;">Failed to load projects</p>';
    }
}

function showAddProject(courseId) {
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>Add Project</h1>
            <button class="btn" style="width: auto;" onclick="loadCourseEditor('${courseId}')">← Back to Course</button>
        </div>
        <div class="stat-card" style="max-width: 800px;">
            <form id="addProjectForm">
                <div class="form-group">
                    <label class="form-label">Project Title *</label>
                    <input type="text" class="form-input" name="title" required placeholder="e.g., Build a Portfolio Website">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <input type="text" class="form-input" name="description" placeholder="Brief overview of the project">
                </div>
                <div class="form-group">
                    <label class="form-label">Instructions</label>
                    <textarea class="form-input" name="instructions" rows="6" placeholder="Detailed instructions for students..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Attachment (optional)</label>
                    <input type="file" class="form-input" name="file">
                    <small style="color: var(--text-muted);">Upload any file (PDF, document, image, etc.) as a project resource</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Due Date (optional)</label>
                    <input type="date" class="form-input" name="dueDate">
                </div>
                <button type="submit" class="btn">Create Project</button>
            </form>
        </div>
    `;

    document.getElementById('addProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Use FormData directly to support file upload
        const submitData = new FormData();
        submitData.append('title', formData.get('title'));
        submitData.append('description', formData.get('description'));
        submitData.append('instructions', formData.get('instructions'));
        if (formData.get('dueDate')) submitData.append('dueDate', formData.get('dueDate'));
        const file = formData.get('file');
        if (file && file.size > 0) submitData.append('file', file);

        try {
            const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/projects`, {
                method: 'POST',
                body: submitData
            });
            const data = await res.json();

            if (data.success) {
                alert('Project created successfully!');
                loadCourseEditor(courseId);
            } else {
                alert(data.message || 'Failed to create project');
            }
        } catch (err) {
            alert('Failed to create project');
        }
    });
}

async function showEditProject(projectId, courseId) {
    try {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/projects/${projectId}`);
        const data = await res.json();

        if (!data.success) {
            alert('Failed to load project');
            return;
        }

        const project = data.data;
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="header">
                <h1>Edit Project</h1>
                <button class="btn" style="width: auto;" onclick="loadCourseEditor('${courseId}')">← Back to Course</button>
            </div>
            <div class="stat-card" style="max-width: 800px;">
                <form id="editProjectForm">
                    <div class="form-group">
                        <label class="form-label">Project Title *</label>
                        <input type="text" class="form-input" name="title" value="${project.title || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <input type="text" class="form-input" name="description" value="${project.description || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Instructions</label>
                        <textarea class="form-input" name="instructions" rows="6">${project.instructions || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Attachment</label>
                        ${project.attachment_url ? `<div style="margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-dark); border-radius: 0.5rem;">📎 <a href="${project.attachment_url}" target="_blank" style="color: var(--primary);">${project.attachment_name || 'Current file'}</a></div>` : ''}
                        <input type="file" class="form-input" name="file">
                        <small style="color: var(--text-muted);">${project.attachment_url ? 'Upload a new file to replace the current one' : 'Upload any file as a project resource'}</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Due Date (optional)</label>
                        <input type="date" class="form-input" name="dueDate" value="${project.due_date ? new Date(project.due_date).toISOString().split('T')[0] : ''}">
                    </div>
                    <button type="submit" class="btn">Save Changes</button>
                </form>
            </div>
        `;

        document.getElementById('editProjectForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            // Use FormData directly to support file upload
            const submitData = new FormData();
            submitData.append('title', formData.get('title'));
            submitData.append('description', formData.get('description'));
            submitData.append('instructions', formData.get('instructions'));
            if (formData.get('dueDate')) submitData.append('dueDate', formData.get('dueDate'));
            const file = formData.get('file');
            if (file && file.size > 0) submitData.append('file', file);

            try {
                const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/projects/${projectId}`, {
                    method: 'PUT',
                    body: submitData
                });
                const data = await res.json();

                if (data.success) {
                    alert('Project updated!');
                    loadCourseEditor(courseId);
                } else {
                    alert(data.message || 'Failed to update project');
                }
            } catch (err) {
                alert('Failed to update project');
            }
        });
    } catch (err) {
        alert('Failed to load project');
    }
}

async function deleteProject(projectId, courseId) {
    if (!confirm('Delete this project? All student submissions will also be removed.')) return;

    try {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/projects/${projectId}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (data.success) {
            alert('Project deleted');
            loadCourseProjects(courseId);
        } else {
            alert(data.message || 'Failed to delete project');
        }
    } catch (err) {
        alert('Failed to delete project');
    }
}

async function viewProjectSubmissions(projectId, courseId) {
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>Project Submissions</h1>
            <button class="btn" style="width: auto;" onclick="loadCourseEditor('${courseId}')">← Back to Course</button>
        </div>
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Submitted</th>
                        <th>Submission</th>
                        <th>Status</th>
                        <th>Grade</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="submissionsTable">
                    <tr><td colspan="6" style="text-align: center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/projects/${projectId}/submissions`);
        const data = await res.json();

        const tbody = document.getElementById('submissionsTable');
        if (data.success && data.data.length > 0) {
            tbody.innerHTML = data.data.map(sub => `
                <tr>
                    <td>${sub.first_name || ''} ${sub.last_name || ''}<br><small style="color: var(--text-muted);">${sub.email || ''}</small></td>
                    <td>${new Date(sub.created_at).toLocaleDateString()}</td>
                    <td>
                        ${sub.submission_url ? `<a href="${sub.submission_url}" target="_blank" style="color: var(--primary);">View Link</a>` : ''}
                        ${sub.submission_text ? `<small style="display: block; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sub.submission_text}</small>` : ''}
                        ${sub.file_name ? `<small style="color: var(--text-muted);">📎 ${sub.file_name}</small>` : ''}
                    </td>
                    <td><span class="status-badge status-${sub.status === 'graded' ? 'success' : sub.status === 'submitted' ? 'warning' : 'danger'}">${sub.status}</span></td>
                    <td>${sub.grade != null ? sub.grade + '/100' : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="showGradeForm('${sub.id}', '${projectId}', '${courseId}', ${sub.grade || 0}, '${(sub.instructor_feedback || '').replace(/'/g, "\\'")}')">Grade</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No submissions yet</td></tr>';
        }
    } catch (err) {
        console.error('Failed to load submissions:', err);
        document.getElementById('submissionsTable').innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Failed to load submissions</td></tr>';
    }
}

function showGradeForm(submissionId, projectId, courseId, currentGrade, currentFeedback) {
    const grade = prompt('Enter grade (0-100):', currentGrade || '');
    if (grade === null) return;
    const gradeNum = parseInt(grade);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
        alert('Please enter a valid grade between 0 and 100');
        return;
    }

    const feedback = prompt('Enter feedback for student (optional):', currentFeedback || '');

    gradeSubmission(submissionId, projectId, courseId, gradeNum, feedback);
}

async function gradeSubmission(submissionId, projectId, courseId, grade, feedback) {
    try {
        const res = await fetchWithAuth(`${API_URL}/courses/projects/submissions/${submissionId}/grade`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grade, feedback })
        });
        const data = await res.json();

        if (data.success) {
            alert('Submission graded!');
            viewProjectSubmissions(projectId, courseId);
        } else {
            alert(data.message || 'Failed to grade submission');
        }
    } catch (err) {
        alert('Failed to grade submission');
    }
}

// ===== END PROJECT MANAGEMENT FUNCTIONS =====

async function showAddLesson(courseId) {
    // Fetch existing sections first
    let existingSections = [];
    try {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}`);
        const data = await res.json();
        if (data.success && data.data.sections) {
            existingSections = data.data.sections;
        }
    } catch (err) {
        console.error('Failed to load sections:', err);
    }

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>Add Lesson</h1>
            <button class="btn" style="width: auto;" onclick="loadCourseEditor('${courseId}')">← Back</button>
        </div>
        <div class="stat-card" style="max-width: 800px;">
            <form id="addLessonForm">
                <div class="form-group">
                    <label class="form-label">Section Title</label>
                    ${existingSections.length > 0 ? `
                        <select class="form-input" id="existingSectionSelect" style="margin-bottom: 0.5rem;">
                            <option value="">-- Select existing or create new --</option>
                            ${existingSections.map(s => `<option value="${s.title}">${s.title}</option>`).join('')}
                        </select>
                    ` : ''}
                    <input type="text" class="form-input" name="sectionTitle" id="sectionTitleInput" placeholder="e.g., Introduction" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Lesson Title *</label>
                    <input type="text" class="form-input" name="title" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Lesson Type *</label>
                    <select class="form-input" name="type" id="lessonTypeSelect" required>
                        <option value="video">Video</option>
                        <option value="pdf">PDF Document</option>
                        <option value="ppt">PowerPoint (PPT/PPTX)</option>
                        <option value="doc">Word Document (DOC/DOCX)</option>
                        <option value="document">Other Document</option>
                        <option value="text">Article / Text</option>
                        <option value="quiz">Quiz</option>
                        <option value="assignment">Assignment</option>
                    </select>
                </div>
                <div class="form-group" id="fileUrlGroup">
                    <label class="form-label" id="fileUrlLabel">Video URL</label>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <input type="text" class="form-input" name="videoUrl" id="videoUrlInput" placeholder="Paste URL or upload a file" style="flex: 1;">
                        <button type="button" class="btn" id="uploadFileBtn" style="width: auto; white-space: nowrap;">Upload File</button>
                    </div>
                    <input type="file" id="lessonFileInput" style="display: none;">
                    <div id="uploadStatus" style="margin-top: 0.5rem; display: none;">
                        <small style="color: var(--primary);">Uploading...</small>
                    </div>
                    <small style="color: var(--text-muted);" id="fileHint">For Google Drive: Share link → Copy link</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Content/Description</label>
                    <textarea class="form-input" name="content" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Duration (minutes)</label>
                    <input type="number" class="form-input" name="duration" min="0" value="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Practice Files (Optional)</label>
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                        <button type="button" class="btn" id="addPracticeFileBtn" style="width: auto;">+ Add Practice File</button>
                    </div>
                    <input type="file" id="practiceFileInput" style="display: none;" multiple>
                    <div id="practiceFilesList" style="margin-top: 0.5rem;"></div>
                    <small style="color: var(--text-muted);">Upload PDFs, documents, or other resources for students to practice</small>
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="checkbox" name="isFree"> Free Preview
                    </label>
                </div>
                <button type="submit" class="btn">Add Lesson</button>
            </form>
        </div>
    `;

    // Dynamic form updates based on type selection
    const typeSelect = document.getElementById('lessonTypeSelect');
    const fileUrlGroup = document.getElementById('fileUrlGroup');
    const fileUrlLabel = document.getElementById('fileUrlLabel');
    const fileHint = document.getElementById('fileHint');
    const fileInput = document.getElementById('lessonFileInput');
    const uploadBtn = document.getElementById('uploadFileBtn');

    // Handle existing section selection
    const existingSectionSelect = document.getElementById('existingSectionSelect');
    const sectionTitleInput = document.getElementById('sectionTitleInput');
    if (existingSectionSelect) {
        existingSectionSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                sectionTitleInput.value = e.target.value;
            }
        });
    }

    function updateFormForType() {
        const type = typeSelect.value;
        const isFileType = ['video', 'pdf', 'ppt', 'doc', 'document'].includes(type);
        fileUrlGroup.style.display = isFileType ? 'block' : 'none';

        if (type === 'video') {
            fileUrlLabel.textContent = 'Video URL';
            fileInput.accept = 'video/*';
            fileHint.textContent = 'For Google Drive: Share link → Copy link';
            uploadBtn.textContent = 'Upload Video';
        } else if (type === 'pdf') {
            fileUrlLabel.textContent = 'PDF File';
            fileInput.accept = '.pdf';
            fileHint.textContent = 'Upload a PDF file or paste a direct link';
            uploadBtn.textContent = 'Upload PDF';
        } else if (type === 'ppt') {
            fileUrlLabel.textContent = 'PowerPoint File';
            fileInput.accept = '.ppt,.pptx';
            fileHint.textContent = 'Upload a PPT/PPTX file or paste a direct link';
            uploadBtn.textContent = 'Upload PPT';
        } else if (type === 'doc') {
            fileUrlLabel.textContent = 'Word Document';
            fileInput.accept = '.doc,.docx';
            fileHint.textContent = 'Upload a DOC/DOCX file or paste a direct link';
            uploadBtn.textContent = 'Upload DOC';
        } else if (type === 'document') {
            fileUrlLabel.textContent = 'Document File';
            fileInput.accept = '.pdf,.ppt,.pptx,.doc,.docx';
            fileHint.textContent = 'Upload any document file or paste a direct link';
            uploadBtn.textContent = 'Upload File';
        }
    }

    typeSelect.addEventListener('change', updateFormForType);
    updateFormForType();

    // File upload handling
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadStatus = document.getElementById('uploadStatus');
        uploadStatus.style.display = 'block';
        uploadStatus.innerHTML = '<small style="color: var(--primary);">Uploading ' + file.name + '...</small>';
        uploadBtn.disabled = true;

        try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);

            const uploadRes = await fetchWithAuth(`${API_URL}/upload`, {
                method: 'POST',
                body: uploadFormData
            });
            const uploadData = await uploadRes.json();

            if (uploadData.success) {
                document.getElementById('videoUrlInput').value = uploadData.data.url;

                // Auto-detect and set type from backend response
                if (uploadData.data.fileType) {
                    const detectedType = uploadData.data.fileType;
                    if (['pdf', 'ppt', 'doc'].includes(detectedType)) {
                        typeSelect.value = detectedType;
                        updateFormForType();
                    }
                }

                // Auto-fill title if empty
                const titleInput = document.querySelector('input[name="title"]');
                if (!titleInput.value && uploadData.data.originalName) {
                    titleInput.value = uploadData.data.originalName.replace(/\.[^/.]+$/, '');
                }

                uploadStatus.innerHTML = '<small style="color: var(--secondary);">✓ Uploaded: ' + (uploadData.data.originalName || file.name) + '</small>';
            } else {
                uploadStatus.innerHTML = '<small style="color: var(--danger);">Upload failed: ' + (uploadData.message || 'Unknown error') + '</small>';
            }
        } catch (err) {
            uploadStatus.innerHTML = '<small style="color: var(--danger);">Upload failed</small>';
        }

        uploadBtn.disabled = false;
        fileInput.value = '';
    });

    // Practice files handling
    const practiceFiles = [];
    const practiceFileInput = document.getElementById('practiceFileInput');
    const addPracticeFileBtn = document.getElementById('addPracticeFileBtn');
    const practiceFilesList = document.getElementById('practiceFilesList');

    addPracticeFileBtn.addEventListener('click', () => {
        practiceFileInput.click();
    });

    practiceFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        addPracticeFileBtn.disabled = true;
        addPracticeFileBtn.textContent = 'Uploading...';

        for (const file of files) {
            try {
                const uploadFormData = new FormData();
                uploadFormData.append('file', file);

                const uploadRes = await fetchWithAuth(`${API_URL}/upload`, {
                    method: 'POST',
                    body: uploadFormData
                });
                const uploadData = await uploadRes.json();

                if (uploadData.success) {
                    practiceFiles.push({
                        name: uploadData.data.originalName || file.name,
                        url: uploadData.data.url,
                        type: uploadData.data.fileType || 'file'
                    });
                }
            } catch (err) {
                console.error('Upload failed:', err);
            }
        }

        updatePracticeFilesList();
        addPracticeFileBtn.disabled = false;
        addPracticeFileBtn.textContent = '+ Add Practice File';
        practiceFileInput.value = '';
    });

    function updatePracticeFilesList() {
        if (practiceFiles.length === 0) {
            practiceFilesList.innerHTML = '';
            return;
        }

        practiceFilesList.innerHTML = practiceFiles.map((file, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg-dark); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                <span style="display: flex; align-items: center; gap: 0.5rem;">
                    ${file.type === 'pdf' ? '📄' : file.type === 'ppt' ? '📊' : file.type === 'doc' ? '📝' : '📎'}
                    ${file.name}
                </span>
                <button type="button" class="btn btn-sm btn-danger" onclick="removePracticeFile(${index})">Remove</button>
            </div>
        `).join('');
    }

    window.removePracticeFile = (index) => {
        practiceFiles.splice(index, 1);
        updatePracticeFilesList();
    };

    document.getElementById('addLessonForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // First, create or get section
        const sectionTitle = formData.get('sectionTitle');
        let sectionId;

        try {
            const sectionRes = await fetchWithAuth(`${API_URL}/courses/${courseId}`);
            const courseData = await sectionRes.json();

            if (courseData.success) {
                const existingSection = courseData.data.sections?.find(s => s.title === sectionTitle);

                if (existingSection) {
                    sectionId = existingSection.id;
                } else {
                    // Create new section
                    const newSectionRes = await fetchWithAuth(`${API_URL}/courses/${courseId}/sections`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: sectionTitle, orderIndex: courseData.data.sections?.length || 0 })
                    });
                    const newSectionData = await newSectionRes.json();
                    if (newSectionData.success) {
                        sectionId = newSectionData.data.id;
                    }
                }
            }

            if (!sectionId) {
                alert('Failed to create section');
                return;
            }

            // Create lesson
            const lessonData = {
                sectionId,
                title: formData.get('title'),
                type: formData.get('type'),
                content: formData.get('content'),
                videoUrl: formData.get('videoUrl'),
                videoDuration: parseInt(formData.get('duration')) * 60,
                isFree: formData.get('isFree') === 'on',
                practiceFiles: practiceFiles
            };

            const lessonRes = await fetchWithAuth(`${API_URL}/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lessonData)
            });
            const lessonResData = await lessonRes.json();

            if (lessonResData.success) {
                alert('Lesson added!');
                loadCourseEditor(courseId);
            } else {
                alert(lessonResData.message || 'Failed to add lesson');
            }
        } catch (err) {
            alert('Failed to add lesson');
        }
    });
}

async function deleteLesson(lessonId, courseId) {
    if (!confirm('Delete this lesson?')) return;

    try {
        const res = await fetchWithAuth(`${API_URL}/lessons/${lessonId}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (data.success) {
            alert('Lesson deleted');
            loadCourseEditor(courseId);
        } else {
            alert(data.message || 'Failed to delete');
        }
    } catch (err) {
        alert('Failed to delete lesson');
    }
}

async function editLesson(lessonId, courseId) {
    try {
        const res = await fetchWithAuth(`${API_URL}/lessons/${lessonId}`);
        const data = await res.json();
        if (!data.success) {
            alert('Failed to load lesson');
            return;
        }
        const lesson = data.data;
        
        // Parse existing practice files
        let existingPracticeFiles = [];
        if (lesson.practiceFiles) {
            try {
                existingPracticeFiles = typeof lesson.practiceFiles === 'string' 
                    ? JSON.parse(lesson.practiceFiles) 
                    : (Array.isArray(lesson.practiceFiles) ? lesson.practiceFiles : []);
            } catch {
                existingPracticeFiles = [];
            }
        }
        
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="header">
                <h1>Edit Lesson</h1>
                <button class="btn" style="width: auto;" onclick="loadCourseEditor('${courseId}')">← Back</button>
            </div>
            <div class="stat-card" style="max-width: 800px;">
                <form id="editLessonForm">
                    <div class="form-group">
                        <label class="form-label">Lesson Title *</label>
                        <input type="text" class="form-input" name="title" value="${lesson.title}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lesson Type *</label>
                        <select class="form-input" name="type" id="editLessonTypeSelect" required>
                            <option value="video" ${lesson.type === 'video' ? 'selected' : ''}>Video</option>
                            <option value="pdf" ${lesson.type === 'pdf' ? 'selected' : ''}>PDF Document</option>
                            <option value="ppt" ${lesson.type === 'ppt' ? 'selected' : ''}>PowerPoint</option>
                            <option value="doc" ${lesson.type === 'doc' ? 'selected' : ''}>Word Document</option>
                            <option value="document" ${lesson.type === 'document' ? 'selected' : ''}>Other Document</option>
                            <option value="text" ${lesson.type === 'text' ? 'selected' : ''}>Article / Text</option>
                            <option value="quiz" ${lesson.type === 'quiz' ? 'selected' : ''}>Quiz</option>
                            <option value="assignment" ${lesson.type === 'assignment' ? 'selected' : ''}>Assignment</option>
                        </select>
                    </div>
                    <div class="form-group" id="editFileUrlGroup">
                        <label class="form-label" id="editFileUrlLabel">Video/File URL</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="text" class="form-input" name="videoUrl" id="editVideoUrlInput" value="${lesson.videoUrl || ''}" style="flex: 1;">
                            <button type="button" class="btn" id="editUploadFileBtn" style="width: auto;">Upload File</button>
                        </div>
                        <input type="file" id="editLessonFileInput" style="display: none;">
                        <div id="editUploadStatus" style="margin-top: 0.5rem; display: none;"></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Content/Description</label>
                        <textarea class="form-input" name="content" rows="4">${lesson.content || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Duration (minutes)</label>
                        <input type="number" class="form-input" name="duration" min="0" value="${Math.floor((lesson.videoDuration || 0) / 60)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Practice Files (Optional)</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                            <button type="button" class="btn" id="editAddPracticeFileBtn" style="width: auto;">+ Add Practice File</button>
                        </div>
                        <input type="file" id="editPracticeFileInput" style="display: none;" multiple>
                        <div id="editPracticeFilesList" style="margin-top: 0.5rem;"></div>
                    </div>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" name="isFree" ${lesson.isFree ? 'checked' : ''}> Free Preview
                        </label>
                    </div>
                    <button type="submit" class="btn">Update Lesson</button>
                </form>
            </div>
        `;
        
        // Practice files management
        const practiceFiles = [...existingPracticeFiles];
        const editPracticeFileInput = document.getElementById('editPracticeFileInput');
        const editAddPracticeFileBtn = document.getElementById('editAddPracticeFileBtn');
        const editPracticeFilesList = document.getElementById('editPracticeFilesList');
        
        function updateEditPracticeFilesList() {
            if (practiceFiles.length === 0) {
                editPracticeFilesList.innerHTML = '';
                return;
            }
            editPracticeFilesList.innerHTML = practiceFiles.map((file, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: var(--bg-dark); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                        ${file.type === 'pdf' ? '📄' : file.type === 'ppt' ? '📊' : file.type === 'doc' ? '📝' : '📎'}
                        ${file.name}
                    </span>
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeEditPracticeFile(${index})">Remove</button>
                </div>
            `).join('');
        }
        
        window.removeEditPracticeFile = (index) => {
            practiceFiles.splice(index, 1);
            updateEditPracticeFilesList();
        };
        
        editAddPracticeFileBtn.addEventListener('click', () => {
            editPracticeFileInput.click();
        });
        
        editPracticeFileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            editAddPracticeFileBtn.disabled = true;
            editAddPracticeFileBtn.textContent = 'Uploading...';
            
            for (const file of files) {
                try {
                    const uploadFormData = new FormData();
                    uploadFormData.append('file', file);
                    
                    const uploadRes = await fetchWithAuth(`${API_URL}/upload`, {
                        method: 'POST',
                        body: uploadFormData
                    });
                    const uploadData = await uploadRes.json();
                    
                    if (uploadData.success) {
                        practiceFiles.push({
                            name: uploadData.data.originalName || file.name,
                            url: uploadData.data.url,
                            type: uploadData.data.fileType || 'file'
                        });
                    }
                } catch (err) {
                    console.error('Upload failed:', err);
                }
            }
            
            updateEditPracticeFilesList();
            editAddPracticeFileBtn.disabled = false;
            editAddPracticeFileBtn.textContent = '+ Add Practice File';
            editPracticeFileInput.value = '';
        });
        
        updateEditPracticeFilesList();
        
        // File upload for main lesson
        const editFileInput = document.getElementById('editLessonFileInput');
        const editUploadBtn = document.getElementById('editUploadFileBtn');
        
        editUploadBtn.addEventListener('click', () => {
            editFileInput.click();
        });
        
        editFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const editUploadStatus = document.getElementById('editUploadStatus');
            editUploadStatus.style.display = 'block';
            editUploadStatus.innerHTML = '<small style="color: var(--primary);">Uploading...</small>';
            editUploadBtn.disabled = true;
            
            try {
                const uploadFormData = new FormData();
                uploadFormData.append('file', file);
                
                const uploadRes = await fetchWithAuth(`${API_URL}/upload`, {
                    method: 'POST',
                    body: uploadFormData
                });
                const uploadData = await uploadRes.json();
                
                if (uploadData.success) {
                    document.getElementById('editVideoUrlInput').value = uploadData.data.url;
                    editUploadStatus.innerHTML = '<small style="color: var(--secondary);">✓ Uploaded</small>';
                } else {
                    editUploadStatus.innerHTML = '<small style="color: var(--danger);">Upload failed</small>';
                }
            } catch (err) {
                editUploadStatus.innerHTML = '<small style="color: var(--danger);">Upload failed</small>';
            }
            
            editUploadBtn.disabled = false;
            editFileInput.value = '';
        });
        
        document.getElementById('editLessonForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const updateData = {
                title: formData.get('title'),
                type: formData.get('type'),
                content: formData.get('content'),
                videoUrl: formData.get('videoUrl'),
                videoDuration: parseInt(formData.get('duration')) * 60,
                isFree: formData.get('isFree') === 'on',
                practiceFiles: practiceFiles
            };
            
            try {
                const res = await fetchWithAuth(`${API_URL}/lessons/${lessonId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });
                const data = await res.json();
                
                if (data.success) {
                    alert('Lesson updated!');
                    loadCourseEditor(courseId);
                } else {
                    alert(data.message || 'Failed to update');
                }
            } catch (err) {
                alert('Failed to update lesson');
            }
        });
    } catch (err) {
        alert('Failed to load lesson');
    }
}

async function deleteCourse(courseId) {
    if (!confirm('Are you sure you want to delete this course? This cannot be undone.')) return;

    try {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (data.success) {
            alert('Course deleted successfully');
            if (currentUser.role === 'admin') {
                loadCourses();
            } else {
                loadMyCourses();
            }
        } else {
            alert(data.message || 'Failed to delete course');
        }
    } catch (err) {
        alert('Failed to delete course');
    }
}

async function submitForReview(courseId) {
    if (!confirm('Submit this course for admin review?')) return;

    try {
        const res = await fetchWithAuth(`${API_URL}/courses/${courseId}/submit-review`, {
            method: 'PUT'
        });
        const data = await res.json();

        if (data.success) {
            alert('Course submitted for review!');
            loadMyCourses();
        } else {
            alert(data.message || 'Failed to submit course');
        }
    } catch (err) {
        alert('Failed to submit course');
    }
}

// ============ PROFILE VIEW ============
async function loadProfile() {
    setActiveNav('profile');

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>My Profile</h1>
        </div>
        <div class="stat-card" style="max-width: 600px;">
            <form id="profileForm">
                <div class="form-group">
                    <label class="form-label">Profile Picture</label>
                    <input type="file" class="form-input" name="avatar" accept="image/*">
                    ${currentUser.avatarUrl ? `<img src="${currentUser.avatarUrl}" style="width: 100px; height: 100px; border-radius: 50%; margin-top: 0.5rem; object-fit: cover;">` : ''}
                </div>
                <div class="form-group">
                    <label class="form-label">First Name</label>
                    <input type="text" class="form-input" name="firstName" value="${currentUser.firstName}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Last Name</label>
                    <input type="text" class="form-input" name="lastName" value="${currentUser.lastName}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-input" value="${currentUser.email}" disabled>
                </div>
                <div class="form-group">
                    <label class="form-label">Bio</label>
                    <textarea class="form-input" name="bio" rows="4">${currentUser.bio || ''}</textarea>
                </div>
                <button type="submit" class="btn">Update Profile</button>
            </form>
        </div>
    `;

    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Upload avatar if provided
        let avatarUrl = currentUser.avatarUrl;
        const avatarFile = formData.get('avatar');
        if (avatarFile && avatarFile.size > 0) {
            const uploadFormData = new FormData();
            uploadFormData.append('file', avatarFile);

            try {
                const uploadRes = await fetchWithAuth(`${API_URL}/upload`, {
                    method: 'POST',
                    body: uploadFormData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success) {
                    avatarUrl = uploadData.data.url;
                }
            } catch (err) {
                console.error('Upload failed:', err);
            }
        }

        const profileData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            bio: formData.get('bio'),
            avatarUrl: avatarUrl
        };

        try {
            const res = await fetchWithAuth(`${API_URL}/users/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });
            const data = await res.json();

            if (data.success) {
                alert('Profile updated!');
                fetchCurrentUser();
            } else {
                alert(data.message || 'Failed to update profile');
            }
        } catch (err) {
            alert('Failed to update profile');
        }
    });
}

// ============ ENROLLMENT CODES VIEW (ADMIN) ============
async function loadEnrollmentCodes() {
    setActiveNav('enrollment-codes');

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>Enrollment Codes</h1>
            <button class="btn" style="width: auto;" onclick="logout()">Logout</button>
        </div>

        <!-- Generate Codes Form -->
        <div class="stat-card" style="margin-bottom: 1.5rem;">
            <h3 style="margin-bottom: 1rem;">Generate New Codes</h3>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;">
                <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom: 0;">
                    <label class="form-label">Course</label>
                    <select class="form-input" id="codeCourseSel">
                        <option value="">Loading courses...</option>
                    </select>
                </div>
                <div class="form-group" style="width: 120px; margin-bottom: 0;">
                    <label class="form-label">Count</label>
                    <input type="number" class="form-input" id="codeCount" value="5" min="1" max="100">
                </div>
                <div class="form-group" style="width: 200px; margin-bottom: 0;">
                    <label class="form-label">Expires At (optional)</label>
                    <input type="date" class="form-input" id="codeExpiry">
                </div>
                <button class="btn" style="width: auto; height: 42px;" onclick="generateCodes()">Generate</button>
            </div>
        </div>

        <!-- Filter -->
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
            <select class="form-input" id="codeFilterCourse" style="width: 200px;" onchange="filterEnrollmentCodes()">
                <option value="">All Courses</option>
            </select>
            <select class="form-input" id="codeFilterStatus" style="width: 150px;" onchange="filterEnrollmentCodes()">
                <option value="">All Status</option>
                <option value="unused">Unused</option>
                <option value="used">Used</option>
            </select>
        </div>

        <!-- Codes Table -->
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Course</th>
                        <th>Status</th>
                        <th>Used By</th>
                        <th>Used At</th>
                        <th>Expires</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="codesTable">
                    <tr><td colspan="7" style="text-align: center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    // Load courses for the selects
    try {
        const coursesRes = await fetchWithAuth(`${API_URL}/admin/courses`);
        const coursesData = await coursesRes.json();
        if (coursesData.success) {
            const select = document.getElementById('codeCourseSel');
            const filterSelect = document.getElementById('codeFilterCourse');
            select.innerHTML = '<option value="">Select a course</option>';
            filterSelect.innerHTML = '<option value="">All Courses</option>';
            coursesData.data.courses.forEach(c => {
                select.innerHTML += `<option value="${c.id}">${c.title}</option>`;
                filterSelect.innerHTML += `<option value="${c.id}">${c.title}</option>`;
            });
        }
    } catch (err) {
        console.error('Failed to load courses for code generation', err);
    }

    // Load existing codes
    await fetchEnrollmentCodes();
}

async function fetchEnrollmentCodes(courseId, isUsed) {
    let url = `${API_URL}/admin/enrollment-codes?limit=100`;
    if (courseId) url += `&courseId=${courseId}`;
    if (isUsed !== undefined && isUsed !== '') url += `&isUsed=${isUsed === 'used'}`;

    try {
        const res = await fetchWithAuth(url);
        const data = await res.json();

        const tbody = document.getElementById('codesTable');
        if (data.success && data.data.codes && data.data.codes.length > 0) {
            tbody.innerHTML = data.data.codes.map(code => `
                <tr>
                    <td style="font-family: monospace; font-weight: 600; letter-spacing: 1px;">${code.code}</td>
                    <td>${code.courseTitle || 'N/A'}</td>
                    <td>
                        <span class="status-badge status-${code.isUsed ? 'warning' : 'success'}">
                            ${code.isUsed ? 'Used' : 'Available'}
                        </span>
                    </td>
                    <td>${code.usedBy ? code.usedBy.name : '-'}</td>
                    <td>${code.usedAt ? new Date(code.usedAt).toLocaleDateString() : '-'}</td>
                    <td>${code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'Never'}</td>
                    <td>
                        <div style="display: flex; gap: 0.25rem;">
                            <button class="btn btn-sm" onclick="copyCode('${code.code}')" title="Copy">Copy</button>
                            ${!code.isUsed ? `<button class="btn btn-sm btn-danger" onclick="deleteCode('${code.id}')">Delete</button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No enrollment codes found</td></tr>';
        }
    } catch (err) {
        console.error('Failed to load enrollment codes', err);
        document.getElementById('codesTable').innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Failed to load enrollment codes</td></tr>';
    }
}

function filterEnrollmentCodes() {
    const courseId = document.getElementById('codeFilterCourse').value;
    const status = document.getElementById('codeFilterStatus').value;
    fetchEnrollmentCodes(courseId, status);
}

async function generateCodes() {
    const courseId = document.getElementById('codeCourseSel').value;
    const count = parseInt(document.getElementById('codeCount').value) || 5;
    const expiresAt = document.getElementById('codeExpiry').value || null;

    if (!courseId) {
        alert('Please select a course');
        return;
    }

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/enrollment-codes/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, count, expiresAt })
        });
        const data = await res.json();

        if (data.success) {
            alert(`${data.data.codes.length} enrollment code(s) generated successfully!`);
            fetchEnrollmentCodes();
        } else {
            alert(data.message || 'Failed to generate codes');
        }
    } catch (err) {
        alert('Failed to generate codes');
    }
}

function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        alert('Code copied to clipboard: ' + code);
    }).catch(() => {
        prompt('Copy this code:', code);
    });
}

async function deleteCode(codeId) {
    if (!confirm('Delete this enrollment code?')) return;

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/enrollment-codes/${codeId}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (data.success) {
            alert('Code deleted');
            fetchEnrollmentCodes();
        } else {
            alert(data.message || 'Failed to delete code');
        }
    } catch (err) {
        alert('Failed to delete code');
    }
}

// ============ STUDENTS VIEW (ADMIN) ============
async function loadStudentEnrollments() {
    setActiveNav('students');

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>Students & Enrollments</h1>
            <button class="btn" style="width: auto;" onclick="logout()">Logout</button>
        </div>
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Course</th>
                        <th>Enrollment Code</th>
                        <th>Progress</th>
                        <th>Enrolled</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="studentsTable">
                    <tr><td colspan="7" style="text-align: center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const res = await fetchWithAuth(`${API_URL}/admin/users/enrollments`);
        const data = await res.json();

        const tbody = document.getElementById('studentsTable');
        if (data.success && data.data.users && data.data.users.length > 0) {
            // Flatten: each user may have multiple enrollments, show one row per enrollment
            const rows = [];
            data.data.users.forEach(u => {
                if (u.enrollments && u.enrollments.length > 0) {
                    u.enrollments.forEach(e => {
                        // Find matching enrollment code for this course
                        const matchingCode = (u.enrollmentCodes || []).find(c => c.courseId === e.courseId);
                        rows.push({
                            name: `${u.firstName} ${u.lastName}`,
                            email: u.email,
                            courseTitle: e.courseTitle,
                            enrollmentCode: matchingCode ? matchingCode.code : '-',
                            progressPercent: e.progressPercentage || 0,
                            enrolledAt: e.enrolledAt,
                            enrollmentStatus: e.status
                        });
                    });
                } else {
                    rows.push({
                        name: `${u.firstName} ${u.lastName}`,
                        email: u.email,
                        courseTitle: 'No enrollments',
                        enrollmentCode: '-',
                        progressPercent: 0,
                        enrolledAt: null,
                        enrollmentStatus: 'none'
                    });
                }
            });

            if (rows.length > 0) {
                tbody.innerHTML = rows.map(u => `
                    <tr>
                        <td>${u.name}</td>
                        <td>${u.email}</td>
                        <td>${u.courseTitle}</td>
                        <td style="font-family: monospace;">${u.enrollmentCode}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <div style="flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
                                    <div style="width: ${u.progressPercent}%; height: 100%; background: var(--secondary); border-radius: 3px;"></div>
                                </div>
                                <span style="font-size: 0.75rem; min-width: 36px;">${u.progressPercent}%</span>
                            </div>
                        </td>
                        <td>${u.enrolledAt ? new Date(u.enrolledAt).toLocaleDateString() : '-'}</td>
                        <td><span class="status-badge status-${u.enrollmentStatus === 'active' || u.enrollmentStatus === 'completed' ? 'success' : 'warning'}">${u.enrollmentStatus}</span></td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No student enrollments found</td></tr>';
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No student enrollments found</td></tr>';
        }
    } catch (err) {
        console.error('Failed to load student enrollments', err);
        document.getElementById('studentsTable').innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Failed to load student enrollments</td></tr>';
    }
}
