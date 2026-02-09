export interface Course {
  id: string;
  title: string;
  instructor: string;
  instructorAvatar: string;
  thumbnail: string;
  rating: number;
  reviewCount: number;
  price: number;
  originalPrice?: number;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  lessonsCount: number;
  studentsCount: number;
  description: string;
  bestseller?: boolean;
  featured?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  isCompleted: boolean;
  isLocked: boolean;
  type: 'video' | 'quiz' | 'assignment';
}

export interface Section {
  id: string;
  title: string;
  lessons: Lesson[];
}

export const categories = [
  'All Categories',
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Machine Learning',
  'UI/UX Design',
  'Cloud Computing',
  'Cybersecurity',
  'DevOps',
];

export const courses: Course[] = [
  {
    id: '1',
    title: 'Complete React Developer Course with Hooks & Redux',
    instructor: 'Sarah Johnson',
    instructorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=450&fit=crop',
    rating: 4.8,
    reviewCount: 12453,
    price: 89.99,
    originalPrice: 199.99,
    category: 'Web Development',
    level: 'Intermediate',
    duration: '42 hours',
    lessonsCount: 285,
    studentsCount: 85420,
    description: 'Master React with hooks, context, Redux, and build real-world projects.',
    bestseller: true,
    featured: true,
  },
  {
    id: '2',
    title: 'Python for Data Science and Machine Learning Bootcamp',
    instructor: 'Michael Chen',
    instructorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&h=450&fit=crop',
    rating: 4.9,
    reviewCount: 23567,
    price: 94.99,
    originalPrice: 249.99,
    category: 'Data Science',
    level: 'Beginner',
    duration: '56 hours',
    lessonsCount: 342,
    studentsCount: 156780,
    description: 'Learn Python, NumPy, Pandas, Matplotlib, Seaborn, and Machine Learning.',
    bestseller: true,
    featured: true,
  },
  {
    id: '3',
    title: 'AWS Certified Solutions Architect - Complete Guide',
    instructor: 'David Williams',
    instructorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=450&fit=crop',
    rating: 4.7,
    reviewCount: 8934,
    price: 79.99,
    originalPrice: 179.99,
    category: 'Cloud Computing',
    level: 'Intermediate',
    duration: '38 hours',
    lessonsCount: 198,
    studentsCount: 45230,
    description: 'Prepare for AWS certification with hands-on labs and practice exams.',
    featured: true,
  },
  {
    id: '4',
    title: 'Flutter & Dart: Complete Mobile App Development',
    instructor: 'Emily Rodriguez',
    instructorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=450&fit=crop',
    rating: 4.8,
    reviewCount: 6721,
    price: 84.99,
    originalPrice: 189.99,
    category: 'Mobile Development',
    level: 'Beginner',
    duration: '45 hours',
    lessonsCount: 267,
    studentsCount: 38920,
    description: 'Build iOS and Android apps with a single codebase using Flutter.',
    bestseller: true,
  },
  {
    id: '5',
    title: 'UI/UX Design Masterclass: From Figma to Portfolio',
    instructor: 'Jessica Lee',
    instructorAvatar: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=100&h=100&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=450&fit=crop',
    rating: 4.9,
    reviewCount: 5432,
    price: 69.99,
    originalPrice: 149.99,
    category: 'UI/UX Design',
    level: 'Beginner',
    duration: '32 hours',
    lessonsCount: 156,
    studentsCount: 28450,
    description: 'Learn design thinking, Figma, and build a professional portfolio.',
  },
  {
    id: '6',
    title: 'Ethical Hacking: Complete Cybersecurity Bootcamp',
    instructor: 'Alex Thompson',
    instructorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=450&fit=crop',
    rating: 4.7,
    reviewCount: 9876,
    price: 99.99,
    originalPrice: 229.99,
    category: 'Cybersecurity',
    level: 'Advanced',
    duration: '52 hours',
    lessonsCount: 312,
    studentsCount: 62340,
    description: 'Master penetration testing, network security, and ethical hacking.',
  },
  {
    id: '7',
    title: 'Docker & Kubernetes: The Complete DevOps Guide',
    instructor: 'Robert Kim',
    instructorAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&h=450&fit=crop',
    rating: 4.8,
    reviewCount: 7654,
    price: 89.99,
    originalPrice: 199.99,
    category: 'DevOps',
    level: 'Intermediate',
    duration: '35 hours',
    lessonsCount: 189,
    studentsCount: 41560,
    description: 'Learn containerization, orchestration, and CI/CD pipelines.',
  },
  {
    id: '8',
    title: 'Deep Learning A-Z: Neural Networks with TensorFlow',
    instructor: 'Anna Martinez',
    instructorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=450&fit=crop',
    rating: 4.9,
    reviewCount: 11234,
    price: 94.99,
    originalPrice: 219.99,
    category: 'Machine Learning',
    level: 'Advanced',
    duration: '48 hours',
    lessonsCount: 276,
    studentsCount: 72890,
    description: 'Build neural networks, CNNs, RNNs, and GANs from scratch.',
    bestseller: true,
  },
];

