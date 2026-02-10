// WebSocket connection handler

import { randomUUID } from 'crypto';
import type { WebSocket } from 'ws';
import type { FastifyBaseLogger } from 'fastify';
import type { AgentConnectionInfo, BrowserConnectionInfo, ConnectionType } from '../types/messages.js';
import {
  parseMessage,
  isHandledMessageType,
  validateAgentRegisterPayload,
  validateAgentHeartbeatPayload,
  createMessageString,
  createErrorMessage,
} from './messages.js';
import {
  handleSshCloseFromAgent,
  handleSshCloseFromBrowser,
  handleSshDataFromAgent,
  handleSshDataFromBrowser,
  handleSshResizeFromBrowser,
  handleSshSessionRequestFromBrowser,
  handleSshSessionResponseFromAgent,
  closeSessionsForAgent,
  closeSessionsForBrowser,
} from './ssh-proxy.js';
import {
  closeRdpSessionsForAgent,
  closeRdpSessionsForBrowser,
  handleRdpCloseFromAgent,
  handleRdpCloseFromBrowser,
  handleRdpDataFromAgent,
  handleRdpDataFromBrowser,
  handleRdpSessionRequestFromBrowser,
  handleRdpSessionResponseFromAgent,
} from './rdp-proxy.js';
import { setSessionSocketLookups } from '../services/session-manager.js';

// Connection maps
export const agentConnections = new Map<string, AgentConnectionInfo>();
export const browserConnections = new Map<string, BrowserConnectionInfo>();

// Keep-alive interval (30 seconds)
const PING_INTERVAL = 30000;

// Track ping intervals for cleanup
const pingIntervals = new WeakMap<WebSocket, NodeJS.Timeout>();

setSessionSocketLookups({
  getBrowserSocket: (browserId) => browserConnections.get(browserId)?.socket,
  getAgentSocket: (deviceId) => agentConnections.get(deviceId)?.socket,
});

/**
 * Handle a new WebSocket connection
 */
export function handleConnection(
  socket: WebSocket,
  connectionType: ConnectionType,
  logger: FastifyBaseLogger
): void {
  const connectedAt = Date.now();

  logger.info({ connectionType }, 'New WebSocket connection');

  // Set up ping/pong keep-alive
  setupKeepAlive(socket, logger);

  if (connectionType === 'agent') {
    handleAgentConnection(socket, connectedAt, logger);
  } else {
    handleBrowserConnection(socket, connectedAt, logger);
  }
}

/**
 * Set up ping/pong keep-alive for a connection
 */
function setupKeepAlive(socket: WebSocket, logger: FastifyBaseLogger): void {
  const interval = setInterval(() => {
    if (socket.readyState === socket.OPEN) {
      socket.ping();
    }
  }, PING_INTERVAL);

  pingIntervals.set(socket, interval);

  socket.on('pong', () => {
    logger.debug('Received pong');
  });
}

/**
 * Clean up ping interval on connection close
 */
function cleanupKeepAlive(socket: WebSocket): void {
  const interval = pingIntervals.get(socket);
  if (interval) {
    clearInterval(interval);
    pingIntervals.delete(socket);
  }
}

/**
 * Handle agent connection
 */
