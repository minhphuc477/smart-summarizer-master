"use client";

import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CheckSquare, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

export type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type ChecklistNodeData = {
  label?: string;
  title?: string;
  items?: ChecklistItem[];
  showCompleted?: boolean;
};

function ChecklistNode({ data, selected }: NodeProps<ChecklistNodeData>) {
  const [title, setTitle] = useState(data.title ?? 'Checklist');
  const [items, setItems] = useState<ChecklistItem[]>(data.items ?? []);
  const [newItemText, setNewItemText] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [showCompleted, setShowCompleted] = useState(data.showCompleted ?? true);

  // Sync with prop changes when template is loaded
  useEffect(() => {
    if (data.title !== undefined && data.title !== title) {
      setTitle(data.title);
    }
  }, [data.title, title]);

  useEffect(() => {
    if (data.items !== undefined && JSON.stringify(data.items) !== JSON.stringify(items)) {
      setItems(data.items);
    }
  }, [data.items, items]);

  const addItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: newItemText,
      completed: false,
    };
    
    const updated = [...items, newItem];
    setItems(updated);
    data.items = updated;
    setNewItemText('');
  };

  const toggleItem = (id: string) => {
    const updated = items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setItems(updated);
    data.items = updated;
  };

  const deleteItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    data.items = updated;
  };

  const updateTitle = (newTitle: string) => {
    setTitle(newTitle);
    data.title = newTitle;
  };

  const filteredItems = showCompleted 
    ? items 
    : items.filter(item => !item.completed);

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div
      className={cn(
        "bg-background border-2 rounded-lg min-w-[280px] max-w-[400px]",
        selected ? "border-primary shadow-lg" : "border-border"
      )}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Header */}
      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          {editingTitle ? (
            <Input
              value={title}
              onChange={(e) => updateTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditingTitle(false);
              }}
              className="h-7 text-sm font-medium"
              autoFocus
            />
          ) : (
            <h3
              className="text-sm font-medium flex-1 cursor-pointer hover:text-primary"
              onDoubleClick={() => setEditingTitle(true)}
            >
              {title}
            </h3>
          )}
        </div>
        
        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{completedCount} of {totalCount}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Checklist Items */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {filteredItems.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {items.length === 0 ? 'No items yet' : 'All items completed!'}
          </p>
        )}
        
        {filteredItems.map(item => (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-2 group p-2 rounded hover:bg-muted/50 transition-colors",
              item.completed && "opacity-60"
            )}
          >
            <Checkbox
              checked={item.completed}
              onCheckedChange={() => toggleItem(item.id)}
              className="mt-0.5"
            />
            <span
              className={cn(
                "flex-1 text-sm select-none",
                item.completed && "line-through"
              )}
            >
              {item.text}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
              onClick={() => deleteItem(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add New Item */}
      <div className="p-3 border-t bg-muted/30">
        <div className="flex gap-2">
          <Input
            placeholder="Add new item..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addItem();
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            onClick={addItem}
            disabled={!newItemText.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Toggle Completed */}
        {completedCount > 0 && (
          <button
            onClick={() => {
              setShowCompleted(!showCompleted);
              data.showCompleted = !showCompleted;
            }}
            className="text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
          >
            {showCompleted ? 'Hide' : 'Show'} completed ({completedCount})
          </button>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(ChecklistNode);
