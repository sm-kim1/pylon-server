// Message parsing and validation for WebSocket messages

import type { ParsedMessage, ValidationResult } from '../types/messages.js';

const VALID_MESSAGE_TYPES = new Set([
  'agent:register',
  'agent:heartbeat',
  'devices:list:request',
  'ssh:session:request',
  'ssh:session:response',
  'ssh:data',
  'ssh:resize',
  'ssh:close',
  'rdp:session:request',
  'rdp:session:response',
  'rdp:data',
  'rdp:close',
  'error',
]);

/**
 * Parse a raw WebSocket message into a structured format
 */
export function parseMessage(data: string): ValidationResult {
  try {
    const parsed = JSON.parse(data) as unknown;

    if (!isValidMessageStructure(parsed)) {
      return {
        valid: false,
        error: 'Invalid message structure: must have type (string) and timestamp (number)',
      };
    }

    return {
      valid: true,
      message: parsed as ParsedMessage,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if the parsed object has valid message structure
 */
function isValidMessageStructure(obj: unknown): obj is ParsedMessage {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const message = obj as Record<string, unknown>;

  if (typeof message.type !== 'string' || message.type.length === 0) {
    return false;
  }

  if (typeof message.timestamp !== 'number' || !Number.isFinite(message.timestamp)) {
    return false;
  }

  return true;
}

/**
 * Validate that a message type is one we handle in Phase 2.1
 */
export function isHandledMessageType(type: string): boolean {
  return VALID_MESSAGE_TYPES.has(type);
}

export function validateAgentRegisterPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: {
    deviceId: string;
    deviceName: string;
    ipAddress: string;
    capabilities: {
      ssh: boolean;
      rdp?: boolean;
    };
  };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.deviceId !== 'string' || p.deviceId.length === 0) {
    return { valid: false, error: 'deviceId must be a non-empty string' };
  }

  if (typeof p.deviceName !== 'string' || p.deviceName.length === 0) {
    return { valid: false, error: 'deviceName must be a non-empty string' };
  }

  if (typeof p.ipAddress !== 'string' || p.ipAddress.length === 0) {
    return { valid: false, error: 'ipAddress must be a non-empty string' };
  }

  if (typeof p.capabilities !== 'object' || p.capabilities === null) {
    return { valid: false, error: 'capabilities must be an object' };
  }

  const caps = p.capabilities as Record<string, unknown>;
  if (typeof caps.ssh !== 'boolean') {
    return { valid: false, error: 'capabilities.ssh must be a boolean' };
  }

  const capabilities: {
    ssh: boolean;
    rdp?: boolean;
  } = {
    ssh: caps.ssh,
  };

  if (typeof caps.rdp === 'boolean') {
    capabilities.rdp = caps.rdp;
  }

  return {
    valid: true,
    data: {
      deviceId: p.deviceId,
      deviceName: p.deviceName,
      ipAddress: p.ipAddress,
      capabilities,
    },
  };
}

/**
 * Validate agent:heartbeat message payload
 */
export function validateAgentHeartbeatPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { deviceId: string };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.deviceId !== 'string' || p.deviceId.length === 0) {
    return { valid: false, error: 'deviceId must be a non-empty string' };
  }

  return {
    valid: true,
    data: { deviceId: p.deviceId },
  };
}

/**
 * Create a JSON message string for sending
 */
export function createMessageString(type: string, payload?: unknown): string {
  const message = {
    type,
    timestamp: Date.now(),
    ...(payload !== undefined && { payload }),
  };
  return JSON.stringify(message);
}

/**
 * Create an error message string
 */
export function createErrorMessage(code: string, message: string, details?: Record<string, unknown>): string {
  return createMessageString('error', { code, message, details });
}

export function validateSshSessionRequestPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { deviceId: string; sessionId: string };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.deviceId !== 'string' || p.deviceId.length === 0) {
    return { valid: false, error: 'deviceId must be a non-empty string' };
  }

  if (typeof p.sessionId !== 'string' || p.sessionId.length === 0) {
    return { valid: false, error: 'sessionId must be a non-empty string' };
  }

  return {
    valid: true,
    data: { deviceId: p.deviceId, sessionId: p.sessionId },
  };
}

