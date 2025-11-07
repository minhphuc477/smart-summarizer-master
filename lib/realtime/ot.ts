/**
 * Operational Transformation (OT) for conflict-free collaborative editing
 * Based on the Jupiter collaboration system
 */

export type Operation = 
  | { type: 'insert'; position: number; content: string; userId: string; timestamp: number }
  | { type: 'delete'; position: number; length: number; userId: string; timestamp: number }
  | { type: 'retain'; length: number };

export interface OperationResult {
  transformed: Operation;
  inverseOp: Operation | null;
}

/**
 * Transform two operations against each other (Operational Transformation)
 * Returns the transformed version of op1 that can be applied after op2
 */
export function transform(op1: Operation, op2: Operation): Operation {
  if (op1.type === 'retain' || op2.type === 'retain') {
    return op1;
  }

  // Insert vs Insert
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op1.position < op2.position) {
      return op1;
    } else if (op1.position > op2.position) {
      return {
        ...op1,
        position: op1.position + op2.content.length,
      };
    } else {
      // Same position: use timestamp to break tie
      if (op1.timestamp < op2.timestamp) {
        return op1;
      } else {
        return {
          ...op1,
          position: op1.position + op2.content.length,
        };
      }
    }
  }

  // Insert vs Delete
  if (op1.type === 'insert' && op2.type === 'delete') {
    if (op1.position <= op2.position) {
      return op1;
    } else if (op1.position > op2.position + op2.length) {
      return {
        ...op1,
        position: op1.position - op2.length,
      };
    } else {
      // Insert position is within deleted range
      return {
        ...op1,
        position: op2.position,
      };
    }
  }

  // Delete vs Insert
  if (op1.type === 'delete' && op2.type === 'insert') {
    if (op1.position < op2.position) {
      return op1;
    } else {
      return {
        ...op1,
        position: op1.position + op2.content.length,
      };
    }
  }

  // Delete vs Delete
  if (op1.type === 'delete' && op2.type === 'delete') {
    if (op1.position + op1.length <= op2.position) {
      // op1 is completely before op2
      return op1;
    } else if (op1.position >= op2.position + op2.length) {
      // op1 is completely after op2
      return {
        ...op1,
        position: op1.position - op2.length,
      };
    } else {
      // Overlapping deletes - adjust length and position
      const op1End = op1.position + op1.length;
      const op2End = op2.position + op2.length;

      if (op1.position >= op2.position && op1End <= op2End) {
        // op1 is completely contained in op2 - becomes no-op
        return {
          ...op1,
          length: 0,
        };
      } else if (op1.position < op2.position && op1End > op2End) {
        // op1 contains op2
        return {
          ...op1,
          length: op1.length - op2.length,
        };
      } else if (op1.position < op2.position) {
        // op1 starts before op2, overlaps at end
        return {
          ...op1,
          length: op2.position - op1.position,
        };
      } else {
        // op1 starts within op2, extends beyond
        return {
          ...op1,
          position: op2.position,
          length: op1End - op2End,
        };
      }
    }
  }

  return op1;
}

/**
 * Apply an operation to a document string
 */
export function apply(doc: string, operation: Operation): string {
  if (operation.type === 'retain') {
    return doc;
  }

  if (operation.type === 'insert') {
    return (
      doc.slice(0, operation.position) +
      operation.content +
      doc.slice(operation.position)
    );
  }

  if (operation.type === 'delete') {
    if (operation.length === 0) return doc;
    return (
      doc.slice(0, operation.position) +
      doc.slice(operation.position + operation.length)
    );
  }

  return doc;
}

/**
 * Compose two operations into a single operation (when possible)
 */
