import React from 'react';

export const CityView: React.FC = () => {
  return (
    <div className="h-full w-full bg-brand-cream p-4 md:p-8 font-sans flex flex-col items-center justify-center text-center pb-32">
      <h2 className="text-4xl font-black uppercase text-slate-400 mb-4 tracking-tight drop-shadow-[2px_2px_0px_#fff]">City Hub</h2>
      <p className="text-lg font-bold text-slate-500 max-w-sm">
        The City Hub is under construction! Soon you'll be able to explore city-wide challenges and events.
      </p>
    </div>
  );
};
