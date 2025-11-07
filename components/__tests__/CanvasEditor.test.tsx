import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CanvasEditor from '@/components/CanvasEditor';
import React from 'react';

// Mock dropdown menu components to render content immediately
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div onClick={onClick}>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
}));

// Mock reactflow heavy components/hooks
jest.mock('reactflow', () => {
  const React = require('react');
  const Pass = ({ children }: any) => <div data-testid="reactflow">{children}</div>;
  const useNodesState = (initial: any[]) => {
    const [nodes, setNodes] = React.useState(initial);
    const onNodesChange = jest.fn();
    return [nodes, setNodes, onNodesChange] as const;
  };
  const useEdgesState = (initial: any[]) => {
    const [edges, setEdges] = React.useState(initial);
    const onEdgesChange = jest.fn();
    return [edges, setEdges, onEdgesChange] as const;
  };
  const ReactFlowProvider = ({ children }: any) => <>{children}</>;
  return {
    __esModule: true,
    default: Pass,
    Controls: () => <div data-testid="controls" />,
    Background: () => <div data-testid="background" />,
    MiniMap: () => <div data-testid="minimap" />,
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    useReactFlow: () => ({ fitView: jest.fn() }),
    addEdge: (conn: any, eds: any[]) => [...eds, { id: 'e1', ...conn }],
    BackgroundVariant: { Dots: 'dots' },
  };
});

// Mock URL and anchor for export
beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => 'blob:url') as typeof URL.createObjectURL;
  global.URL.revokeObjectURL = jest.fn() as typeof URL.revokeObjectURL;
});

describe('CanvasEditor', () => {
  beforeEach(() => {
    // Default: create new canvas flow
    global.fetch = jest.fn()
      // POST /api/canvases
      .mockResolvedValueOnce({ ok: true, json: async () => ({ canvas: { id: 'c1' } }) })
      // PATCH /api/canvases/c1
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('adds a sticky note and updates node count', () => {
    render(<CanvasEditor workspaceId="w1" />);

    expect(screen.getByText('0 nodes')).toBeInTheDocument();

    // Open the Add Node menu and click on "Sticky Note" (menu renders immediately via mock)
    fireEvent.click(screen.getByText('Sticky Note'));

    expect(screen.getByText('1 nodes')).toBeInTheDocument();
  });

  it('saves a new canvas and calls onSave', async () => {
    const onSave = jest.fn();
    render(<CanvasEditor workspaceId="w1" onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    // Expect both POST and PATCH were called
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onSave).toHaveBeenCalled();
  });

  it('exports canvas as JSON', () => {
    const clickSpy = jest.spyOn(document, 'createElement');
    render(<CanvasEditor workspaceId="w1" />);

    // Click "Export as JSON" option (dropdown is mocked to render immediately)
    const jsonOption = screen.getByText('Export as JSON');
    fireEvent.click(jsonOption);

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledWith('a');
  });
});
