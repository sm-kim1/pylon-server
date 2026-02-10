import { randomUUID } from 'crypto';
import type { WebSocket } from 'ws';
import type { SSHSession, RDPSession } from '../types/session.js';

type SocketLookup = (id: string) => WebSocket | undefined;

const sessions = new Map<string, SSHSession>();
const sessionsByBrowser = new Map<string, Set<string>>();
const sessionsByDevice = new Map<string, Set<string>>();
const rdpSessions = new Map<string, RDPSession>();
const rdpSessionsByBrowser = new Map<string, Set<string>>();
const rdpSessionsByDevice = new Map<string, Set<string>>();
let browserSocketLookup: SocketLookup | null = null;
let agentSocketLookup: SocketLookup | null = null;

export function setSessionSocketLookups(lookups: {
  getBrowserSocket: SocketLookup;
  getAgentSocket: SocketLookup;
}): void {
  browserSocketLookup = lookups.getBrowserSocket;
  agentSocketLookup = lookups.getAgentSocket;
}

export function getBrowserSocket(browserId: string): WebSocket | undefined {
  return browserSocketLookup?.(browserId);
}

export function getAgentSocket(deviceId: string): WebSocket | undefined {
  return agentSocketLookup?.(deviceId);
}

export function createSession(deviceId: string, browserId: string, sessionId?: string): SSHSession {
  if (!browserSocketLookup || !agentSocketLookup) {
    throw new Error('Session socket lookups are not configured');
  }

  const browserSocket = browserSocketLookup(browserId);
  if (!browserSocket) {
    throw new Error(`Browser socket not found for browserId ${browserId}`);
  }

  const agentSocket = agentSocketLookup(deviceId);
  if (!agentSocket) {
    throw new Error(`Agent socket not found for deviceId ${deviceId}`);
  }

  const id = sessionId ?? randomUUID();
  if (sessions.has(id)) {
    throw new Error(`SSH session already exists for sessionId ${id}`);
  }

  const session: SSHSession = {
    id,
    deviceId,
    browserSocket,
    agentSocket,
    status: 'connecting',
    createdAt: new Date(),
    terminalSize: {
      cols: 80,
      rows: 24,
    },
  };

  sessions.set(session.id, session);
  if (!sessionsByBrowser.has(browserId)) {
    sessionsByBrowser.set(browserId, new Set());
  }
  sessionsByBrowser.get(browserId)?.add(session.id);

  if (!sessionsByDevice.has(deviceId)) {
    sessionsByDevice.set(deviceId, new Set());
  }
  sessionsByDevice.get(deviceId)?.add(session.id);
  return session;
}

export function getSession(sessionId: string): SSHSession | undefined {
  return sessions.get(sessionId);
}

export function closeSession(sessionId: string, reason?: string): void {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  session.status = 'closed';
  sessions.delete(sessionId);
  if (reason) {
    void reason;
  }

  for (const [browserId, ids] of sessionsByBrowser) {
    if (ids.delete(sessionId) && ids.size === 0) {
      sessionsByBrowser.delete(browserId);
      break;
    }
  }

  for (const [deviceId, ids] of sessionsByDevice) {
    if (ids.delete(sessionId) && ids.size === 0) {
      sessionsByDevice.delete(deviceId);
      break;
    }
  }
}

export function getSessionsByDevice(deviceId: string): SSHSession[] {
  const ids = sessionsByDevice.get(deviceId);
  if (!ids) {
    return [];
  }
  const results: SSHSession[] = [];
  for (const id of ids) {
    const session = sessions.get(id);
    if (session) {
      results.push(session);
    }
  }
  return results;
}

export function getSessionsByBrowser(browserId: string): SSHSession[] {
  const ids = sessionsByBrowser.get(browserId);
  if (!ids) {
    return [];
  }
  const results: SSHSession[] = [];
  for (const id of ids) {
    const session = sessions.get(id);
    if (session) {
      results.push(session);
    }
  }
  return results;
}

export function createRDPSession(
  deviceId: string,
  browserId: string,
  sessionId?: string
): RDPSession {
  if (!browserSocketLookup || !agentSocketLookup) {
    throw new Error('Session socket lookups are not configured');
  }

  const browserSocket = browserSocketLookup(browserId);
  if (!browserSocket) {
    throw new Error(`Browser socket not found for browserId ${browserId}`);
  }

  const agentSocket = agentSocketLookup(deviceId);
  if (!agentSocket) {
    throw new Error(`Agent socket not found for deviceId ${deviceId}`);
  }

  const id = sessionId ?? randomUUID();
  if (rdpSessions.has(id)) {
    throw new Error(`RDP session already exists for sessionId ${id}`);
  }

  const session: RDPSession = {
    id,
    deviceId,
    browserSocket,
    agentSocket,
    status: 'connecting',
    createdAt: new Date(),
  };

  rdpSessions.set(session.id, session);
  if (!rdpSessionsByBrowser.has(browserId)) {
    rdpSessionsByBrowser.set(browserId, new Set());
  }
  rdpSessionsByBrowser.get(browserId)?.add(session.id);

  if (!rdpSessionsByDevice.has(deviceId)) {
    rdpSessionsByDevice.set(deviceId, new Set());
  }
  rdpSessionsByDevice.get(deviceId)?.add(session.id);
  return session;
}

export function getRDPSession(sessionId: string): RDPSession | undefined {
  return rdpSessions.get(sessionId);
}

export function closeRDPSession(sessionId: string, reason?: string): void {
  const session = rdpSessions.get(sessionId);
  if (!session) {
    return;
  }

  session.status = 'closed';
  rdpSessions.delete(sessionId);
  if (reason) {
    void reason;
  }

  for (const [browserId, ids] of rdpSessionsByBrowser) {
    if (ids.delete(sessionId) && ids.size === 0) {
      rdpSessionsByBrowser.delete(browserId);
      break;
    }
  }

  for (const [deviceId, ids] of rdpSessionsByDevice) {
    if (ids.delete(sessionId) && ids.size === 0) {
      rdpSessionsByDevice.delete(deviceId);
      break;
    }
  }
}

export function getRDPSessionsByDevice(deviceId: string): RDPSession[] {
  const ids = rdpSessionsByDevice.get(deviceId);
  if (!ids) {
    return [];
  }
  const results: RDPSession[] = [];
  for (const id of ids) {
    const session = rdpSessions.get(id);
    if (session) {
      results.push(session);
    }
  }
  return results;
}

export function getRDPSessionsByBrowser(browserId: string): RDPSession[] {
  const ids = rdpSessionsByBrowser.get(browserId);
  if (!ids) {
    return [];
  }
  const results: RDPSession[] = [];
  for (const id of ids) {
    const session = rdpSessions.get(id);
    if (session) {
      results.push(session);
    }
  }
  return results;
}
