import { useEffect, useState } from 'react';

interface SplashScreenProps {
  isLoading: boolean;
}

export default function SplashScreen({ isLoading }: SplashScreenProps) {
  const [show, setShow] = useState(true);
  
  useEffect(() => {
    if (!isLoading) {
      // Small delay to allow the fade out animation to play
      const timer = setTimeout(() => setShow(false), 500); 
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-wa-bg transition-opacity duration-500 ${
        isLoading ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex flex-col items-center">
        {/* Subtle pulsing logo container */}
        <div className="w-10 h-10 mb-6 rounded-full bg-wa-header/10 p-1.5 animate-pulse">
          {/* Inline SVG guarantees perfect crispness at any display size, bypassing any browser image-scaling artifacts */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-full h-full drop-shadow-sm">
            <rect width="512" height="512" rx="112" fill="#075E54" />
            <text x="256" y="295" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontSize="200" fontWeight="bold" fill="#ffffff" textAnchor="middle" dominantBaseline="middle">UNB</text>
          </svg>
        </div>
        
        {/* WhatsApp-style minimal spinner / loading indicator */}
        <div className="flex items-center gap-1.5 mt-8">
          <div className="w-2 h-2 rounded-full bg-wa-header/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-wa-header/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-wa-header/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
