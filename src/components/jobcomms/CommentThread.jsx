import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Lock, Eye, Users, StickyNote, MessageSquare, Loader2, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';

const VIS_CONFIG = {
  internal: { label: 'Internal Only', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Lock },
  client:   { label: 'Client Visible', color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: Eye },
  vendor:   { label: 'Vendor Visible', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Users },
  both:     { label: 'Shared Both',   color: 'bg-green-50 text-green-700 border-green-200',  icon: Users },
};

function CommentBubble({ comment }) {
  const vis = VIS_CONFIG[comment.visibility] || VIS_CONFIG.internal;
  const VisIcon = vis.icon;
  const isNote = comment.comment_type === 'internal_note';

  return (
    <div className={`rounded-xl border p-3 space-y-1.5 ${vis.color}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isNote ? <StickyNote className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
          <span className="text-xs font-semibold">{comment.author_name || 'Unknown'}</span>
          {comment.author_role && <span className="text-xs opacity-60">({comment.author_role})</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs opacity-60">{isNote ? 'Internal Note' : 'Comment'}</span>
          <VisIcon className="w-3 h-3 opacity-60" />
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
      {comment.attached_file_url && (
        <a href={comment.attached_file_url} target="_blank" rel="noopener noreferrer"
          className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100">
          📎 {comment.attached_file_name || 'Attachment'}
        </a>
      )}
      <p className="text-xs opacity-50">
        {comment.created_date ? format(parseISO(comment.created_date), 'MMM d, yyyy · h:mm a') : ''}
      </p>
    </div>
  );
}

export default function CommentThread({ jobId, jobAddress, comments, queryKey }) {
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [body, setBody] = useState('');
  const [commentType, setCommentType] = useState('comment');
  const [visibility, setVisibility] = useState('internal');
  const [posting, setPosting] = useState(false);

  const post = async () => {
    if (!body.trim()) return;
    setPosting(true);
    await base44.entities.JobComment.create({
      job_id: jobId,
      job_address: jobAddress,
      body: body.trim(),
      comment_type: commentType,
      visibility,
      author_name: role || 'User',
      author_role: role || '',
    });
    setBody('');
    queryClient.invalidateQueries({ queryKey: [queryKey, jobId] });
    setPosting(false);
    toast.success(commentType === 'internal_note' ? 'Note added' : 'Comment posted');
  };

  const sorted = [...comments].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));

  return (
    <div className="space-y-4">
      {/* Thread */}
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
        ) : sorted.map(c => <CommentBubble key={c.id} comment={c} />)}
      </div>

      {/* Composer */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={commentType} onValueChange={setCommentType}>
            <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="comment">Comment</SelectItem>
              <SelectItem value="internal_note">Internal Note</SelectItem>
            </SelectContent>
          </Select>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal Only</SelectItem>
              <SelectItem value="client">Client Visible</SelectItem>
              <SelectItem value="vendor">Vendor Visible</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write a comment or internal note..." className="rounded-xl text-sm min-h-16 resize-none" />
        <Button className="w-full h-9 rounded-xl gap-2 text-sm" onClick={post} disabled={!body.trim() || posting}>
          {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {commentType === 'internal_note' ? 'Add Note' : 'Post Comment'}
        </Button>
      </div>
    </div>
  );
}