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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-wa-header transition-opacity duration-500 ${
        isLoading ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex flex-col items-center">
        {/* Subtle pulsing logo */}
        <div className="w-24 h-24 mb-6 rounded-full bg-white/10 p-4 animate-pulse">
          <img src="/unb-icon.svg" alt="Urdu Novel Bank" className="w-full h-full object-contain" />
        </div>
        
        {/* WhatsApp-style minimal spinner / loading indicator */}
        <div className="flex items-center gap-1.5 mt-8">
          <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        
        <h1 className="mt-8 text-white/90 text-lg font-medium tracking-wide">Urdu Novel Bank</h1>
      </div>
    </div>
  );
}
