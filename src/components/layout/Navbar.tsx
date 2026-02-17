import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, X, User, LogOut, GraduationCap, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/common/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { resolveMediaUrl } from '@/lib/media';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const navLinks = [
    { path: '/courses', label: 'Courses' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/courses?search=${encodeURIComponent(searchValue.trim())}`);
      setSearchValue('');
      setIsSearchOpen(false);
      setIsMenuOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Logo size="sm" className="h-8 w-8" />
            <span className="font-display text-xl font-bold text-foreground">
              Crad<span className="text-primary">ema</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-8 md:flex">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-40 bg-secondary pl-10 transition-all duration-300 focus:w-44 sm:w-56 sm:focus:w-64 lg:w-64 lg:focus:w-72"
              />
            </form>

            {/* Nav Links */}
            <div className="flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium transition-colors hover:text-primary ${isActive(link.path) ? 'text-primary' : 'text-muted-foreground'
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Auth Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={resolveMediaUrl(user.avatarUrl)} alt={user.firstName} />
                      <AvatarFallback>{user.firstName[0]}{user.lastName[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/my-courses">My Courses</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  {(user.role === 'instructor' || user.role === 'admin') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/instructor">
                          <GraduationCap className="mr-2 h-4 w-4" />
                          Instructor Dashboard
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">
                    Log In
                  </Button>
                </Link>
                <Link to="/auth?mode=signup">
                  <Button size="sm" className="btn-primary">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              <Search className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        {isSearchOpen && (
          <div className="border-t border-border py-3 md:hidden">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full bg-secondary pl-10"
                autoFocus
              />
            </form>
          </div>
        )}

      </div>

      {/* Mobile Menu - rendered outside the container for proper stacking */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 top-16 bg-black/40 backdrop-blur-sm md:hidden"
            style={{ zIndex: 9998 }}
            onClick={() => setIsMenuOpen(false)}
          />
          {/* Menu Panel */}
          <div 
            className="fixed top-16 right-0 bottom-0 w-72 max-w-[85vw] bg-background border-l border-border shadow-2xl md:hidden animate-in slide-in-from-right duration-200"
            style={{ zIndex: 9999 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full overflow-y-auto">
              {/* User Info Section */}
              {isAuthenticated && user ? (
                <div className="px-4 py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={resolveMediaUrl(user.avatarUrl)} alt={user.firstName} />
                      <AvatarFallback>{user.firstName[0]}{user.lastName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Navigation Links */}
              <div className="px-2 py-3 border-b border-border">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive(link.path) 
                        ? 'text-primary bg-primary/10' 
                        : 'text-foreground hover:bg-accent/50'
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Menu Items */}
              <div className="px-2 py-3 flex-1">
                {isAuthenticated && user ? (
                  <div className="space-y-1">
                    <Link 
                      to="/my-courses" 
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                    >
                      <BookOpen className="h-4 w-4" />
                      My Courses
                    </Link>
                    <Link 
                      to="/profile" 
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    {(user.role === 'instructor' || user.role === 'admin') && (
                      <Link 
                        to="/instructor" 
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                      >
                        <GraduationCap className="h-4 w-4" />
                        Instructor Dashboard
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 px-2">
                    <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-center">
                        Log In
                      </Button>
                    </Link>
                    <Link to="/auth?mode=signup" onClick={() => setIsMenuOpen(false)}>
                      <Button className="btn-primary w-full justify-center">
                        Sign Up
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Logout Button at Bottom */}
              {isAuthenticated && user && (
                <div className="px-2 py-3 border-t border-border mt-auto">
                  <button
                    onClick={() => { logout(); setIsMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navbar;
