import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, User, LogOut, Menu, X, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveMediaUrl } from '@/lib/media';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const sidebarLinks = [
        { icon: LayoutDashboard, label: 'Overview', path: '/instructor' },
        { icon: BookOpen, label: 'My Courses', path: '/instructor/courses' },
        { icon: User, label: 'My Profile', path: '/profile' },
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const SidebarContent = () => (
        <div className="flex h-full flex-col bg-slate-900 text-slate-300">
            {/* Brand */}
            <div className="flex h-16 items-center border-b border-slate-800 px-6">
                <LayoutDashboard className="mr-2 h-6 w-6 text-indigo-500" />
                <span className="font-display text-xl font-bold text-white">E-Learn Admin</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-6">
                {sidebarLinks.map((link) => {
                    const isActive = location.pathname === link.path ||
                        (link.path !== '/instructor' && location.pathname.startsWith(link.path));
                    return (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                                    ? 'bg-indigo-600 text-white'
                                    : 'hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <link.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                            {link.label}
                        </Link>
                    )
                })}
            </nav>

            {/* User & Logout */}
            <div className="border-t border-slate-800 p-4">
                <div className="mb-4 flex items-center gap-3 px-2">
                    <Avatar className="h-9 w-9 border border-slate-700">
                        <AvatarImage src={resolveMediaUrl(user?.avatarUrl)} />
                        <AvatarFallback className="bg-slate-700 text-slate-300">
                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                        <p className="truncate text-sm font-medium text-white">
                            {user?.firstName} {user?.lastName}
                        </p>
                        <p className="truncate text-xs text-slate-500">Instructor</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start text-slate-400 hover:bg-slate-800 hover:text-white"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-3 h-5 w-5" />
                    Sign Out
                </Button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
            {/* Mobile Sidebar Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 shadow-xl transition-transform duration-300 lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <SidebarContent />
            </aside>

            {/* Main Content */}
            <div className="flex min-h-screen flex-col lg:pl-64">
                {/* Mobile Header */}
                <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-white px-4 shadow-sm dark:bg-zinc-900 lg:hidden">
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(true)}>
                        <Menu className="h-6 w-6" />
                    </Button>
                    <span className="font-display text-lg font-bold">E-Learn Admin</span>
                </header>

                <main className="flex-1 p-4 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
