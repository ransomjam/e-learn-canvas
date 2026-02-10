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
                    <div class="stat-value">$${(stats.revenue?.total || 0).toFixed(2)}</div>
                    <div class="stat-label" style="color: var(--secondary);">+$${(stats.revenue?.thisMonth || 0).toFixed(2)} this month</div>
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
                    <div class="stat-value">$${(stats.totalRevenue || 0).toFixed(2)}</div>
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
                    <td>$${(t.amount || 0).toFixed(2)}</td>
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
                        <td>$${(c.price * (c.enrollmentCount || 0)).toFixed(2)}</td>
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
                        <td>$${(course.price || 0).toFixed(2)}</td>
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
                        <td>$${(t.amount || 0).toFixed(2)}</td>
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
                        <td>$${(course.price || 0).toFixed(2)}</td>
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
            </form>
        </div>
    `;

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
                                            <span>${lesson.title} (${lesson.type})</span>
                                            <button class="btn btn-sm btn-danger" onclick="deleteLesson('${lesson.id}', '${courseId}')">Delete</button>
                                        </div>
                                    `).join('') : '<p style="color: var(--text-muted);">No lessons</p>'
                    }
                            </div>
                        `).join('') : '<p style="color: var(--text-muted);">No sections yet. Add a lesson to create a section.</p>'
            }
                </div>
            </div>
        `;

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

function showAddLesson(courseId) {
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="header">
            <h1>Add Lesson</h1>
            <button class="btn" style="width: auto;" onclick="loadCourseEditor('${courseId}')">← Back</button>
        </div>
        <div class="stat-card" style="max-width: 800px;">
            <form id="addLessonForm">
                <div class="form-group">
                    <label class="form-label">Section Title (or select existing)</label>
                    <input type="text" class="form-input" name="sectionTitle" placeholder="e.g., Introduction" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Lesson Title *</label>
                    <input type="text" class="form-input" name="title" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Lesson Type *</label>
                    <select class="form-input" name="type" required>
                        <option value="video">Video</option>
                        <option value="text">Text</option>
                        <option value="quiz">Quiz</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Video URL (if video type)</label>
                    <input type="url" class="form-input" name="videoUrl" placeholder="https://drive.google.com/file/d/FILE_ID/view">
                    <small style="color: var(--text-muted);">For Google Drive: Share link → Copy link</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Content/Description</label>
                    <textarea class="form-input" name="content" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Duration (minutes)</label>
                    <input type="number" class="form-input" name="duration" min="0" value="0">
                </div>
                <button type="submit" class="btn">Add Lesson</button>
            </form>
        </div>
    `;

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
                videoDuration: parseInt(formData.get('duration')) * 60
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
