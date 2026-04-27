import React from 'react';

export default function SafeAreaWrapper({ children }) {
  return (
    <div
      className="flex flex-col w-full h-screen"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {children}
    </div>
  );
}