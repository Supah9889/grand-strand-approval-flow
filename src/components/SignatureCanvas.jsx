import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

export default function SignatureCanvas({ onSignatureChange }) {
  const canvasRef = useRef(null);
  // Use a ref for isDrawing so stopDrawing can read the current value
  // even if it fires after a fast remount (stale closure would read wrong state).
  const isDrawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  // ── Initialise canvas dimensions on mount ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return; // guard: canvas not yet mounted

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    // getBoundingClientRect can return 0 before first paint — fall back to a
    // sensible minimum so the canvas still works if the layout hasn't settled.
    canvas.width  = (rect.width  || 300) * 2;
    canvas.height = (rect.height || 192) * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }, []);

  // ── Helper: resolve canvas position from mouse or touch event ─────────────
  const getPosition = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect   = canvas.getBoundingClientRect();
    const src    = e.touches ? e.touches[0] : e;
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top,
    };
  }, []);

  // ── Drawing handlers ──────────────────────────────────────────────────────
  const startDrawing = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPosition(e);
    if (!pos) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
  }, [getPosition]);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPosition(e);
    if (!pos) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  }, [getPosition]);

  const stopDrawing = useCallback((e) => {
    if (e) e.preventDefault();
    if (!isDrawingRef.current) return; // never actually started — no-op
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return; // unmounted between start and end — fail safely
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Only export if something was actually drawn in this session
    setHasSignature(prev => {
      if (prev) {
        onSignatureChange(canvas.toDataURL('image/png'));
      }
      return prev;
    });
  }, [onSignatureChange]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isDrawingRef.current = false;
    setHasSignature(false);
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-48 touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-sm">Sign here</p>
          </div>
        )}
      </div>
      {hasSignature && (
        <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
          <Eraser className="w-4 h-4 mr-1.5" />
          Clear signature
        </Button>
      )}
    </div>
  );
}