import { useState, useEffect } from 'react';
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
  const [searchValue, setSearchValue] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const navLinks = [
    { path: '/courses', label: 'Courses' },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Sync search value with URL so it doesn't clear unexpectedly
  useEffect(() => {
    if (location.pathname === '/courses') {
      const params = new URLSearchParams(location.search);
      setSearchValue(params.get('search') || '');
    } else {
      setSearchValue('');
    }
  }, [location.pathname, location.search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchValue.trim();
    if (query) {
      navigate(`/courses?search=${encodeURIComponent(query)}`);
    } else {
      navigate('/courses');
    }
    setIsMenuOpen(false);
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
            <form onSubmit={handleSearch} className="relative group flex items-center">
              <button
                type="submit"
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <Input
                placeholder="Search courses..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-40 bg-secondary pl-10 transition-all duration-300 focus:w-44 sm:w-56 sm:focus:w-64 lg:w-64 lg:focus:w-72 relative z-0"
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
                <DropdownMenuContent align="end" className="w-64 p-2 shadow-xl border-border/50">
                  <div className="flex items-center gap-3 px-2 py-3 bg-secondary/40 rounded-lg mb-2">
                    <Avatar className="h-10 w-10 border border-primary/10 shadow-sm">
                      <AvatarImage src={resolveMediaUrl(user.avatarUrl)} alt={user.firstName} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight text-foreground">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuItem asChild className="cursor-pointer py-2.5 rounded-md group">
                    <Link to="/my-courses" className="flex items-center w-full">
                      <BookOpen className="mr-3 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-medium text-sm">My Courses</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer py-2.5 rounded-md group">
                    <Link to="/profile" className="flex items-center w-full">
                      <User className="mr-3 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-medium text-sm">Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  {(user.role === 'instructor' || user.role === 'admin') && (
                    <DropdownMenuItem asChild className="cursor-pointer py-2.5 rounded-md group">
                      <Link to="/instructor" className="flex items-center w-full">
                        <GraduationCap className="mr-3 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="font-medium text-sm">Instructor Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="my-1.5 opacity-50" />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer py-2.5 rounded-md text-red-500 focus:bg-red-500/10 focus:text-red-500 transition-colors group">
                    <LogOut className="mr-3 h-4 w-4 group-hover:text-red-600 transition-colors" />
                    <span className="font-medium text-sm">Log out</span>
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

          {/* Mobile Actions */}
          <div className="flex items-center gap-2 md:hidden">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={resolveMediaUrl(user.avatarUrl)} alt={user.firstName} />
                      <AvatarFallback className="text-xs">{user.firstName[0]}{user.lastName[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-2 shadow-xl border-border/50">
                  <div className="flex items-center gap-3 px-2 py-3 bg-secondary/40 rounded-lg mb-2">
                    <Avatar className="h-10 w-10 border border-primary/10 shadow-sm">
                      <AvatarImage src={resolveMediaUrl(user.avatarUrl)} alt={user.firstName} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight text-foreground">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuItem asChild className="cursor-pointer py-2.5 rounded-md group">
                    <Link to="/my-courses" className="flex items-center w-full">
                      <BookOpen className="mr-3 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-medium text-sm">My Courses</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer py-2.5 rounded-md group">
                    <Link to="/profile" className="flex items-center w-full">
                      <User className="mr-3 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-medium text-sm">Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  {(user.role === 'instructor' || user.role === 'admin') && (
                    <DropdownMenuItem asChild className="cursor-pointer py-2.5 rounded-md group">
                      <Link to="/instructor" className="flex items-center w-full">
                        <GraduationCap className="mr-3 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="font-medium text-sm">Instructor Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="my-1.5 opacity-50" />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer py-2.5 rounded-md text-red-500 focus:bg-red-500/10 focus:text-red-500 transition-colors group">
                    <LogOut className="mr-3 h-4 w-4 group-hover:text-red-600 transition-colors" />
                    <span className="font-medium text-sm">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </div>

      </div>

      {/* Mobile Menu - only for non-authenticated users */}
      {isMenuOpen && !isAuthenticated && (
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
              {/* Navigation Links */}
              <div className="px-2 py-3 border-b border-border">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive(link.path)
                      ? 'text-primary bg-primary/10'
                      : 'text-foreground hover:bg-accent/50'
                      }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Auth Buttons */}
              <div className="px-4 py-4 space-y-2">
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
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navbar;
