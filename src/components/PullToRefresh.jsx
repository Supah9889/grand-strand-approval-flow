import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children, isRefreshing = false }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshTriggered, setIsRefreshTriggered] = useState(false);
  const startYRef = useRef(0);
  const scrollContainerRef = useRef(null);

  const REFRESH_THRESHOLD = 80;

  const handleTouchStart = (e) => {
    const container = scrollContainerRef.current;
    if (container && container.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    const container = scrollContainerRef.current;
    if (!container || container.scrollTop !== 0) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startYRef.current;

    if (distance > 0) {
      setPullDistance(distance);
      if (distance > REFRESH_THRESHOLD && !isRefreshTriggered) {
        setIsRefreshTriggered(true);
      } else if (distance < REFRESH_THRESHOLD && isRefreshTriggered) {
        setIsRefreshTriggered(false);
      }
    }
  };

  const handleTouchEnd = () => {
    if (isRefreshTriggered && !isRefreshing) {
      onRefresh();
      setIsRefreshTriggered(false);
    }
    setPullDistance(0);
  };

  useEffect(() => {
    if (!isRefreshing) {
      setPullDistance(0);
      setIsRefreshTriggered(false);
    }
  }, [isRefreshing]);

  return (
    <div
      ref={scrollContainerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full overflow-y-auto"
    >
      {/* Pull-to-refresh indicator */}
      <div className="flex justify-center overflow-hidden">
        <motion.div
          animate={{
            height: Math.min(pullDistance, 60),
            opacity: pullDistance / REFRESH_THRESHOLD,
          }}
          className="w-full flex items-center justify-center bg-primary/10"
        >
          <motion.div
            animate={{
              rotate: isRefreshing ? 360 : (pullDistance / REFRESH_THRESHOLD) * 180,
            }}
            transition={{ duration: isRefreshing ? 1 : 0 }}
          >
            <RotateCcw className="w-5 h-5 text-primary" />
          </motion.div>
        </motion.div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}