import React from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/69bcbfe615d3fa3305cf59d6/a4179d635_generated_image.png';

export default function CompanyLogo({ className = "h-20 w-auto" }) {
  return (
    <img 
      src={LOGO_URL} 
      alt="Grand Strand Custom Painting" 
      className={className}
    />
  );
}