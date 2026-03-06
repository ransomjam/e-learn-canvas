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
        <div className={cn("relative flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl p-1 shadow-sm", sizeClasses[size], className)}>
            <img
                src="/New Logo.png"
                alt="Logo"
                className="h-full w-full object-contain drop-shadow-sm scale-[1.2]"
            />
        </div>
    );
};

export default Logo;