function handleAgentConnection(
  socket: WebSocket,
  connectedAt: number,
  logger: FastifyBaseLogger
): void {
  // Temporary storage until agent registers
  let registeredDeviceId: string | null = null;

  socket.on('message', (data: Buffer) => {
    const messageStr = data.toString();
    logger.debug({ message: messageStr }, 'Received agent message');

    const result = parseMessage(messageStr);
    if (!result.valid || !result.message) {
      logger.warn({ error: result.error }, 'Invalid message from agent');
      socket.send(createErrorMessage('INVALID_MESSAGE', result.error || 'Invalid message'));
      return;
    }

    const { type, payload } = result.message;

    if (!isHandledMessageType(type)) {
      logger.debug({ type }, 'Unhandled message type (may be for future phases)');
      return;
    }

      switch (type) {
        case 'agent:register':
          handleAgentRegister(socket, payload, connectedAt, logger, (deviceId) => {
            registeredDeviceId = deviceId;
          });
          break;

        case 'agent:heartbeat':
          handleAgentHeartbeat(socket, payload, logger);
          break;

        case 'ssh:session:response':
          handleSshSessionResponseFromAgent(payload, logger);
          break;

        case 'ssh:data':
          handleSshDataFromAgent(payload, logger);
          break;

        case 'ssh:close':
          handleSshCloseFromAgent(payload, logger);
          break;

        case 'rdp:session:response':
          handleRdpSessionResponseFromAgent(payload, logger);
          break;

        case 'rdp:data':
          handleRdpDataFromAgent(payload, logger);
          break;

        case 'rdp:close':
          handleRdpCloseFromAgent(payload, logger);
          break;

        default:
          logger.debug({ type }, 'Message type not implemented in Phase 1.3');
      }
  });

  socket.on('close', (code, reason) => {
    logger.info(
      { code, reason: reason.toString(), deviceId: registeredDeviceId },
      'Agent connection closed'
    );
    cleanupKeepAlive(socket);

    if (registeredDeviceId) {
      closeSessionsForAgent(registeredDeviceId, logger);
      closeRdpSessionsForAgent(registeredDeviceId, logger);
      agentConnections.delete(registeredDeviceId);
      logger.info({ deviceId: registeredDeviceId }, 'Agent removed from connections');
      // Notify browsers about device going offline (future: device registry)
      broadcastToBrowsers(createMessageString('devices:list:response', {
        devices: getDeviceList(),
      }));
    }
  });

  socket.on('error', (error) => {
    logger.error({ error, deviceId: registeredDeviceId }, 'Agent connection error');
  });
}

/**
 * Handle agent registration
 */
function handleAgentRegister(
  socket: WebSocket,
  payload: unknown,
  connectedAt: number,
  logger: FastifyBaseLogger,
  setDeviceId: (id: string) => void
): void {
  const validation = validateAgentRegisterPayload(payload);

  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid agent:register payload');
    socket.send(
      createMessageString('agent:register:ack', {
        success: false,
        deviceId: '',
        error: validation.error,
      })
    );
    return;
  }

  const { deviceId, deviceName, ipAddress, capabilities } = validation.data;

  // Check if device already connected
  if (agentConnections.has(deviceId)) {
    logger.warn({ deviceId }, 'Device already registered, replacing connection');
    const existing = agentConnections.get(deviceId);
    if (existing) {
      existing.socket.close(1000, 'Replaced by new connection');
    }
  }

  // Store connection
  const connectionInfo: AgentConnectionInfo = {
    socket,
    deviceId,
    deviceName,
    ipAddress,
    capabilities,
    connectedAt,
    lastHeartbeat: Date.now(),
  };

  agentConnections.set(deviceId, connectionInfo);
  setDeviceId(deviceId);

  logger.info({ deviceId, deviceName, ipAddress, capabilities }, 'Agent registered');

  // Send acknowledgment
  socket.send(
    createMessageString('agent:register:ack', {
      success: true,
      deviceId,
    })
  );

  // Notify browsers about new device
  broadcastToBrowsers(createMessageString('devices:list:response', {
    devices: getDeviceList(),
  }));
}

/**
 * Handle agent heartbeat
 */
function handleAgentHeartbeat(
  socket: WebSocket,
  payload: unknown,
  logger: FastifyBaseLogger
): void {
  const validation = validateAgentHeartbeatPayload(payload);

  if (!validation.valid || !validation.data) {
    logger.warn({ error: validation.error }, 'Invalid agent:heartbeat payload');
    return;
  }

  const { deviceId } = validation.data;
  const connection = agentConnections.get(deviceId);

  if (connection) {
    connection.lastHeartbeat = Date.now();
    logger.debug({ deviceId }, 'Agent heartbeat received');
  } else {
    logger.warn({ deviceId }, 'Heartbeat from unregistered agent');
  }

  // Send heartbeat acknowledgment
  socket.send(
    createMessageString('agent:heartbeat:ack', {
      success: true,
      timestamp: Date.now(),
    })
  );
}

/**
 * Handle browser connection
 */