export const courseSections: Section[] = [
  {
    id: 's1',
    title: 'Getting Started',
    lessons: [
      { id: 'l1', title: 'Welcome to the Course', duration: '5:30', isCompleted: true, isLocked: false, type: 'video' },
      { id: 'l2', title: 'Course Overview', duration: '12:45', isCompleted: true, isLocked: false, type: 'video' },
      { id: 'l3', title: 'Setting Up Your Environment', duration: '18:20', isCompleted: false, isLocked: false, type: 'video' },
      { id: 'l4', title: 'Section Quiz', duration: '10 mins', isCompleted: false, isLocked: false, type: 'quiz' },
    ],
  },
  {
    id: 's2',
    title: 'Core Fundamentals',
    lessons: [
      { id: 'l5', title: 'Understanding the Basics', duration: '22:15', isCompleted: false, isLocked: false, type: 'video' },
      { id: 'l6', title: 'Deep Dive into Components', duration: '35:40', isCompleted: false, isLocked: false, type: 'video' },
      { id: 'l7', title: 'State Management Explained', duration: '28:55', isCompleted: false, isLocked: false, type: 'video' },
      { id: 'l8', title: 'Hands-on Assignment', duration: '45 mins', isCompleted: false, isLocked: false, type: 'assignment' },
    ],
  },
  {
    id: 's3',
    title: 'Advanced Concepts',
    lessons: [
      { id: 'l9', title: 'Performance Optimization', duration: '32:10', isCompleted: false, isLocked: true, type: 'video' },
      { id: 'l10', title: 'Best Practices & Patterns', duration: '41:25', isCompleted: false, isLocked: true, type: 'video' },
      { id: 'l11', title: 'Real-world Project', duration: '2 hours', isCompleted: false, isLocked: true, type: 'assignment' },
    ],
  },
];

export const pricingPlans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 0,
    period: 'forever',
    description: 'Perfect for getting started',
    features: [
      'Access to free courses',
      'Basic community support',
      'Course completion certificates',
      'Mobile app access',
    ],
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    period: 'month',
    description: 'Best for serious learners',
    features: [
      'Unlimited course access',
      'Priority support',
      'Verified certificates',
      'Offline downloads',
      'Project-based learning',
      'Exclusive webinars',
    ],
    highlighted: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 99,
    period: 'month',
    description: 'For teams and organizations',
    features: [
      'Everything in Pro',
      'Team analytics dashboard',
      'Custom learning paths',
      'Admin controls',
      'SSO integration',
      'Dedicated success manager',
    ],
    highlighted: false,
  },
];

export const userProgress = {
  enrolledCourses: [
    { ...courses[0], progress: 65, lastAccessed: '2 hours ago' },
    { ...courses[1], progress: 32, lastAccessed: '1 day ago' },
    { ...courses[4], progress: 88, lastAccessed: '3 days ago' },
  ],
  completedCourses: 8,
  hoursLearned: 124,
  certificates: 5,
  currentStreak: 12,
};