export function compose(op1: Operation, op2: Operation): Operation | null {
  if (op1.type === 'retain' || op2.type === 'retain') {
    return null;
  }

  // Compose adjacent inserts
  if (
    op1.type === 'insert' &&
    op2.type === 'insert' &&
    op1.position + op1.content.length === op2.position
  ) {
    return {
      type: 'insert',
      position: op1.position,
      content: op1.content + op2.content,
      userId: op1.userId,
      timestamp: Math.min(op1.timestamp, op2.timestamp),
    };
  }

  // Compose adjacent deletes
  if (
    op1.type === 'delete' &&
    op2.type === 'delete' &&
    op1.position === op2.position
  ) {
    return {
      type: 'delete',
      position: op1.position,
      length: op1.length + op2.length,
      userId: op1.userId,
      timestamp: Math.min(op1.timestamp, op2.timestamp),
    };
  }

  return null;
}

/**
 * Invert an operation (for undo functionality)
 */
export function invert(operation: Operation, doc: string): Operation | null {
  if (operation.type === 'retain') {
    return null;
  }

  if (operation.type === 'insert') {
    return {
      type: 'delete',
      position: operation.position,
      length: operation.content.length,
      userId: operation.userId,
      timestamp: operation.timestamp,
    };
  }

  if (operation.type === 'delete') {
    const deletedContent = doc.slice(
      operation.position,
      operation.position + operation.length
    );
    return {
      type: 'insert',
      position: operation.position,
      content: deletedContent,
      userId: operation.userId,
      timestamp: operation.timestamp,
    };
  }

  return null;
}

/**
 * Operational Transformation server that manages operation history
 */
export class OTServer {
  private operations: Operation[] = [];
  private documentState: string;

  constructor(initialDocument: string = '') {
    this.documentState = initialDocument;
  }

  /**
   * Receive an operation from a client and transform it against all concurrent operations
   */
  receiveOperation(operation: Operation, clientVersion: number): { operation: Operation; version: number } {
    // Transform the operation against all operations after the client's version
    let transformed = operation;
    for (let i = clientVersion; i < this.operations.length; i++) {
      transformed = transform(transformed, this.operations[i]);
    }

    // Apply the transformed operation
    this.documentState = apply(this.documentState, transformed);
    this.operations.push(transformed);

    return {
      operation: transformed,
      version: this.operations.length,
    };
  }

  /**
   * Get the current document state
   */
  getDocument(): string {
    return this.documentState;
  }

  /**
   * Get the current version (operation count)
   */
  getVersion(): number {
    return this.operations.length;
  }

  /**
   * Get operations since a specific version
   */
  getOperationsSince(version: number): Operation[] {
    return this.operations.slice(version);
  }
}

/**
 * Client-side OT manager that tracks local and remote operations
 */
export class OTClient {
  private serverVersion: number = 0;
  private pendingOperations: Operation[] = [];
  private localDocument: string;

  constructor(initialDocument: string = '') {
    this.localDocument = initialDocument;
  }

  /**
   * Apply a local operation and queue it for server
   */
  applyLocalOperation(operation: Operation): void {
    this.localDocument = apply(this.localDocument, operation);
    this.pendingOperations.push(operation);
  }

  /**
   * Receive an operation from the server
   */
  applyServerOperation(operation: Operation, version: number): void {
    // Transform pending operations against the server operation
    let transformed = operation;
    const newPending: Operation[] = [];

    for (const pending of this.pendingOperations) {
      const transformedPending = transform(pending, transformed);
      transformed = transform(transformed, pending);
      newPending.push(transformedPending);
    }

    this.pendingOperations = newPending;
    this.localDocument = apply(this.localDocument, transformed);
    this.serverVersion = version;
  }

  /**
   * Acknowledge that a local operation was applied on server
   */
  acknowledgeOperation(): void {
    if (this.pendingOperations.length > 0) {
      this.pendingOperations.shift();
      this.serverVersion++;
    }
  }

  getDocument(): string {
    return this.localDocument;
  }

  getServerVersion(): number {
    return this.serverVersion;
  }

  hasPendingOperations(): boolean {
    return this.pendingOperations.length > 0;
  }

  getPendingOperations(): Operation[] {
    return [...this.pendingOperations];
  }
}
