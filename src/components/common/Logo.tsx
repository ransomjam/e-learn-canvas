import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Logo = ({ className, size = 'md' }: LogoProps) => {
    const sizeClasses = {
        sm: 'h-6 w-6',
        md: 'h-8 w-8',
        lg: 'h-10 w-10',
        xl: 'h-16 w-16',
    };

    return (
        <div className={cn("relative flex items-center justify-center", sizeClasses[size], className)}>
            <svg
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-full w-full"
            >
                <defs>
                    <linearGradient id="cradema-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                </defs>
                {/* Rounded square background */}
                <rect x="4" y="4" width="112" height="112" rx="26" fill="url(#cradema-grad)" />
                {/* Stylised open-book "C" mark */}
                <path
                    d="M60 28 L34 44 L34 82 L60 94 L60 56 Z"
                    fill="white"
                    opacity="0.95"
                />
                <path
                    d="M60 28 L86 44 L86 82 L60 94 L60 56 Z"
                    fill="white"
                    opacity="0.75"
                />
                {/* Accent dot — knowledge spark */}
                <circle cx="60" cy="44" r="5" fill="#fbbf24" />
            </svg>
        </div>
    );
};

export default Logo;
