import type { FastifyBaseLogger } from 'fastify';
import type { WebSocket } from 'ws';
import {
  createErrorMessage,
  createMessageString,
  validateSshClosePayload,
  validateSshDataPayload,
  validateSshResizePayload,
  validateSshSessionRequestPayload,
  validateSshSessionResponsePayload,
} from './messages.js';
import {
  closeSession,
  createSession,
  getSession,
  getSessionsByBrowser,
  getSessionsByDevice,
} from '../services/session-manager.js';

function sendIfOpen(socket: WebSocket, message: string): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(message);
  }
}

export function handleSshSessionRequestFromBrowser(
  payload: unknown,
  browserId: string,
  browserSocket: WebSocket,
  logger: FastifyBaseLogger
): void {
  const validation = validateSshSessionRequestPayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error, browserId }, 'Invalid ssh:session:request payload');
    sendIfOpen(browserSocket, createErrorMessage('INVALID_SSH_SESSION_REQUEST', validation.error || 'Invalid payload'));
    return;
  }

  let session;
  try {
    session = createSession(validation.data.deviceId, browserId, validation.data.sessionId);
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : 'Unknown error', browserId },
      'Failed to create SSH session'
    );
    sendIfOpen(browserSocket, createErrorMessage('SSH_SESSION_CREATE_FAILED', 'Unable to create SSH session'));
    return;
  }

  logger.info(
    { sessionId: session.id, deviceId: session.deviceId, browserId },
    'SSH session requested'
  );

  if (session.agentSocket.readyState !== session.agentSocket.OPEN) {
    logger.warn(
      { sessionId: session.id, deviceId: session.deviceId },
      'Agent socket not open for SSH session request'
    );
    closeSession(session.id, 'Agent socket not open');
    sendIfOpen(browserSocket, createErrorMessage('SSH_AGENT_UNAVAILABLE', 'Agent is not available'));
    return;
  }

  sendIfOpen(
    session.agentSocket,
    createMessageString('ssh:session:request', {
      deviceId: session.deviceId,
      sessionId: session.id,
    })
  );
}

export function handleSshSessionResponseFromAgent(
  payload: unknown,
  logger: FastifyBaseLogger
): void {
  const validation = validateSshSessionResponsePayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid ssh:session:response payload');
    return;
  }

  const session = getSession(validation.data.sessionId);
  if (!session) {
    logger.warn({ sessionId: validation.data.sessionId }, 'SSH session not found for response');
    return;
  }

  if (validation.data.success) {
    session.status = 'active';
    logger.info(
      { sessionId: session.id, deviceId: session.deviceId },
      'SSH session established'
    );
  } else {
    session.status = 'closed';
    logger.warn(
      { sessionId: session.id, deviceId: session.deviceId, error: validation.data.error },
      'SSH session rejected by agent'
    );
    closeSession(session.id, validation.data.error);
  }

  sendIfOpen(
    session.browserSocket,
    createMessageString('ssh:session:response', {
      sessionId: session.id,
      success: validation.data.success,
      ...(validation.data.error !== undefined && { error: validation.data.error }),
    })
  );
}

export function handleSshDataFromBrowser(payload: unknown, logger: FastifyBaseLogger): void {
  const validation = validateSshDataPayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid ssh:data payload from browser');
    return;
  }

  const session = getSession(validation.data.sessionId);
  if (!session) {
    logger.warn({ sessionId: validation.data.sessionId }, 'SSH session not found for browser data');
    return;
  }

  sendIfOpen(
    session.agentSocket,
    createMessageString('ssh:data', {
      sessionId: session.id,
      data: validation.data.data,
    })
  );

  logger.debug(
    { sessionId: session.id, bytes: validation.data.data.length },
    'Relayed SSH data from browser to agent'
  );
}

export function handleSshDataFromAgent(payload: unknown, logger: FastifyBaseLogger): void {
  const validation = validateSshDataPayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid ssh:data payload from agent');
    return;
  }

  const session = getSession(validation.data.sessionId);
  if (!session) {
    logger.warn({ sessionId: validation.data.sessionId }, 'SSH session not found for agent data');
    return;
  }

  sendIfOpen(
    session.browserSocket,
    createMessageString('ssh:data', {
      sessionId: session.id,
      data: validation.data.data,
    })
  );

  logger.debug(
    { sessionId: session.id, bytes: validation.data.data.length },
    'Relayed SSH data from agent to browser'
  );
}

export function handleSshResizeFromBrowser(payload: unknown, logger: FastifyBaseLogger): void {
  const validation = validateSshResizePayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid ssh:resize payload');
    return;
  }

  const session = getSession(validation.data.sessionId);
  if (!session) {
    logger.warn({ sessionId: validation.data.sessionId }, 'SSH session not found for resize');
    return;
  }

  session.terminalSize = {
    cols: validation.data.cols,
    rows: validation.data.rows,
  };

  sendIfOpen(
    session.agentSocket,
    createMessageString('ssh:resize', {
      sessionId: session.id,
      cols: validation.data.cols,
      rows: validation.data.rows,
    })
  );

  logger.info(
    { sessionId: session.id, cols: validation.data.cols, rows: validation.data.rows },
    'SSH terminal resized'
  );
}

export function handleSshCloseFromBrowser(payload: unknown, logger: FastifyBaseLogger): void {
  handleSshClose(payload, 'browser', logger);
}

export function handleSshCloseFromAgent(payload: unknown, logger: FastifyBaseLogger): void {
  handleSshClose(payload, 'agent', logger);
}

function handleSshClose(payload: unknown, source: 'browser' | 'agent', logger: FastifyBaseLogger): void {
  const validation = validateSshClosePayload(payload);
  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid ssh:close payload');
    return;
  }

  const session = getSession(validation.data.sessionId);
  if (!session) {
    logger.warn({ sessionId: validation.data.sessionId }, 'SSH session not found for close');
    return;
  }

  const reason = validation.data.reason ?? 'Session closed';
  closeSession(session.id, reason);

  const targetSocket = source === 'browser' ? session.agentSocket : session.browserSocket;
  sendIfOpen(
    targetSocket,
    createMessageString('ssh:close', {
      sessionId: session.id,
      reason,
    })
  );

  logger.info(
    { sessionId: session.id, source, reason },
    'SSH session closed'
  );
}

export function closeSessionsForBrowser(
  browserId: string,
  logger: FastifyBaseLogger
): void {
  const sessions = getSessionsByBrowser(browserId);
  for (const session of sessions) {
    closeSession(session.id, 'Browser disconnected');
    sendIfOpen(
      session.agentSocket,
      createMessageString('ssh:close', {
        sessionId: session.id,
        reason: 'Browser disconnected',
      })
    );
    logger.info(
      { sessionId: session.id, deviceId: session.deviceId, browserId },
      'SSH session closed due to browser disconnect'
    );
  }
}

export function closeSessionsForAgent(
  deviceId: string,
  logger: FastifyBaseLogger
): void {
  const sessions = getSessionsByDevice(deviceId);
  for (const session of sessions) {
    closeSession(session.id, 'Agent disconnected');
    sendIfOpen(
      session.browserSocket,
      createMessageString('ssh:close', {
        sessionId: session.id,
        reason: 'Agent disconnected',
      })
    );
    logger.info(
      { sessionId: session.id, deviceId },
      'SSH session closed due to agent disconnect'
    );
  }
}
