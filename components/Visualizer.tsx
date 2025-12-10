import React, { useEffect, useRef } from 'react';

interface Props {
  level: number; // 0 to 1
  active: boolean;
}

export const Visualizer: React.FC<Props> = ({ level, active }) => {
  const bars = 5;
  
  return (
    <div className="flex items-center gap-1.5 h-12">
      {Array.from({ length: bars }).map((_, i) => (
        <Bar key={i} level={level} index={i} active={active} />
      ))}
    </div>
  );
};

const Bar: React.FC<{ level: number, index: number, active: boolean }> = ({ level, index, active }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    
    let height = 4;
    if (active) {
       // Randomize slightly based on level and index to create wave effect
       const noise = Math.random() * 0.5 + 0.5;
       height = 4 + (level * 40 * noise); 
    }
    
    ref.current.style.height = `${Math.min(height, 48)}px`;
    ref.current.style.opacity = active ? '1' : '0.3';
  }, [level, active, index]);

  return (
    <div 
      ref={ref}
      className="w-1.5 bg-gradient-to-t from-blue-400 to-indigo-400 rounded-full transition-all duration-75 ease-out shadow-[0_0_8px_rgba(96,165,250,0.5)]"
      style={{ height: '4px' }}
    />
  );
};
