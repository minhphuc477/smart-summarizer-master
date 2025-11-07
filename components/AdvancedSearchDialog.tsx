"use client";

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type SearchFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  sentiment?: 'any' | 'positive' | 'neutral' | 'negative';
  tags?: string[];
  restrictToFolder?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: SearchFilters;
  onChange: (filters: SearchFilters) => void;
};

export default function AdvancedSearchDialog({ open, onOpenChange, value, onChange }: Props) {
  const [local, setLocal] = useState<SearchFilters>(value);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (open) setLocal(value);
  }, [open, value]);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    const tags = Array.from(new Set([...(local.tags || []), t]));
    setLocal({ ...local, tags });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setLocal({ ...local, tags: (local.tags || []).filter((t) => t !== tag) });
  };

  const apply = () => {
    onChange(local);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Advanced Filters</DialogTitle>
          <DialogDescription>Refine your search with date, sentiment, and tags.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Date from</label>
              <Input type="date" value={local.dateFrom || ''} onChange={(e) => setLocal({ ...local, dateFrom: e.target.value || null })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date to</label>
              <Input type="date" value={local.dateTo || ''} onChange={(e) => setLocal({ ...local, dateTo: e.target.value || null })} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Sentiment</label>
            <Select value={local.sentiment || 'any'} onValueChange={(v) => setLocal({ ...local, sentiment: v as SearchFilters['sentiment'] })}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tags (any match)</label>
            <div className="flex gap-2">
              <Input placeholder="Type a tag and press Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
              <Button type="button" variant="outline" onClick={addTag}>Add</Button>
            </div>
            {(local.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {(local.tags || []).map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs bg-muted border">
                    {tag}
                    <button className="text-muted-foreground hover:text-foreground" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input id="restrict-folder" type="checkbox" checked={local.restrictToFolder ?? true} onChange={(e) => setLocal({ ...local, restrictToFolder: e.target.checked })} />
            <label htmlFor="restrict-folder" className="text-sm">Restrict to current folder (if any)</label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
