"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, Plus, X } from 'lucide-react';

interface AISuggestion {
  relatedConcepts: string[];
  connections: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
  nextSteps: string[];
}

interface SuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: AISuggestion | null;
  onAddConcept: (concept: string) => void;
  onAddConnection: (connection: { from: string; to: string; reason: string }) => void;
}

export default function SuggestionsDialog({
  open,
  onOpenChange,
  suggestions,
  onAddConcept,
  onAddConnection,
}: SuggestionsDialogProps) {
  const [addedConcepts, setAddedConcepts] = useState<Set<string>>(new Set());
  const [addedConnections, setAddedConnections] = useState<Set<string>>(new Set());

  if (!suggestions) {
    return null;
  }

  const handleAddConcept = (concept: string) => {
    onAddConcept(concept);
    setAddedConcepts(prev => new Set(prev).add(concept));
  };

  const handleAddConnection = (connection: { from: string; to: string; reason: string }) => {
    onAddConnection(connection);
    const key = `${connection.from}-${connection.to}`;
    setAddedConnections(prev => new Set(prev).add(key));
  };

  const isConceptAdded = (concept: string) => addedConcepts.has(concept);
  const isConnectionAdded = (connection: { from: string; to: string }) => {
    return addedConnections.has(`${connection.from}-${connection.to}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            AI Canvas Suggestions
          </DialogTitle>
          <DialogDescription>
            AI has analyzed your canvas and found relevant concepts and connections
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Related Concepts */}
            {suggestions.relatedConcepts && suggestions.relatedConcepts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  Related Concepts
                  <Badge variant="secondary">{suggestions.relatedConcepts.length}</Badge>
                </h3>
                <div className="grid gap-2">
                  {suggestions.relatedConcepts.map((concept, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <span className="text-sm font-medium">{concept}</span>
                      <Button
                        size="sm"
                        variant={isConceptAdded(concept) ? 'outline' : 'default'}
                        onClick={() => handleAddConcept(concept)}
                        disabled={isConceptAdded(concept)}
                      >
                        {isConceptAdded(concept) ? (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            Add to Canvas
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Connections */}
            {suggestions.connections && suggestions.connections.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  Suggested Connections
                  <Badge variant="secondary">{suggestions.connections.length}</Badge>
                </h3>
                <div className="grid gap-3">
                  {suggestions.connections.map((connection, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Badge variant="outline">{connection.from}</Badge>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="outline">{connection.to}</Badge>
                        </div>
                        <Button
                          size="sm"
                          variant={isConnectionAdded(connection) ? 'outline' : 'default'}
                          onClick={() => handleAddConnection(connection)}
                          disabled={isConnectionAdded(connection)}
                        >
                          {isConnectionAdded(connection) ? (
                            <>
                              <X className="h-3 w-3 mr-1" />
                              Added
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Add Connection
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground italic">
                        {connection.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            {suggestions.nextSteps && suggestions.nextSteps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  Recommended Next Steps
                  <Badge variant="secondary">{suggestions.nextSteps.length}</Badge>
                </h3>
                <ul className="space-y-2">
                  {suggestions.nextSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="flex-1">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