function handleBrowserConnection(
  socket: WebSocket,
  connectedAt: number,
  logger: FastifyBaseLogger
): void {
  const connectionInfo: BrowserConnectionInfo = {
    id: randomUUID(),
    socket,
    connectedAt,
  };

  browserConnections.set(connectionInfo.id, connectionInfo);
  logger.info({ browserId: connectionInfo.id, totalBrowsers: browserConnections.size }, 'Browser connected');

  socket.on('message', (data: Buffer) => {
    const messageStr = data.toString();
    logger.debug({ message: messageStr }, 'Received browser message');

    const result = parseMessage(messageStr);
    if (!result.valid || !result.message) {
      logger.warn({ error: result.error }, 'Invalid message from browser');
      socket.send(createErrorMessage('INVALID_MESSAGE', result.error || 'Invalid message'));
      return;
    }

    const { type, payload } = result.message;

    if (!isHandledMessageType(type)) {
      logger.debug({ type }, 'Unhandled message type (may be for future phases)');
      return;
    }

    switch (type) {
      case 'devices:list:request':
        handleDeviceListRequest(socket, logger);
        break;

      case 'ssh:session:request':
        handleSshSessionRequestFromBrowser(payload, connectionInfo.id, socket, logger);
        break;

      case 'ssh:data':
        handleSshDataFromBrowser(payload, logger);
        break;

      case 'ssh:resize':
        handleSshResizeFromBrowser(payload, logger);
        break;

      case 'ssh:close':
        handleSshCloseFromBrowser(payload, logger);
        break;

      case 'rdp:session:request':
        handleRdpSessionRequestFromBrowser(payload, connectionInfo.id, socket, logger);
        break;

      case 'rdp:data':
        handleRdpDataFromBrowser(payload, logger);
        break;

      case 'rdp:close':
        handleRdpCloseFromBrowser(payload, logger);
        break;

      case 'error':
        logger.warn({ payload, browserId: connectionInfo.id }, 'Browser error message');
        break;

      default:
        logger.debug({ type }, 'Message type not implemented in Phase 1.3');
    }
  });

  socket.on('close', (code, reason) => {
    logger.info({ code, reason: reason.toString() }, 'Browser connection closed');
    cleanupKeepAlive(socket);
    closeSessionsForBrowser(connectionInfo.id, logger);
    closeRdpSessionsForBrowser(connectionInfo.id, logger);
    browserConnections.delete(connectionInfo.id);
    logger.info({ browserId: connectionInfo.id, totalBrowsers: browserConnections.size }, 'Browser removed from connections');
  });

  socket.on('error', (error) => {
    logger.error({ error }, 'Browser connection error');
  });
}

/**
 * Handle device list request from browser
 */
function handleDeviceListRequest(socket: WebSocket, logger: FastifyBaseLogger): void {
  const devices = getDeviceList();
  logger.debug({ deviceCount: devices.length }, 'Sending device list');

  socket.send(
    createMessageString('devices:list:response', { devices })
  );
}

function getDeviceList() {
  const devices: Array<{
    id: string;
    name: string;
    ipAddress: string;
    status: 'online' | 'offline';
    capabilities: {
      ssh: boolean;
      rdp?: boolean;
    };
  }> = [];

  for (const [deviceId, info] of agentConnections) {
    devices.push({
      id: deviceId,
      name: info.deviceName,
      ipAddress: info.ipAddress,
      status: 'online',
      capabilities: info.capabilities,
    });
  }

  return devices;
}


function broadcastToBrowsers(message: string): void {
  for (const browser of browserConnections.values()) {
    if (browser.socket.readyState === browser.socket.OPEN) {
      browser.socket.send(message);
    }
  }
}

/**
 * Get connection statistics (for debugging/monitoring)
 */
export function getConnectionStats(): {
  agentCount: number;
  browserCount: number;
  agents: Array<{ deviceId: string; deviceName: string; connectedAt: number; lastHeartbeat: number }>;
} {
  const agents: Array<{ deviceId: string; deviceName: string; connectedAt: number; lastHeartbeat: number }> = [];

  for (const [deviceId, info] of agentConnections) {
    agents.push({
      deviceId,
      deviceName: info.deviceName,
      connectedAt: info.connectedAt,
      lastHeartbeat: info.lastHeartbeat,
    });
  }

  return {
    agentCount: agentConnections.size,
    browserCount: browserConnections.size,
    agents,
  };
}
