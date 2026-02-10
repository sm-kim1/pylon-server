import type { FastifyBaseLogger } from 'fastify';
import type { WebSocket } from 'ws';
import {
  createErrorMessage,
  createMessageString,
  validateRdpClosePayload,
  validateRdpDataPayload,
  validateRdpSessionRequestPayload,
  validateRdpSessionResponsePayload,
} from './messages.js';
import {
  closeRDPSession,
  createRDPSession,
  getRDPSession,
  getRDPSessionsByBrowser,
  getRDPSessionsByDevice,
} from '../services/session-manager.js';

function sendIfOpen(socket: WebSocket, message: string): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(message);
  }
}

export function handleRdpSessionRequestFromBrowser(
  payload: unknown,
  browserId: string,
  browserSocket: WebSocket,
  logger: FastifyBaseLogger
): void {
  const validation = validateRdpSessionRequestPayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error, browserId }, 'Invalid rdp:session:request payload');
    sendIfOpen(browserSocket, createErrorMessage('INVALID_RDP_SESSION_REQUEST', validation.error || 'Invalid payload'));
    return;
  }

  let session;
  try {
    session = createRDPSession(validation.data.deviceId, browserId, validation.data.sessionId);
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : 'Unknown error', browserId },
      'Failed to create RDP session'
    );
    sendIfOpen(browserSocket, createErrorMessage('RDP_SESSION_CREATE_FAILED', 'Unable to create RDP session'));
    return;
  }

  logger.info(
    { sessionId: session.id, deviceId: session.deviceId, browserId },
    'RDP session requested'
  );

  if (session.agentSocket.readyState !== session.agentSocket.OPEN) {
    logger.warn(
      { sessionId: session.id, deviceId: session.deviceId },
      'Agent socket not open for RDP session request'
    );
    closeRDPSession(session.id, 'Agent socket not open');
    sendIfOpen(browserSocket, createErrorMessage('RDP_AGENT_UNAVAILABLE', 'Agent is not available'));
    return;
  }

  sendIfOpen(
    session.agentSocket,
    createMessageString('rdp:session:request', {
      deviceId: session.deviceId,
      sessionId: session.id,
    })
  );
}

export function handleRdpSessionResponseFromAgent(
  payload: unknown,
  logger: FastifyBaseLogger
): void {
  const validation = validateRdpSessionResponsePayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid rdp:session:response payload');
    return;
  }

  const session = getRDPSession(validation.data.sessionId);
  if (!session) {
    logger.warn({ sessionId: validation.data.sessionId }, 'RDP session not found for response');
    return;
  }

  if (validation.data.success) {
    session.status = 'active';
    logger.info(
      { sessionId: session.id, deviceId: session.deviceId },
      'RDP session established'
    );
  } else {
    session.status = 'closed';
    logger.warn(
      { sessionId: session.id, deviceId: session.deviceId, error: validation.data.error },
      'RDP session rejected by agent'
    );
    closeRDPSession(session.id, validation.data.error);
  }

  sendIfOpen(
    session.browserSocket,
    createMessageString('rdp:session:response', {
      sessionId: session.id,
      success: validation.data.success,
      ...(validation.data.error !== undefined && { error: validation.data.error }),
    })
  );
}

export function handleRdpDataFromBrowser(payload: unknown, logger: FastifyBaseLogger): void {
  const validation = validateRdpDataPayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid rdp:data payload from browser');
    return;
  }

  const session = getRDPSession(validation.data.sessionId);
  if (!session) {
    logger.warn({ sessionId: validation.data.sessionId }, 'RDP session not found for browser data');
    return;
  }

  sendIfOpen(
    session.agentSocket,
    createMessageString('rdp:data', {
      sessionId: session.id,
      data: validation.data.data,
    })
  );

  logger.debug(
    { sessionId: session.id, bytes: validation.data.data.length },
    'Relayed RDP data from browser to agent'
  );
}

export function handleRdpDataFromAgent(payload: unknown, logger: FastifyBaseLogger): void {
  const validation = validateRdpDataPayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid rdp:data payload from agent');
    return;
  }

  const session = getRDPSession(validation.data.sessionId);
  if (!session) {
    logger.warn({ sessionId: validation.data.sessionId }, 'RDP session not found for agent data');
    return;
  }

  sendIfOpen(
    session.browserSocket,
    createMessageString('rdp:data', {
      sessionId: session.id,
      data: validation.data.data,
    })
  );

  logger.debug(
    { sessionId: session.id, bytes: validation.data.data.length },
    'Relayed RDP data from agent to browser'
  );
}

export function handleRdpCloseFromBrowser(payload: unknown, logger: FastifyBaseLogger): void {
  handleRdpClose(payload, 'browser', logger);
}

export function handleRdpCloseFromAgent(payload: unknown, logger: FastifyBaseLogger): void {
  handleRdpClose(payload, 'agent', logger);
}

function handleRdpClose(payload: unknown, source: 'browser' | 'agent', logger: FastifyBaseLogger): void {
  const validation = validateRdpClosePayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid rdp:close payload');
    return;
  }

  const session = getRDPSession(validation.data.sessionId);
  if (!session) {
    logger.warn({ sessionId: validation.data.sessionId }, 'RDP session not found for close');
    return;
  }

  const reason = validation.data.reason ?? 'Session closed';
  closeRDPSession(session.id, reason);

  const targetSocket = source === 'browser' ? session.agentSocket : session.browserSocket;
  sendIfOpen(
    targetSocket,
    createMessageString('rdp:close', {
      sessionId: session.id,
      reason,
    })
  );

  logger.info(
    { sessionId: session.id, source, reason },
    'RDP session closed'
  );
}

export function closeRdpSessionsForBrowser(
  browserId: string,
  logger: FastifyBaseLogger
): void {
  const sessions = getRDPSessionsByBrowser(browserId);
  for (const session of sessions) {
    closeRDPSession(session.id, 'Browser disconnected');
    sendIfOpen(
      session.agentSocket,
      createMessageString('rdp:close', {
        sessionId: session.id,
        reason: 'Browser disconnected',
      })
    );
    logger.info(
      { sessionId: session.id, deviceId: session.deviceId, browserId },
      'RDP session closed due to browser disconnect'
    );
  }
}

export function closeRdpSessionsForAgent(
  deviceId: string,
  logger: FastifyBaseLogger
): void {
  const sessions = getRDPSessionsByDevice(deviceId);
  for (const session of sessions) {
    closeRDPSession(session.id, 'Agent disconnected');
    sendIfOpen(
      session.browserSocket,
      createMessageString('rdp:close', {
        sessionId: session.id,
        reason: 'Agent disconnected',
      })
    );
    logger.info(
      { sessionId: session.id, deviceId },
      'RDP session closed due to agent disconnect'
    );
  }
}
