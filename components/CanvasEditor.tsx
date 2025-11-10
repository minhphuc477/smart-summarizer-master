"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useKeyboardShortcuts, commonShortcuts } from '@/lib/useKeyboardShortcuts';
import { Input } from '@/components/ui/input';
import { Save, Plus, Download, FileJson, Share2, Image as ImageIcon, Sparkles, Network, Grid3x3, Circle, GitBranch, CheckSquare, Link as LinkIcon, Code2, Palette, Shapes, Route, Layers, PanelsTopLeft, Users, FolderInput, FileText, History } from 'lucide-react';
import { CanvasTemplateSelector } from '@/components/CanvasTemplateSelector';
import { CanvasTemplateSaveDialog } from '@/components/CanvasTemplateSaveDialog';
import { ImportNotesDialog } from '@/components/ImportNotesDialog';
import CanvasVersionHistory from '@/components/versions/CanvasVersionHistory';
import { useCollaborativeCanvas, useCursorBroadcast } from '@/lib/realtime/useCollaborativeCanvas';
import { LiveCursors } from '@/components/collaboration/LiveCursors';
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator';
import SuggestionsDialog from '@/components/SuggestionsDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyLayout, type LayoutType } from '@/lib/canvasLayouts';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

// Import custom node components
import ImageNode from '@/components/canvas-nodes/ImageNode';
import ChecklistNode from '@/components/canvas-nodes/ChecklistNode';
import LinkPreviewNode from '@/components/canvas-nodes/LinkPreviewNode';
import CodeNode from '@/components/canvas-nodes/CodeNode';
import StickyNoteNode from '@/components/canvas-nodes/StickyNoteNode';

type CanvasEditorProps = {
  canvasId?: string;
  workspaceId?: string | null;
  onSave?: () => void;
};

type DBNode = {
  node_id: string;
  type: string;
  position_x: number;
  position_y: number;
  content: string;
  color: string;
  background_color: string;
  width?: number;
  height?: number;
  border_color: string;
  metadata?: Record<string, unknown> | null;
};

type NodeMetadata = {
  parentNode?: string;
  extent?: 'parent';
  [key: string]: unknown;
} | null | undefined;

type DBEdge = {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  type: string;
  label?: string | null;
  animated?: boolean | null;
  color?: string | null;
};

const nodeTypes = {
  image: ImageNode,
  checklist: ChecklistNode,
  linkPreview: LinkPreviewNode,
  code: CodeNode,
  stickyNote: StickyNoteNode,
};

