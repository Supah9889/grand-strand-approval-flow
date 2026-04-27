import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PhotoLightbox({ photos, index, onClose, onNav }) {
  if (index === null || index === undefined || !photos[index]) return null;

  return (
    <AnimatePresence>
      <motion.div key="lb-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
        onClick={onClose}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10">
          <X className="w-5 h-5" />
        </button>
        {photos.length > 1 && (
          <>
            <button onClick={e => { e.stopPropagation(); onNav(-1); }}
              className="absolute left-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={e => { e.stopPropagation(); onNav(1); }}
              className="absolute right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10">
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
        <motion.img key={index} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          src={photos[index]} alt="Photo" onClick={e => e.stopPropagation()}
          className="max-w-full max-h-full object-contain rounded-xl px-16" />
        <p className="absolute bottom-4 text-white/60 text-xs">{index + 1} / {photos.length}</p>
      </motion.div>
    </AnimatePresence>
  );
}