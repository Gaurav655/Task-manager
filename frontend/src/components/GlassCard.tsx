import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  interactive = false,
  onClick,
  style,
}) => {
  const cardClassName = `glass-card ${interactive ? 'glass-card-interactive' : ''} ${className}`;

  return (
    <div className={cardClassName} onClick={onClick} style={style}>
      {children}
    </div>
  );
};

export default GlassCard;
