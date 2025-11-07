'use client';

/**
 * PersonaManager Component
 * 
 * Manages AI personas for summarization with:
 * - Preset personas (Professional, Student, Meeting, Brainstormer)
 * - Custom saved personas with CRUD operations
 * - Default persona selection
 * 
 * UX Note: Long persona names are truncated with ellipsis to prevent overflow.
 * Applied Tailwind classes: truncate, min-w-0, max-w-full, flex-shrink-0
 * To adjust truncation, modify the max-w-* classes on persona name spans.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Save, Trash2, Star, User, Info } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  is_default: boolean;
  created_at: string;
}

interface PersonaManagerProps {
  currentPersona?: string;
  onSelectPersona: (prompt: string) => void;
  userId?: string;
}

const PRESET_PERSONAS: Array<{ id: string; name: string; description: string; prompt: string }> = [
  {
    id: 'preset:professional',
    name: 'Professional Summary',
    description: 'Concise, structured, action-oriented summaries for work.',
    prompt:
      'You are a professional summarizer. Write concise, structured, actionable summaries with bullet points, decisions, and next steps. Be clear and neutral.',
  },
  {
    id: 'preset:student',
    name: 'Student Notes',
    description: 'Explain like a teacher and add key takeaways.',
    prompt:
      'You are a helpful teacher. Explain concepts simply with examples. Include key takeaways and 2-3 practice questions.',
  },
  {
    id: 'preset:meeting',
    name: 'Meeting Minutes',
    description: 'Agenda, decisions, action items with owners and due dates.',
    prompt:
      'You are a meeting assistant. Output sections: Agenda, Notes, Decisions, Action Items (Owner, Due, Task). Keep it crisp.',
  },
  {
    id: 'preset:brainstorm',
    name: 'Brainstormer',
    description: 'Generate ideas with pros/cons and next steps.',
    prompt:
      'You are a creative facilitator. Generate diverse ideas. For each idea, include pros/cons and 1 next step. Be pragmatic.',
  },
];

export function PersonaManager({
  currentPersona = '',
  onSelectPersona,
  userId,
}: PersonaManagerProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [personaSearchQuery, setPersonaSearchQuery] = useState('');

  // Form state for saving new persona
  const [newPersona, setNewPersona] = useState({
    name: '',
    prompt: currentPersona,
    description: '',
    is_default: false,
  });

  // Fetch personas on mount / user change
  const fetchPersonas = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch('/api/personas');
      const data = await response.json();
      if (response.ok) {
        setPersonas(data.personas || []);
      } else {
        throw new Error(data.error || 'Failed to fetch personas');
      }
    } catch (error) {
      console.error('Error fetching personas:', error);
      toast.error('Failed to load personas');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  // Update newPersona prompt when currentPersona changes
  useEffect(() => {
    setNewPersona((prev) => ({ ...prev, prompt: currentPersona }));
  }, [currentPersona]);

  // (moved fetchPersonas above with useCallback)

  const handleSavePersona = async () => {
    if (!newPersona.name.trim() || !newPersona.prompt.trim()) {
      toast.error('Name and prompt are required');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPersona),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Persona saved successfully');
        setIsSaveDialogOpen(false);
        setNewPersona({
          name: '',
          prompt: currentPersona,
          description: '',
          is_default: false,
        });
        await fetchPersonas();
      } else {
        throw new Error(data.error || 'Failed to save persona');
      }
    } catch (error) {
      console.error('Error saving persona:', error);
      toast.error('Failed to save persona');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePersona = async (id: string) => {
    if (!confirm('Are you sure you want to delete this persona?')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/personas/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Persona deleted successfully');
        await fetchPersonas();
        if (selectedPersonaId === id) {
          setSelectedPersonaId('');
        }
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete persona');
      }
    } catch (error) {
      console.error('Error deleting persona:', error);
      toast.error('Failed to delete persona');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/personas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });

      if (response.ok) {
        toast.success('Default persona updated');
        await fetchPersonas();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set default');
      }
    } catch (error) {
      console.error('Error setting default persona:', error);
      toast.error('Failed to set default persona');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPersona = (value: string) => {
    setSelectedPersonaId(value);
    if (value.startsWith('preset:')) {
      const preset = PRESET_PERSONAS.find((p) => p.id === value);
      if (preset) {
        onSelectPersona(preset.prompt);
        toast.success(`Using preset: ${preset.name}`);
      }
      return;
    }
    const persona = personas.find((p) => p.id === value);
    if (persona) {
      onSelectPersona(persona.prompt);
      toast.success(`Using persona: ${persona.name}`);
    }
  };

  // Filter personas based on search query (applies to both presets and saved)
  const query = personaSearchQuery.toLowerCase().trim();
  const filteredPresets = PRESET_PERSONAS.filter((p) =>
    !query || p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query) || p.prompt.toLowerCase().includes(query)
  );
  const filteredPersonas = personas.filter((persona) => {
    if (!query) return true;
    return (
      persona.name.toLowerCase().includes(query) ||
      (persona.description || '').toLowerCase().includes(query) ||
      persona.prompt.toLowerCase().includes(query)
    );
  });

  // Don't show for guest users
  if (!userId) {
    return null;
  }

  // derive a short label for the currently selected identity so the trigger shows
  // only the name (not the full prompt/content). This improves readability in the
  // selection box while keeping the full prompt available in the dropdown/tooltips.
  const selectedName = (() => {
    if (!selectedPersonaId) return undefined;
    if (selectedPersonaId.startsWith('preset:')) {
      const p = PRESET_PERSONAS.find((x) => x.id === selectedPersonaId);
      return p ? p.name : undefined;
    }
    const p = personas.find((x) => x.id === selectedPersonaId);
    return p ? p.name : undefined;
  })();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {/* Persona Selector */}
        <Select value={selectedPersonaId} onValueChange={handleSelectPersona}>
          <SelectTrigger className="w-full sm:w-[260px] max-w-full min-w-0 overflow-hidden">
              <User className="h-4 w-4 mr-2" />
              {/* Show only the selected persona name in the trigger to avoid
                  rendering long prompts in the compact select box. */}
              <SelectValue placeholder="Select Persona">{selectedName}</SelectValue>
            </SelectTrigger>
          <SelectContent>
            {/* Search Input */}
            <div className="p-2 border-b">
              <Input
                placeholder="Search personas..."
                value={personaSearchQuery}
                onChange={(e) => setPersonaSearchQuery(e.target.value)}
                className="h-8"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  // Allow Backspace, Delete, and other typing keys
                  // Only stop propagation for non-input keys that might trigger shortcuts
                  if (e.key === 'Escape' || (e.ctrlKey && e.key !== 'a' && e.key !== 'c' && e.key !== 'v' && e.key !== 'x')) {
                    e.stopPropagation();
                  }
                }}
              />
            </div>

            {/* Presets */}
            {filteredPresets.length > 0 && (
              <>
                <SelectItem value="__label_presets" disabled>
                  Presets
                </SelectItem>
                {filteredPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex flex-col gap-1 cursor-pointer min-w-0 max-w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{preset.name}</span>
                        <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {preset.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}

            {/* Saved Personas */}
            {filteredPersonas.length > 0 && (
              <>
                <SelectItem value="__label_saved" disabled>
                  Saved
                </SelectItem>
                {filteredPersonas.map((persona) => (
                  <SelectItem key={persona.id} value={persona.id}>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col gap-1 cursor-pointer min-w-0 max-w-full">
                            <div className="flex items-center gap-2 min-w-0">
                              {persona.is_default && (
                                <Star className="h-3 w-3 fill-current text-yellow-500 flex-shrink-0" />
                              )}
                              <span className="font-medium truncate">{persona.name}</span>
                              <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            </div>
                            {persona.description && (
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {persona.description}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-md">
                          <div className="space-y-2">
                            <p className="font-semibold">{persona.name}</p>
                            {persona.description && (
                              <p className="text-xs text-muted-foreground">{persona.description}</p>
                            )}
                            <div className="pt-2 border-t">
                              <p className="text-xs font-medium mb-1">Prompt:</p>
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                {persona.prompt.length > 200
                                  ? `${persona.prompt.slice(0, 200)}...`
                                  : persona.prompt}
                              </p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </SelectItem>
                ))}
              </>
            )}

            {/* Empty State */}
            {filteredPresets.length === 0 && filteredPersonas.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                {personaSearchQuery ? 'No personas found' : 'No personas available'}
              </div>
            )}
          </SelectContent>
        </Select>

        {/* Save Current Persona Button */}
        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save Persona
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Save Current Persona</DialogTitle>
              <DialogDescription>
                Save the current persona prompt for quick reuse later
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Persona Name *
                </label>
                <Input
                  placeholder="e.g., Professional Summary, Student Notes"
                  value={newPersona.name}
                  onChange={(e) =>
                    setNewPersona({ ...newPersona, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Persona Prompt *
                </label>
                <Textarea
                  placeholder="The AI persona prompt..."
                  value={newPersona.prompt}
                  onChange={(e) =>
                    setNewPersona({ ...newPersona, prompt: e.target.value })
                  }
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Description (optional)
                </label>
                <Input
                  placeholder="Brief description of when to use this persona"
                  value={newPersona.description}
                  onChange={(e) =>
                    setNewPersona({ ...newPersona, description: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={newPersona.is_default}
                  onChange={(e) =>
                    setNewPersona({ ...newPersona, is_default: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <label htmlFor="is_default" className="text-sm">
                  Set as default persona
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsSaveDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleSavePersona} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Persona'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Personas Dialog */}
        {personas.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                Manage
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Manage Saved Personas</DialogTitle>
                <DialogDescription>
                  View, delete, or set default personas
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {personas.map((persona) => (
                  <div
                    key={persona.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="font-medium truncate">{persona.name}</h4>
                          {persona.is_default && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded flex-shrink-0">
                              Default
                            </span>
                          )}
                        </div>
                        {persona.description && (
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {persona.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 break-words">
                          {persona.prompt}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!persona.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(persona.id)}
                            disabled={isLoading}
                            title="Set as default"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePersona(persona.id)}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