export function validateSshSessionResponsePayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { sessionId: string; success: boolean; error?: string };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== 'string' || p.sessionId.length === 0) {
    return { valid: false, error: 'sessionId must be a non-empty string' };
  }

  if (typeof p.success !== 'boolean') {
    return { valid: false, error: 'success must be a boolean' };
  }

  if (p.error !== undefined && typeof p.error !== 'string') {
    return { valid: false, error: 'error must be a string when provided' };
  }

  return {
    valid: true,
    data: {
      sessionId: p.sessionId,
      success: p.success,
      ...(p.error !== undefined && { error: p.error }),
    },
  };
}

export function validateSshDataPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { sessionId: string; data: string };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== 'string' || p.sessionId.length === 0) {
    return { valid: false, error: 'sessionId must be a non-empty string' };
  }

  if (typeof p.data !== 'string') {
    return { valid: false, error: 'data must be a string' };
  }

  return {
    valid: true,
    data: {
      sessionId: p.sessionId,
      data: p.data,
    },
  };
}

export function validateSshResizePayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { sessionId: string; cols: number; rows: number };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== 'string' || p.sessionId.length === 0) {
    return { valid: false, error: 'sessionId must be a non-empty string' };
  }

  if (typeof p.cols !== 'number' || !Number.isFinite(p.cols)) {
    return { valid: false, error: 'cols must be a number' };
  }

  if (typeof p.rows !== 'number' || !Number.isFinite(p.rows)) {
    return { valid: false, error: 'rows must be a number' };
  }

  return {
    valid: true,
    data: {
      sessionId: p.sessionId,
      cols: p.cols,
      rows: p.rows,
    },
  };
}

export function validateSshClosePayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { sessionId: string; reason?: string };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== 'string' || p.sessionId.length === 0) {
    return { valid: false, error: 'sessionId must be a non-empty string' };
  }

  if (p.reason !== undefined && typeof p.reason !== 'string') {
    return { valid: false, error: 'reason must be a string when provided' };
  }

  return {
    valid: true,
    data: {
      sessionId: p.sessionId,
      ...(p.reason !== undefined && { reason: p.reason }),
    },
  };
}

export function validateRdpSessionRequestPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { deviceId: string; sessionId: string };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.deviceId !== 'string' || p.deviceId.length === 0) {
    return { valid: false, error: 'deviceId must be a non-empty string' };
  }

  if (typeof p.sessionId !== 'string' || p.sessionId.length === 0) {
    return { valid: false, error: 'sessionId must be a non-empty string' };
  }

  return {
    valid: true,
    data: { deviceId: p.deviceId, sessionId: p.sessionId },
  };
}

export function validateRdpSessionResponsePayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { sessionId: string; success: boolean; error?: string };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== 'string' || p.sessionId.length === 0) {
    return { valid: false, error: 'sessionId must be a non-empty string' };
  }

  if (typeof p.success !== 'boolean') {
    return { valid: false, error: 'success must be a boolean' };
  }

  if (p.error !== undefined && typeof p.error !== 'string') {
    return { valid: false, error: 'error must be a string when provided' };
  }

  return {
    valid: true,
    data: {
      sessionId: p.sessionId,
      success: p.success,
      ...(p.error !== undefined && { error: p.error }),
    },
  };
}

export function validateRdpDataPayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { sessionId: string; data: string };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== 'string' || p.sessionId.length === 0) {
    return { valid: false, error: 'sessionId must be a non-empty string' };
  }

  if (typeof p.data !== 'string') {
    return { valid: false, error: 'data must be a string' };
  }

  return {
    valid: true,
    data: {
      sessionId: p.sessionId,
      data: p.data,
    },
  };
}

export function validateRdpClosePayload(payload: unknown): {
  valid: boolean;
  error?: string;
  data?: { sessionId: string; reason?: string };
} {
  if (typeof payload !== 'object' || payload === null) {
    return { valid: false, error: 'Payload must be an object' };
  }

  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== 'string' || p.sessionId.length === 0) {
    return { valid: false, error: 'sessionId must be a non-empty string' };
  }

  if (p.reason !== undefined && typeof p.reason !== 'string') {
    return { valid: false, error: 'reason must be a string when provided' };
  }

  return {
    valid: true,
    data: {
      sessionId: p.sessionId,
      ...(p.reason !== undefined && { reason: p.reason }),
    },
  };
}
