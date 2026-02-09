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
                    <div class="stat-label">Total Students</div>
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
                <h3 style="margin-bottom: 1rem;">User Growth</h3>
                <canvas id="userChart"></canvas>
            </div>
        </div>

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
    `;

    loadCharts();
    loadRecentTransactions();
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
                        <td><span class="status-badge status-${course.status === 'published' ? 'success' : course.status === 'pending_review' ? 'warning' : 'danger'}">${course.status}</span></td>
                        <td>$${(course.price || 0).toFixed(2)}</td>
                        <td>${course.enrollmentCount || 0}</td>
                        <td>
                            ${course.status === 'pending_review' ? `
                                <button class="btn" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right: 0.25rem;" onclick="approveCourse('${course.id}')">Approve</button>
                                <button class="btn" style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--danger);" onclick="rejectCourse('${course.id}')">Reject</button>
                            ` : '-'}
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
