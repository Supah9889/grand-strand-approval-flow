import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, User, ChevronRight } from 'lucide-react';

export default function JobCard({ job, onSelect }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="font-medium text-foreground text-sm leading-snug">{job.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground text-sm">{job.customer_name}</p>
          </div>
          <p className="text-muted-foreground text-xs line-clamp-1 pl-6">{job.description}</p>
          <p className="text-primary font-semibold text-base pl-6">
            ${Number(job.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <Button 
          size="sm" 
          onClick={() => onSelect(job)}
          className="shrink-0 mt-1"
        >
          Select
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}