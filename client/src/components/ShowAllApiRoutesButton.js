import React from 'react';

const btnStyle = {
  position: 'fixed',
  right: '16px',
  bottom: '16px',
  zIndex: 2147483647,
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #1f6feb',
  background: '#238636',
  color: 'white',
  fontSize: '14px',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
};

export default function ShowAllApiRoutesButton() {
  const handleClick = () => {
    window.open('http://localhost:3010/api/allroutes', '_blank', 'noopener,noreferrer');
  };
  return (
    <button style={btnStyle} onClick={handleClick} title="Open API routes">
      Show All API routes
    </button>
  );
}