function CanvasEditorInner({ canvasId, workspaceId, onSave }: CanvasEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [title, setTitle] = useState('Untitled Canvas');
  const [saving, setSaving] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsDialogOpen, setSuggestionsDialogOpen] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<{
    relatedConcepts: Array<{
      title: string;
      description: string;
      suggestedPosition: string;
    }>;
    suggestedConnections?: Array<{ from: string; to: string; reason: string; label?: string }>;
    connections?: Array<{ from: string; to: string; reason: string }>;
    groupings?: Array<{ name: string; nodes: string[]; reason: string }>;
    nextSteps?: string[];
  } | null>(null);
  const [currentCanvasId, setCurrentCanvasId] = useState(canvasId);
  const [showMinimap, setShowMinimap] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  // Theme system
  type ThemeKey = 'light-clean' | 'dark-slate' | 'mind-map' | 'ocean' | 'sunset' | 'forest' | 'grape' | 'rose';
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('light-clean');
  const [nodeShape, setNodeShape] = useState<'rounded' | 'capsule' | 'rectangle'>('rounded');
  const [_edgeStyle, setEdgeStyle] = useState<'straight' | 'step' | 'smooth'>('straight');
  const [edgeAnimated, setEdgeAnimated] = useState(false);
  const [collaborationEnabled, setCollaborationEnabled] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string; name?: string; avatar?: string } | null>(null);
  const [importNotesOpen, setImportNotesOpen] = useState(false);
    const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<Array<{ nodes: Node[]; edges: Edge[]; title: string }>>([]);
  const redoStack = useRef<Array<{ nodes: Node[]; edges: Edge[]; title: string }>>([]);
  const clipboardRef = useRef<Array<Node>>([]);
  const { fitView } = useReactFlow();

  // Load user for collaboration
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  // Collaboration hook
  const collaboration = useCollaborativeCanvas({
    noteId: currentCanvasId ? parseInt(currentCanvasId, 10) : 0,
    userId: user?.id || 'anonymous',
    userName: user?.name,
    userAvatar: user?.avatar,
    enabled: collaborationEnabled && !!currentCanvasId && !!user,
  });

  // Broadcast cursor movements
  useCursorBroadcast(
    collaboration.updateCursorPosition,
    collaborationEnabled && collaboration.isConnected
  );

  // Subscribe to canvas updates
  useEffect(() => {
    if (!collaborationEnabled || !collaboration.isConnected) return;

    collaboration.subscribeToCanvasUpdates((update) => {
      if (update.userId === user?.id) return; // Ignore own updates

      if (update.action === 'update' && update.data) {
        setNodes((nds) => {
          const nodeIndex = nds.findIndex((n) => n.id === update.nodeId);
          if (nodeIndex >= 0) {
            const updatedNodes = [...nds];
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              ...(update.data as Partial<Node>),
            };
            return updatedNodes;
          }
          return nds;
        });
      } else if (update.action === 'create' && update.data) {
        setNodes((nds) => {
          // Check if node already exists
          if (nds.find((n) => n.id === update.nodeId)) return nds;
          return [...nds, update.data as Node];
        });
      } else if (update.action === 'delete') {
        setNodes((nds) => nds.filter((n) => n.id !== update.nodeId));
      }
    });
  }, [collaborationEnabled, collaboration, user?.id, setNodes]);

  // Update collaboration status when editing
  const handleNodeChangeStart = useCallback(
    (nodeId: string) => {
      if (collaborationEnabled) {
        collaboration.updateStatus('editing');
        collaboration.updateFocusedElement(nodeId);
        collaboration.lockNode(nodeId);
      }
    },
    [collaborationEnabled, collaboration]
  );

  const handleNodeChangeEnd = useCallback(
    (nodeId: string) => {
      if (collaborationEnabled) {
        collaboration.updateStatus('viewing');
        collaboration.updateFocusedElement(null);
        collaboration.unlockNode(nodeId);
      }
    },
    [collaborationEnabled, collaboration]
  );

  // Load canvas if canvasId provided
  useEffect(() => {
    if (canvasId) {
      loadCanvas(canvasId);
    } else {
      // Check for draft canvas in sessionStorage
      try {
        const draft = sessionStorage.getItem('canvasDraft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.title) setTitle(parsed.title);
          if (Array.isArray(parsed.nodes)) setNodes(parsed.nodes);
          if (Array.isArray(parsed.edges)) setEdges(parsed.edges);
          sessionStorage.removeItem('canvasDraft');
        }
      } catch (e) {
        console.warn('Failed to load canvas draft:', e);
      }
    }
    // loadCanvas, setNodes, and setEdges are stable callbacks from hooks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  const loadCanvas = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/canvases/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTitle(data.canvas.title);
        // Rehydrate appearance settings from canvas.description if it contains JSON
        try {
          if (data.canvas.description) {
            const desc = JSON.parse(data.canvas.description);
            if (desc && typeof desc === 'object') {
              if (desc.theme) setCurrentTheme(desc.theme);
              if (desc.nodeShape) setNodeShape(desc.nodeShape);
              if (desc.edgeStyle) setEdgeStyle(desc.edgeStyle);
              if (typeof desc.edgeAnimated === 'boolean') setEdgeAnimated(desc.edgeAnimated);
            }
          }
        } catch {
          // ignore non-JSON descriptions
        }
        
        // Convert nodes from DB format to ReactFlow format
        const flowNodes = (data.nodes as DBNode[]).map((node) => {
          const meta = node.metadata as NodeMetadata;
          return ({
          id: node.node_id,
          type: node.type,
          position: { x: node.position_x, y: node.position_y },
          data: { 
            label: node.content,
            color: node.color,
            backgroundColor: node.background_color,
          },
          style: {
            width: node.width,
            height: node.height,
            backgroundColor: node.background_color,
            border: `2px solid ${node.border_color}`,
            borderRadius: '8px',
            padding: '10px',
          },
          // Reparent/group if metadata contains parent info
          parentNode: meta?.parentNode,
          extent: meta?.extent,
        });
        });
        
        // Convert edges
        const flowEdges = (data.edges as DBEdge[]).map((edge) => ({
          id: edge.edge_id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          type: edge.type,
          label: edge.label ?? undefined,
          animated: edge.animated ?? false,
          style: edge.color ? { stroke: edge.color } : undefined,
        }));
        
        setNodes(flowNodes);
        setEdges(flowEdges);
      }
    } catch (error) {
      console.error('Error loading canvas:', error);
    }
  }, [setNodes, setEdges]);

  const snapshot = useCallback(() => ({
    nodes: JSON.parse(JSON.stringify(nodes)) as Node[],
    edges: JSON.parse(JSON.stringify(edges)) as Edge[],
    title,
  }), [nodes, edges, title]);

    // Handle version restore - reload the canvas after a version is restored
    const handleVersionRestore = useCallback(() => {
      if (currentCanvasId) {
        loadCanvas(currentCanvasId);
        toast.success('Canvas restored from history');
        setVersionHistoryOpen(false);
      }
      }, [currentCanvasId, loadCanvas]);

  const pushUndo = useCallback(() => {
    undoStack.current.push(snapshot());
    // Clear redo on new action
    redoStack.current = [];
  }, [snapshot]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(snapshot());
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setTitle(prev.title);
  }, [setEdges, setNodes, snapshot]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(snapshot());
    setNodes(next.nodes);
    setEdges(next.edges);
    setTitle(next.title);
  }, [setEdges, setNodes, snapshot]);

  

  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    pushUndo();
    onNodesChange(changes);

    // Broadcast changes to collaborators
    if (collaborationEnabled && collaboration.isConnected) {
      changes.forEach((change) => {
        if (change.type === 'position' && change.dragging) {
          // Node is being dragged
          handleNodeChangeStart(change.id);
        } else if (change.type === 'position' && !change.dragging) {
          // Node drag ended
          handleNodeChangeEnd(change.id);
          // Broadcast final position
          const node = nodes.find((n) => n.id === change.id);
          if (node) {
            collaboration.broadcastCanvasUpdate(change.id, 'update', {
              position: change.position,
            });
          }
        } else if (change.type === 'remove') {
          collaboration.broadcastCanvasUpdate(change.id, 'delete');
        }
      });
    }
  }, [onNodesChange, pushUndo, collaborationEnabled, collaboration, nodes, handleNodeChangeStart, handleNodeChangeEnd]);

  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    pushUndo();
    onEdgesChange(changes);
  }, [onEdgesChange, pushUndo]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Theme presets and helpers
  const themePresets: Record<ThemeKey, { node: { bg: string; border: string; text: string }; edge: { color: string }; canvas: { background: { variant: BackgroundVariant; gap: number; size: number } } }> = {
    'light-clean': {
      node: { bg: '#ffffff', border: '#e2e8f0', text: '#0f172a' },
      edge: { color: '#94a3b8' },
      canvas: { background: { variant: BackgroundVariant.Dots, gap: 12, size: 1 } },
    },
    'dark-slate': {
      node: { bg: '#1e293b', border: '#475569', text: '#f1f5f9' },
      edge: { color: '#64748b' },
      canvas: { background: { variant: BackgroundVariant.Dots, gap: 14, size: 1 } },
    },
    'mind-map': {
      node: { bg: '#fff7ed', border: '#fb923c', text: '#7c2d12' },
      edge: { color: '#fb923c' },
      canvas: { background: { variant: BackgroundVariant.Dots, gap: 16, size: 1 } },
    },
    'ocean': {
      node: { bg: '#ecfeff', border: '#06b6d4', text: '#083344' },
      edge: { color: '#06b6d4' },
      canvas: { background: { variant: BackgroundVariant.Dots, gap: 14, size: 1 } },
    },
    'sunset': {
      node: { bg: '#fff1f2', border: '#fb7185', text: '#7f1d1d' },
      edge: { color: '#fb7185' },
      canvas: { background: { variant: BackgroundVariant.Dots, gap: 14, size: 1 } },
    },
    'forest': {
      node: { bg: '#ecfdf5', border: '#10b981', text: '#064e3b' },
      edge: { color: '#10b981' },
      canvas: { background: { variant: BackgroundVariant.Dots, gap: 14, size: 1 } },
    },
    'grape': {
      node: { bg: '#f5f3ff', border: '#8b5cf6', text: '#2e1065' },
      edge: { color: '#8b5cf6' },
      canvas: { background: { variant: BackgroundVariant.Dots, gap: 14, size: 1 } },
    },
    'rose': {
      node: { bg: '#fff1f2', border: '#f43f5e', text: '#881337' },
      edge: { color: '#f43f5e' },
      canvas: { background: { variant: BackgroundVariant.Dots, gap: 14, size: 1 } },
    },
  } as const;

  const shapeToRadius: Record<typeof nodeShape, string> = {
    rounded: '8px',
    capsule: '9999px',
    rectangle: '4px',
  };

  const applyTheme = (key: ThemeKey) => {
    pushUndo();
    setCurrentTheme(key);
    const preset = themePresets[key];
    setNodes(prev => prev.map(n => ({
      ...n,
      style: {
        ...n.style,
        // Always override to ensure visible theme change
        backgroundColor: preset.node.bg,
        border: `2px solid ${preset.node.border}`,
        borderRadius: shapeToRadius[nodeShape],
        padding: '10px',
      },
      data: {
        ...n.data,
        color: preset.node.text,
      }
    })));
    setEdges(prev => prev.map(e => ({
      ...e,
      style: { ...(e.style || {}), stroke: preset.edge.color },
    })));
  };

  const applyNodeShape = (shape: typeof nodeShape) => {
    pushUndo();
    setNodeShape(shape);
    const radius = shapeToRadius[shape];
    setNodes(prev => prev.map(n => ({
      ...n,
      style: { ...n.style, borderRadius: radius },
    })));
  };

  const applyEdgeStyle = (style: typeof _edgeStyle) => {
    pushUndo();
    setEdgeStyle(style);
    const type = style === 'smooth' ? 'smoothstep' : style === 'step' ? 'step' : 'default';
    setEdges(prev => prev.map(e => ({ ...e, type })));
  };

  const toggleEdgeAnimation = () => {
    pushUndo();
    setEdgeAnimated(v => {
      const next = !v;
      setEdges(prev => prev.map(e => ({ ...e, animated: next })));
      return next;
    });
  };

  // Helper to add node with collaboration support
  const addNodeWithBroadcast = useCallback((newNode: Node) => {
    pushUndo();
    setNodes((nds) => [...nds, newNode]);
    
    // Broadcast to collaborators
    if (collaborationEnabled && collaboration.isConnected) {
      collaboration.broadcastCanvasUpdate(newNode.id, 'create', newNode);
    }
  }, [pushUndo, setNodes, collaborationEnabled, collaboration]);

  // Handle loading a template
  const handleLoadTemplate = useCallback((template: { nodes: Node[]; edges: Edge[]; viewport?: { x: number; y: number; zoom: number } }) => {
    pushUndo();
    // Ensure all template nodes are draggable, selectable, connectable AND editable
    const editableNodes = template.nodes.map(node => {
      const baseNode = {
        ...node,
        draggable: true,
        selectable: true,
        connectable: true,
      };
      
      // For React Flow default nodes (input, default, output), make their labels editable
      // by storing label in data.label and ensuring data exists
      if (!node.type || node.type === 'input' || node.type === 'default' || node.type === 'output') {
        const label = node.data?.label || (node as { label?: string }).label || 'Click to edit';
        return {
          ...baseNode,
          type: node.type || 'default',
          data: {
            ...node.data,
            label,
            // Store original for restoration if needed
            originalLabel: label,
          }
        };
      }
      
      // For stickyNote nodes, ensure data.text exists
      if (node.type === 'stickyNote') {
        return {
          ...baseNode,
          data: {
            ...node.data,
            text: node.data.text || node.data.label || 'Edit me',
          }
        };
      }
      
      // For other custom node types, preserve their data structure
      return baseNode;
    });
    
    setNodes(editableNodes);
    setEdges(template.edges);
    if (template.viewport) {
      setTimeout(() => {
        fitView({ padding: 0.2, ...template.viewport });
      }, 100);
    }
    toast.success('Template loaded! Double-click nodes to edit.');
  }, [pushUndo, setNodes, setEdges, fitView]);

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // For default React Flow nodes (input, default, output), convert to a stickyNote
    // so users can edit the full note content inline.
    if (!node.type || node.type === 'input' || node.type === 'default' || node.type === 'output') {
  const currentLabel = node.data?.label || (node as unknown as { label?: string }).label || '';

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              type: 'stickyNote',
              data: {
                // preserve existing data fields and copy label into text
                ...((n.data as Record<string, unknown>) || {}),
                text: currentLabel || 'Edit me',
                editing: true,
              },
              // Optional: provide a reasonable default style for sticky notes when converting
              style: {
                ...(n.style || {}),
                backgroundColor: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '8px',
                padding: '10px',
              },
            };
          }
          return n;
        })
      );
      // No toast here; the sticky note component will focus into edit mode
    }
    // Custom nodes (stickyNote, checklist, code, etc.) handle their own editing internally
  }, [setNodes]);

  const addStickyNote = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'stickyNote',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        text: 'New Note',
        editing: true, // Start in editing mode
      },
      style: {
        backgroundColor: '#fef3c7',
        border: '2px solid #fbbf24',
        borderRadius: '8px',
        padding: '10px',
        width: 200,
        minHeight: 150,
      },
    };
    addNodeWithBroadcast(newNode);
    toast.success('Note added');
  };

  const addImageNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'image',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { editing: true },
    };
    addNodeWithBroadcast(newNode);
    toast.success('Image node added');
  };

  const addChecklistNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'checklist',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        title: 'New Checklist',
        items: [],
      },
    };
    addNodeWithBroadcast(newNode);
    toast.success('Checklist added');
  };

  const addLinkPreviewNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'linkPreview',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { editing: true },
    };
    addNodeWithBroadcast(newNode);
    toast.success('Link preview added');
  };

  const addCodeNode = () => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'code',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        code: '// Enter your code here',
        language: 'javascript',
      },
    };
    addNodeWithBroadcast(newNode);
    toast.success('Code node added');
  };

  // Import notes as canvas nodes
  const handleImportNotes = (notes: Array<{
    id: number;
    summary: string;
    takeaways: string[];
    actions: Array<{ task: string; datetime?: string | null }>;
  }>) => {
    console.log('[CanvasEditor] handleImportNotes called with', notes.length, 'notes');
    console.log('[CanvasEditor] First note:', notes[0]);
    
    if (notes.length === 0) return;
    
    pushUndo();
    
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    // Layout notes in a grid
    const cols = Math.ceil(Math.sqrt(notes.length));
    const spacing = 300;
    const startX = 100;
    const startY = 100;
    
    notes.forEach((note, index) => {
      console.log(`[CanvasEditor] Processing note ${index + 1}/${notes.length}:`, {
        id: note.id,
        summary: note.summary?.substring(0, 50),
        takeawaysCount: note.takeaways?.length || 0,
        actionsCount: note.actions?.length || 0
      });
      
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = startX + col * spacing;
      const y = startY + row * spacing;
      
      // Main summary node
      const summaryNodeId = `note-${note.id}-summary`;
      newNodes.push({
        id: summaryNodeId,
        type: 'stickyNote',
        position: { x, y },
        data: { 
          text: note.summary,
          editing: false,
        },
        style: {
          backgroundColor: '#ffffff', // will be overridden by theme apply if user changes theme
          border: '2px solid #3b82f6',
          borderRadius: shapeToRadius[nodeShape],
          padding: '12px',
          width: 250,
          minHeight: 80,
        },
      });
      
      // Takeaways nodes (below summary)
      note.takeaways?.forEach((takeaway, tIdx) => {
        const takeawayId = `note-${note.id}-takeaway-${tIdx}`;
        newNodes.push({
          id: takeawayId,
          type: 'stickyNote',
          position: { 
            x: x - 100 + tIdx * 120, 
            y: y + 120 
          },
          data: { 
            text: takeaway,
            editing: false,
          },
          style: {
            backgroundColor: '#fff7ed',
            border: '2px solid #fb923c',
            borderRadius: shapeToRadius[nodeShape],
            padding: '10px',
            width: 220,
            fontSize: '12px',
          },
        });
        
        // Connect summary to takeaway
        newEdges.push({
          id: `edge-${summaryNodeId}-${takeawayId}`,
          source: summaryNodeId,
          target: takeawayId,
          type: 'smoothstep',
          style: { stroke: '#f59e0b' },
        });
      });
      
      // Action nodes (to the right of summary)
      note.actions?.forEach((action, aIdx) => {
        const actionId = `note-${note.id}-action-${aIdx}`;
        newNodes.push({
          id: actionId,
          type: 'stickyNote',
          position: { 
            x: x + 280, 
            y: y + aIdx * 80 
          },
          data: { 
            text: action.task,
            editing: false,
          },
          style: {
            backgroundColor: '#f0fdf4',
            border: '2px solid #22c55e',
            borderRadius: shapeToRadius[nodeShape],
            padding: '8px',
            width: 180,
            fontSize: '12px',
          },
        });
        
        // Connect summary to action
        newEdges.push({
          id: `edge-${summaryNodeId}-${actionId}`,
          source: summaryNodeId,
          target: actionId,
          type: 'smoothstep',
          style: { stroke: '#22c55e' },
        });
      });
    });
    
    console.log('[CanvasEditor] Created', newNodes.length, 'nodes and', newEdges.length, 'edges');
    
    setNodes(prev => [...prev, ...newNodes]);
    setEdges(prev => [...prev, ...newEdges]);
    
    // Fit view to show all nodes
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  };

  const handleAutoLayout = (layoutType: LayoutType) => {
    if (nodes.length === 0) {
      toast.error('Add some nodes first');
      return;
    }

    pushUndo();
    const layouted = applyLayout(layoutType, [...nodes], edges);
    setNodes(layouted);
    
    const layoutNames = {
      tree: 'Tree',
      force: 'Force-Directed',
      grid: 'Grid',
      circular: 'Circular',
      hierarchical: 'Hierarchical'
    };
    toast.success(`${layoutNames[layoutType]} layout applied`);
  };

  const getAISuggestions = async () => {
    if (nodes.length === 0) {
      toast.error('Add some nodes first to get AI suggestions');
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/canvas/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map(n => ({ id: n.id, data: n.data })),
          edges,
          context: title
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      const { suggestions } = data;

      // Show suggestions in the dialog
      if (suggestions.relatedConcepts && suggestions.relatedConcepts.length > 0) {
        setCurrentSuggestions(suggestions);
        setSuggestionsDialogOpen(true);
        toast.success(`AI found ${suggestions.relatedConcepts.length} related concepts!`);
      } else {
        toast.info('No new suggestions at this time');
      }

    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      toast.error('Failed to get AI suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddSuggestedConcept = (concept: { title: string; description: string; suggestedPosition: string }) => {
    // Add a new node with the suggested concept
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'stickyNote',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: {
        text: `${concept.title}\n\n${concept.description}`,
        editing: false,
      },
      style: {
        width: 200,
        height: 150,
        backgroundColor: '#fef3c7',
        border: '2px solid #fbbf24',
        borderRadius: '8px',
        padding: '10px',
      },
    };
    setNodes((nds) => [...nds, newNode]);
    toast.success(`Added "${concept.title}" to canvas`);
  };

  const handleAddSuggestedConnection = (connection: { from: string; to: string; reason: string }) => {
    // Find nodes that match the connection text
    const sourceNode = nodes.find(n => n.data.label.toLowerCase().includes(connection.from.toLowerCase()));
    const targetNode = nodes.find(n => n.data.label.toLowerCase().includes(connection.to.toLowerCase()));

    if (sourceNode && targetNode) {
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: sourceNode.id,
        target: targetNode.id,
        type: 'default',
        label: connection.reason,
      };
      setEdges((eds) => [...eds, newEdge]);
      toast.success(`Connected "${connection.from}" → "${connection.to}"`);
    } else {
      toast.error('Could not find matching nodes for this connection');
    }
  };

  const saveCanvas = async () => {
    setSaving(true);
    try {
      // Persist theme/style settings at canvas-level via description JSON
      const canvasDescription = JSON.stringify({
        theme: currentTheme,
        nodeShape,
        edgeStyle: _edgeStyle,
        edgeAnimated,
      });

      const getBorderColor = (n: Node): string => {
        const inline = (n.data as { borderColor?: string } | undefined)?.borderColor;
        if (inline) return inline;
        const border = n.style?.border as string | undefined;
        if (border) {
          const match = border.match(/\b(#(?:[0-9a-fA-F]{3}){1,2}|rgb\([^\)]+\)|rgba\([^\)]+\))\b/);
          if (match) return match[1];
        }
        return '#fbbf24';
      };

      // Convert ReactFlow format back to DB format
      const dbNodes = nodes.map(node => ({
        node_id: node.id,
        type: node.type || 'note',
        content: node.data.label,
        position_x: node.position.x,
        position_y: node.position.y,
        width: node.style?.width || 200,
        height: node.style?.height || 150,
        color: node.data.color || '#000',
        background_color: node.style?.backgroundColor || '#fef3c7',
        border_color: getBorderColor(node),
        metadata: {
          parentNode: (node as { parentNode?: string }).parentNode ?? undefined,
          extent: (node as { extent?: 'parent' }).extent ?? undefined,
          borderRadius: node.style?.borderRadius,
        },
      }));

      const dbEdges = edges.map(edge => ({
        edge_id: edge.id,
        source_node_id: edge.source,
        target_node_id: edge.target,
        type: edge.type || 'default',
        label: edge.label || '',
        color: edge.style?.stroke || '#94a3b8',
        animated: edge.animated || false,
        metadata: {},
      }));

      if (currentCanvasId) {
        // Update existing canvas
        const response = await fetch(`/api/canvases/${currentCanvasId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description: canvasDescription, nodes: dbNodes, edges: dbEdges }),
        });
        
        if (!response.ok) throw new Error('Failed to save canvas');
        toast.success('Canvas saved successfully!');
      } else {
        // Create new canvas
        const response = await fetch('/api/canvases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description: canvasDescription, workspace_id: workspaceId }),
        });
        
        if (!response.ok) throw new Error('Failed to create canvas');
        const data = await response.json();
        setCurrentCanvasId(data.canvas.id);
        
        // Save nodes and edges
        const saveResponse = await fetch(`/api/canvases/${data.canvas.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: canvasDescription, nodes: dbNodes, edges: dbEdges }),
        });
        
        if (!saveResponse.ok) throw new Error('Failed to save canvas content');
        toast.success('Canvas created and saved!');
      }
      
      onSave?.();
    } catch (error) {
      console.error('Error saving canvas:', error);
      toast.error('Failed to save canvas. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const exportCanvas = () => {
    const dataStr = JSON.stringify({ nodes, edges, title }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsPNG = async () => {
    if (!canvasRef.current) return;
    try {
      // Prefer capturing full react-flow wrapper (includes edges & nodes)
      const wrapper = canvasRef.current.querySelector('.react-flow') as HTMLElement;
      const target = wrapper || canvasRef.current;
      if (!target) return;

      // Determine background color from current theme
      const isDarkTheme = currentTheme === 'dark-slate';
      const exportBgColor = isDarkTheme ? '#0f172a' : '#ffffff';

      // Dynamically import html-to-image to avoid SSR issues
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(target, {
        pixelRatio: 2,
        backgroundColor: exportBgColor,
        cacheBust: true,
        filter: (node) => {
          // Skip minimap & command dialogs from export for clarity
          if (node instanceof HTMLElement && node.classList.contains('react-flow__minimap')) return false;
          return true;
        }
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${title}.png`;
      link.click();
    } catch (error) {
      console.error('Error exporting as PNG (html-to-image failed, falling back):', error);
      // Fallback: use theme-appropriate background color
      const isDarkTheme = currentTheme === 'dark-slate';
      const fallbackBg = isDarkTheme ? '#0f172a' : '#ffffff';
      const viewport = canvasRef.current.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewport) return;
      const bounds = viewport.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = bounds.width;
      canvas.height = bounds.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = fallbackBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${title}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    }
  };

  const exportAsSVG = () => {
    // Create SVG from nodes and edges data
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
        <rect width="100%" height="100%" fill="#ffffff"/>
        ${nodes.map(node => `
          <g transform="translate(${node.position.x}, ${node.position.y})">
            <rect width="${node.style?.width || 200}" height="${node.style?.height || 150}" 
                  fill="${node.style?.backgroundColor || '#fef3c7'}" 
                  stroke="${node.data.borderColor || '#fbbf24'}" 
                  stroke-width="2" rx="8"/>
            <text x="10" y="30" font-family="Arial" font-size="14" fill="${node.data.color || '#000'}">
              ${node.data.label}
            </text>
          </g>
        `).join('')}
        ${edges.map(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return '';
          
          const sx = sourceNode.position.x + ((sourceNode.style?.width as number) || 200) / 2;
          const sy = sourceNode.position.y + ((sourceNode.style?.height as number) || 150) / 2;
          const tx = targetNode.position.x + ((targetNode.style?.width as number) || 200) / 2;
          const ty = targetNode.position.y + ((targetNode.style?.height as number) || 150) / 2;
          
          return `
            <line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" 
                  stroke="${edge.style?.stroke || '#94a3b8'}" 
                  stroke-width="2" 
                  marker-end="url(#arrowhead)"/>
          `;
        }).join('')}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>
    `.trim();

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareCanvas = async () => {
    if (!currentCanvasId) {
      toast.info('Please save the canvas first before sharing');
      return;
    }

    try {
      // Make canvas public
      await fetch(`/api/canvases/${currentCanvasId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: true }),
      });

      // Copy share link
      const shareUrl = `${window.location.origin}/canvas/${currentCanvasId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard');
    } catch (error) {
      console.error('Error sharing canvas:', error);
      toast.error('Failed to share canvas');
    }
  };

  // Register keyboard shortcuts after functions are defined
  useKeyboardShortcuts([
    { ...commonShortcuts.save, callback: () => void saveCanvas() },
    { key: 'e', ctrl: true, description: 'Export canvas', callback: exportCanvas },
    { key: 'z', ctrl: true, description: 'Undo', callback: undo },
    { key: 'y', ctrl: true, description: 'Redo', callback: redo },
    { key: 'k', ctrl: true, description: 'Command palette', callback: () => setCommandOpen(true) },
  ]);

  // Context menu actions
  const deleteSelected = () => {
    const anySelected = nodes.some(n => n.selected) || edges.some(e => e.selected);
    if (!anySelected) {
      toast.info('No selection to delete');
      return;
    }
    pushUndo();
    setNodes(prev => prev.filter(n => !n.selected));
    setEdges(prev => prev.filter(e => !e.selected));
  };

  const duplicateSelected = () => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) {
      toast.info('Select nodes to duplicate');
      return;
    }
    pushUndo();
    const dupes: Node[] = selected.map(n => ({
      ...JSON.parse(JSON.stringify(n)),
      id: `${n.id}-copy-${Date.now()}`,
      position: { x: n.position.x + 40, y: n.position.y + 40 },
    }));
    setNodes(prev => [...prev, ...dupes]);
  };

  const copySelected = () => {
    const selected = nodes.filter(n => n.selected);
    clipboardRef.current = selected.map(n => JSON.parse(JSON.stringify(n)));
    toast.success(`${selected.length} node(s) copied`);
  };

  const pasteClipboard = () => {
    if (clipboardRef.current.length === 0) {
      toast.info('Clipboard is empty');
      return;
    }
    pushUndo();
    const pasted = clipboardRef.current.map(n => ({
      ...JSON.parse(JSON.stringify(n)),
      id: `${n.id}-paste-${Date.now()}`,
      position: { x: n.position.x + 60, y: n.position.y + 60 },
    }));
    setNodes(prev => [...prev, ...pasted]);
  };

  // Grouping helpers
  const groupSelection = () => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length < 2) {
      toast.info('Select two or more nodes to group');
      return;
    }
    pushUndo();
    const padding = 24;
    const minX = Math.min(...selected.map(n => n.position.x));
    const minY = Math.min(...selected.map(n => n.position.y));
    const maxX = Math.max(...selected.map(n => n.position.x + ((n.style?.width as number) || 200)));
    const maxY = Math.max(...selected.map(n => n.position.y + ((n.style?.height as number) || 150)));
    const groupId = `group-${Date.now()}`;
    const groupNode: Node = {
      id: groupId,
      type: 'default',
      position: { x: minX - padding, y: minY - padding },
      data: { label: 'Group' },
      style: {
        width: (maxX - minX) + padding * 2,
        height: (maxY - minY) + padding * 2,
        backgroundColor: 'transparent',
        border: '2px dashed #94a3b8',
        borderRadius: '12px',
        padding: '8px',
      },
    };
    const updated = nodes.map(n => {
      if (!n.selected) return n;
      return {
        ...n,
        parentNode: groupId,
        extent: 'parent',
        position: {
          x: n.position.x - (groupNode.position.x),
          y: n.position.y - (groupNode.position.y),
        },
      } as Node;
    });
    setNodes([ ...updated, groupNode ]);
  };

  const ungroupSelection = () => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) {
      toast.info('Select grouped nodes to ungroup');
      return;
    }
    pushUndo();
    const updated = nodes.map(n => {
      if (!n.selected || !n.parentNode) return n;
      const parent = nodes.find(p => p.id === n.parentNode);
      if (!parent) return { ...n, parentNode: undefined, extent: undefined } as Node;
      return {
        ...n,
        parentNode: undefined,
        extent: undefined,
        position: {
          x: n.position.x + (parent.position.x),
          y: n.position.y + (parent.position.y),
        },
      } as Node;
    });
    const childParentIds = new Set(updated.filter(n => n.parentNode).map(n => n.parentNode as string));
    const result = updated.filter(n => {
      if (!n.data?.label || n.data.label !== 'Group') return true;
      return childParentIds.has(n.id);
    });
    setNodes(result);
  };

  // Change node color
  const changeNodeColor = (color: string) => {
    const selected = nodes.filter(n => n.selected);
    if (selected.length === 0) {
      toast.info('Select a node to change color');
      return;
    }
    pushUndo();
    setNodes(prev => prev.map(n => {
      if (!n.selected) return n;
      return {
        ...n,
        style: {
          ...n.style,
          backgroundColor: color,
          border: `2px solid ${color}CC`, // Slightly darker border
        },
      };
    }));
    toast.success('Node color updated');
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-background p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full sm:max-w-md"
          placeholder="Canvas title"
        />
        <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
          {/* Primary action - Save button - always visible first */}
          <Button onClick={saveCanvas} disabled={saving} size="sm" className="order-first">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Canvas'}
          </Button>
          
            {/* Version History button */}
            <Button 
              onClick={() => setVersionHistoryOpen(true)} 
              variant="outline" 
              size="sm"
              disabled={!currentCanvasId}
              title={currentCanvasId ? 'View save history' : 'Save canvas first to view history'}
            >
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Node
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Node Types</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={addStickyNote}>
                <Plus className="h-4 w-4 mr-2" />
                Sticky Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addImageNode}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addChecklistNode}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Checklist
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addLinkPreviewNode}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Link Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addCodeNode}>
                <Code2 className="h-4 w-4 mr-2" />
                Code Snippet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Palette className="h-4 w-4 mr-2" />
                Theme
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Themes</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => applyTheme('light-clean')}>Light Clean</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyTheme('dark-slate')}>Dark Slate</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyTheme('mind-map')}>Mind Map</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyTheme('ocean')}>Ocean</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyTheme('sunset')}>Sunset</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyTheme('forest')}>Forest</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyTheme('grape')}>Grape</DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyTheme('rose')}>Rose</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Node Shape</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => applyNodeShape('rounded')}>
                <Shapes className="h-4 w-4 mr-2" /> Rounded
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyNodeShape('capsule')}>
                <Shapes className="h-4 w-4 mr-2" /> Capsule
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyNodeShape('rectangle')}>
                <Shapes className="h-4 w-4 mr-2" /> Rectangle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Edges</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => applyEdgeStyle('straight')}>
                <Route className="h-4 w-4 mr-2" /> Straight
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyEdgeStyle('step')}>
                <Route className="h-4 w-4 mr-2" /> Step
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyEdgeStyle('smooth')}>
                <Route className="h-4 w-4 mr-2" /> Smooth
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleEdgeAnimation}>
                <Route className="h-4 w-4 mr-2" /> {edgeAnimated ? 'Disable' : 'Enable'} Animation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Auto-Layout
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Smart Layouts</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAutoLayout('tree')}>
                <GitBranch className="h-4 w-4 mr-2" />
                Tree Layout
                <span className="ml-auto text-xs text-muted-foreground">Hierarchical</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAutoLayout('force')}>
                <Network className="h-4 w-4 mr-2" />
                Force-Directed
                <span className="ml-auto text-xs text-muted-foreground">Organic</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAutoLayout('hierarchical')}>
                <GitBranch className="h-4 w-4 mr-2 rotate-90" />
                Hierarchical
                <span className="ml-auto text-xs text-muted-foreground">Layered</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAutoLayout('grid')}>
                <Grid3x3 className="h-4 w-4 mr-2" />
                Grid Layout
                <span className="ml-auto text-xs text-muted-foreground">Organized</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAutoLayout('circular')}>
                <Circle className="h-4 w-4 mr-2" />
                Circular Layout
                <span className="ml-auto text-xs text-muted-foreground">Radial</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Template actions */}
          <CanvasTemplateSelector
            onSelectTemplate={handleLoadTemplate}
            workspaceId={workspaceId}
          >
            <Button variant="outline" size="sm">
              <FolderInput className="h-4 w-4 mr-2" />
              Load Template
            </Button>
          </CanvasTemplateSelector>

          {/* Import Notes */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setImportNotesOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Import Notes
          </Button>

          <CanvasTemplateSaveDialog
            nodes={nodes}
            edges={edges}
            viewport={undefined}
            workspaceId={workspaceId}
          >
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
          </CanvasTemplateSaveDialog>

          <Button 
            onClick={getAISuggestions} 
            variant="outline" 
            size="sm"
            disabled={loadingSuggestions}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {loadingSuggestions ? 'Thinking...' : 'AI Suggest'}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportAsPNG}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportAsSVG}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Export as SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCanvas}>
                <FileJson className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button onClick={shareCanvas} variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>

          {/* Collaboration toggle */}
          {user && currentCanvasId && (
            <>
              <Button
                onClick={() => setCollaborationEnabled(!collaborationEnabled)}
                variant={collaborationEnabled ? "default" : "outline"}
                size="sm"
              >
                <Users className="h-4 w-4 mr-2" />
                {collaborationEnabled ? 'Live' : 'Collaborate'}
              </Button>
              
              {collaborationEnabled && collaboration.isConnected && (
                <div className="flex items-center gap-2 pl-2 border-l">
                  <PresenceIndicator presence={collaboration.presence} />
                  <span className="text-sm text-muted-foreground">
                    {collaboration.activeUsers.length} online
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="h-full" ref={canvasRef}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onNodeDoubleClick={handleNodeDoubleClick}
                nodeTypes={nodeTypes}
                nodesDraggable={true}
                nodesConnectable={true}
                elementsSelectable={true}
                selectionOnDrag
                fitView
                deleteKeyCode={null}
              >
                <Controls />
                {showMinimap && <MiniMap />}
                <Background 
                  variant={themePresets[currentTheme].canvas.background.variant} 
                  gap={themePresets[currentTheme].canvas.background.gap} 
                  size={themePresets[currentTheme].canvas.background.size} 
                />
              </ReactFlow>
              
              {/* Live cursors for collaboration */}
              {collaborationEnabled && collaboration.isConnected && (
                <LiveCursors presence={collaboration.presence} />
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="max-h-[80vh] overflow-y-auto">
            <ContextMenuLabel>Add Nodes</ContextMenuLabel>
            <ContextMenuItem onClick={addStickyNote}>
              <Plus className="h-4 w-4 mr-2" />
              Sticky Note
            </ContextMenuItem>
            <ContextMenuItem onClick={addImageNode}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Image
            </ContextMenuItem>
            <ContextMenuItem onClick={addChecklistNode}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Checklist
            </ContextMenuItem>
            <ContextMenuItem onClick={addLinkPreviewNode}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Link Preview
            </ContextMenuItem>
            <ContextMenuItem onClick={addCodeNode}>
              <Code2 className="h-4 w-4 mr-2" />
              Code Snippet
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuLabel>Edit</ContextMenuLabel>
            <ContextMenuItem onClick={deleteSelected}>Delete Selected</ContextMenuItem>
            <ContextMenuItem onClick={duplicateSelected}>Duplicate Selected</ContextMenuItem>
            <ContextMenuItem onClick={copySelected}>Copy</ContextMenuItem>
            <ContextMenuItem onClick={pasteClipboard}>Paste</ContextMenuItem>
            <ContextMenuItem onClick={groupSelection}>
              <Layers className="h-4 w-4 mr-2" /> Group Selection
            </ContextMenuItem>
            <ContextMenuItem onClick={ungroupSelection}>
              <PanelsTopLeft className="h-4 w-4 mr-2" /> Ungroup Selection
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuLabel>Node Color</ContextMenuLabel>
            <ContextMenuItem onClick={() => changeNodeColor('#fef3c7')}>
              <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: '#fef3c7' }}></div> Yellow
            </ContextMenuItem>
            <ContextMenuItem onClick={() => changeNodeColor('#fecaca')}>
              <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: '#fecaca' }}></div> Red
            </ContextMenuItem>
            <ContextMenuItem onClick={() => changeNodeColor('#bfdbfe')}>
              <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: '#bfdbfe' }}></div> Blue
            </ContextMenuItem>
            <ContextMenuItem onClick={() => changeNodeColor('#bbf7d0')}>
              <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: '#bbf7d0' }}></div> Green
            </ContextMenuItem>
            <ContextMenuItem onClick={() => changeNodeColor('#e9d5ff')}>
              <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: '#e9d5ff' }}></div> Purple
            </ContextMenuItem>
            <ContextMenuItem onClick={() => changeNodeColor('#fed7aa')}>
              <div className="w-4 h-4 mr-2 rounded" style={{ backgroundColor: '#fed7aa' }}></div> Orange
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuLabel>Layout</ContextMenuLabel>
            <ContextMenuItem onClick={() => handleAutoLayout('tree')}>Tree</ContextMenuItem>
            <ContextMenuItem onClick={() => handleAutoLayout('force')}>Force-Directed</ContextMenuItem>
            <ContextMenuItem onClick={() => handleAutoLayout('grid')}>Grid</ContextMenuItem>
            <ContextMenuItem onClick={() => handleAutoLayout('hierarchical')}>Hierarchical</ContextMenuItem>
            <ContextMenuItem onClick={() => handleAutoLayout('circular')}>Circular</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => fitView({ padding: 0.2 })}>Fit View</ContextMenuItem>
            <ContextMenuItem onClick={() => setShowMinimap(v => !v)}>{showMinimap ? 'Hide' : 'Show'} Minimap</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={exportAsPNG}>Export as PNG</ContextMenuItem>
            <ContextMenuItem onClick={exportAsSVG}>Export as SVG</ContextMenuItem>
            <ContextMenuItem onClick={exportCanvas}>Export as JSON</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* Info Panel */}
      <div className="border-t bg-background p-2 text-sm text-muted-foreground flex items-center gap-4">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} connections</span>
        <span className="ml-auto">Drag to create • Click to edit • Connect nodes</span>
      </div>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Add Nodes">
            <CommandItem onSelect={() => { addStickyNote(); setCommandOpen(false); }}>
              <Plus className="h-4 w-4 mr-2" />
              Sticky Note
            </CommandItem>
            <CommandItem onSelect={() => { addImageNode(); setCommandOpen(false); }}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Image
            </CommandItem>
            <CommandItem onSelect={() => { addChecklistNode(); setCommandOpen(false); }}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Checklist
            </CommandItem>
            <CommandItem onSelect={() => { addLinkPreviewNode(); setCommandOpen(false); }}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Link Preview
            </CommandItem>
            <CommandItem onSelect={() => { addCodeNode(); setCommandOpen(false); }}>
              <Code2 className="h-4 w-4 mr-2" />
              Code Snippet
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Canvas">
            <CommandItem onSelect={() => { fitView({ padding: 0.2 }); setCommandOpen(false); }}>
              Fit View
            </CommandItem>
            <CommandItem onSelect={() => { setShowMinimap(v => !v); setCommandOpen(false); }}>
              {showMinimap ? 'Hide' : 'Show'} Minimap
            </CommandItem>
            <CommandItem onSelect={() => { applyTheme('light-clean'); setCommandOpen(false); }}>
              Theme: Light Clean
            </CommandItem>
            <CommandItem onSelect={() => { applyTheme('dark-slate'); setCommandOpen(false); }}>
              Theme: Dark Slate
            </CommandItem>
            <CommandItem onSelect={() => { applyTheme('mind-map'); setCommandOpen(false); }}>
              Theme: Mind Map
            </CommandItem>
            <CommandItem onSelect={() => { applyTheme('ocean'); setCommandOpen(false); }}>
              Theme: Ocean
            </CommandItem>
            <CommandItem onSelect={() => { applyTheme('sunset'); setCommandOpen(false); }}>
              Theme: Sunset
            </CommandItem>
            <CommandItem onSelect={() => { applyTheme('forest'); setCommandOpen(false); }}>
              Theme: Forest
            </CommandItem>
            <CommandItem onSelect={() => { applyTheme('grape'); setCommandOpen(false); }}>
              Theme: Grape
            </CommandItem>
            <CommandItem onSelect={() => { applyTheme('rose'); setCommandOpen(false); }}>
              Theme: Rose
            </CommandItem>
            <CommandItem onSelect={() => { applyNodeShape('rounded'); setCommandOpen(false); }}>
              Node Shape: Rounded
            </CommandItem>
            <CommandItem onSelect={() => { applyNodeShape('capsule'); setCommandOpen(false); }}>
              Node Shape: Capsule
            </CommandItem>
            <CommandItem onSelect={() => { applyNodeShape('rectangle'); setCommandOpen(false); }}>
              Node Shape: Rectangle
            </CommandItem>
            <CommandItem onSelect={() => { applyEdgeStyle('straight'); setCommandOpen(false); }}>
              Edge: Straight
            </CommandItem>
            <CommandItem onSelect={() => { applyEdgeStyle('step'); setCommandOpen(false); }}>
              Edge: Step
            </CommandItem>
            <CommandItem onSelect={() => { applyEdgeStyle('smooth'); setCommandOpen(false); }}>
              Edge: Smooth
            </CommandItem>
            <CommandItem onSelect={() => { toggleEdgeAnimation(); setCommandOpen(false); }}>
              Edge Animation: Toggle
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Layout">
            <CommandItem onSelect={() => { handleAutoLayout('tree'); setCommandOpen(false); }}>Tree</CommandItem>
            <CommandItem onSelect={() => { handleAutoLayout('force'); setCommandOpen(false); }}>Force-Directed</CommandItem>
            <CommandItem onSelect={() => { handleAutoLayout('grid'); setCommandOpen(false); }}>Grid</CommandItem>
            <CommandItem onSelect={() => { handleAutoLayout('hierarchical'); setCommandOpen(false); }}>Hierarchical</CommandItem>
            <CommandItem onSelect={() => { handleAutoLayout('circular'); setCommandOpen(false); }}>Circular</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Export">
            <CommandItem onSelect={() => { exportAsPNG(); setCommandOpen(false); }}>Export as PNG</CommandItem>
            <CommandItem onSelect={() => { exportAsSVG(); setCommandOpen(false); }}>Export as SVG</CommandItem>
            <CommandItem onSelect={() => { exportCanvas(); setCommandOpen(false); }}>Export as JSON</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Edit">
            <CommandItem onSelect={() => { undo(); setCommandOpen(false); }}>Undo</CommandItem>
            <CommandItem onSelect={() => { redo(); setCommandOpen(false); }}>Redo</CommandItem>
            <CommandItem onSelect={() => { copySelected(); setCommandOpen(false); }}>Copy</CommandItem>
            <CommandItem onSelect={() => { pasteClipboard(); setCommandOpen(false); }}>Paste</CommandItem>
            <CommandItem onSelect={() => { duplicateSelected(); setCommandOpen(false); }}>Duplicate</CommandItem>
            <CommandItem onSelect={() => { deleteSelected(); setCommandOpen(false); }}>Delete Selected</CommandItem>
            <CommandItem onSelect={() => { groupSelection(); setCommandOpen(false); }}>Group Selection</CommandItem>
            <CommandItem onSelect={() => { ungroupSelection(); setCommandOpen(false); }}>Ungroup Selection</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="AI">
            <CommandItem onSelect={() => { getAISuggestions(); setCommandOpen(false); }}>
              AI Suggest
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* AI Suggestions Dialog */}
      <SuggestionsDialog
        open={suggestionsDialogOpen}
        onOpenChange={setSuggestionsDialogOpen}
        suggestions={currentSuggestions}
        onAddConcept={handleAddSuggestedConcept}
        onAddConnection={handleAddSuggestedConnection}
      />

      {/* Import Notes Dialog */}
      <ImportNotesDialog
        open={importNotesOpen}
        onOpenChange={setImportNotesOpen}
        onImport={handleImportNotes}
        workspaceId={workspaceId}
      />

        {/* Canvas Version History Dialog */}
        {versionHistoryOpen && currentCanvasId && (
          <Dialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Canvas Version History</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-auto">
                <CanvasVersionHistory
                  canvasId={currentCanvasId}
                  onRestore={handleVersionRestore}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
    </div>
  );
}

// Wrapper component with ReactFlowProvider
function CanvasEditor(props: CanvasEditorProps) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner {...props} />
    </ReactFlowProvider>
  );
}

import { ErrorBoundary } from './ErrorBoundary';

export default function CanvasEditorWithBoundary(props: CanvasEditorProps) {
  return (
    <ErrorBoundary>
      <CanvasEditor {...props} />
    </ErrorBoundary>
  );
}
