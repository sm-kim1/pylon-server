import Guacamole from 'guacamole-common-js';
import { getBrowserWebSocket } from '../../services/websocket';

/**
 * Build a Guacamole protocol instruction string from elements.
 * Format: length.element,length.element,...;
 */
function buildInstruction(elements: string[]): string {
  const parts = elements.map((el) => `${el.length}.${el}`);
  return parts.join(',') + ';';
}

/**
 * Stateful Guacamole protocol parser that handles data split across
 * multiple messages. Buffers incomplete instructions until the full
 * instruction (terminated by ';') is received.
 */
class GuacamoleParser {
  private buffer = '';

  feed(data: string, callback: (opcode: string, args: string[]) => void): void {
    this.buffer += data;

    while (this.buffer.length > 0) {
      const result = this.tryParseOne();
      if (!result) break; // incomplete instruction, wait for more data

      const [elements, consumed] = result;
      this.buffer = this.buffer.substring(consumed);

      if (elements.length > 0) {
        callback(elements[0], elements.slice(1));
      }
    }
  }

  private tryParseOne(): [string[], number] | null {
    let pos = 0;
    const elements: string[] = [];
    const buf = this.buffer;

    while (pos < buf.length) {
      // Read length prefix
      let lengthStr = '';
      while (pos < buf.length && buf[pos] >= '0' && buf[pos] <= '9') {
        lengthStr += buf[pos];
        pos++;
      }

      if (lengthStr.length === 0) return null; // need more data
      if (pos >= buf.length) return null; // need more data
      if (buf[pos] !== '.') return null; // malformed, but wait for more
      pos++;

      const len = parseInt(lengthStr, 10);

      // Check if we have enough data for this element
      if (pos + len > buf.length) return null; // need more data

      const value = buf.substring(pos, pos + len);
      pos += len;
      elements.push(value);

      if (pos >= buf.length) return null; // need terminator

      if (buf[pos] === ';') {
        pos++;
        return [elements, pos]; // complete instruction
      } else if (buf[pos] === ',') {
        pos++;
        // continue to next element
      } else {
        return null; // unexpected char, wait for more data
      }
    }

    return null; // incomplete
  }
}

export type DebugLogger = (msg: string) => void;

/**
 * Custom Guacamole.Tunnel implementation that relays Guacamole protocol
 * data over the Pylon WebSocket using rdp:data messages.
 */
export function createPylonTunnel(
  sessionId: string,
  debugLog?: DebugLogger
): Guacamole.Tunnel {
  const log = debugLog || (() => {});
  const tunnel = new Guacamole.Tunnel();

  let unsubscribeData: (() => void) | null = null;
  let unsubscribeClose: (() => void) | null = null;
  let dataMessageCount = 0;
  const opcodeCounts: Record<string, number> = {};

  tunnel.connect = function (data?: string): void {
    const ws = getBrowserWebSocket();
    const parser = new GuacamoleParser();

    // Subscribe to rdp:data messages for this session
    unsubscribeData = ws.on('rdp:data', (message: unknown) => {
      const msg = message as { payload?: { sessionId?: string; data?: string } };
      if (msg.payload?.sessionId !== sessionId) return;
      if (!msg.payload?.data) return;

      dataMessageCount++;
      if (dataMessageCount <= 5 || dataMessageCount % 50 === 0) {
        log(`rdp:data #${dataMessageCount} (${msg.payload.data.length} bytes)`);
      }

      // Parse guacd responses using stateful parser and dispatch
      parser.feed(msg.payload.data, (opcode, args) => {
        opcodeCounts[opcode] = (opcodeCounts[opcode] || 0) + 1;
        if (opcodeCounts[opcode] <= 3 || opcodeCounts[opcode] % 100 === 0) {
          log(`instruction: ${opcode} (count: ${opcodeCounts[opcode]}, args: ${args.length})`);
        }
        if (tunnel.oninstruction) {
          tunnel.oninstruction(opcode, args);
        }
      });
    });

    // Subscribe to rdp:close messages
    unsubscribeClose = ws.on('rdp:close', (message: unknown) => {
      const msg = message as { payload?: { sessionId?: string } };
      if (msg.payload?.sessionId !== sessionId) return;
      log('rdp:close received');
      tunnel.state = Guacamole.Tunnel.State.CLOSED;
      if (tunnel.onstatechange) {
        tunnel.onstatechange(Guacamole.Tunnel.State.CLOSED);
      }
    });

    // Parse connection params
    const params = new URLSearchParams(data || '');

    // Step 1: Send "select" for RDP protocol
    const selectInstr = buildInstruction(['select', 'rdp']);
    log(`Sending select: ${selectInstr}`);
    ws.send('rdp:data', { sessionId, data: selectInstr });

    // Save original oninstruction handler (set by Guacamole.Client)
    const origOninstruction = tunnel.oninstruction;

    // Temporary oninstruction to handle guacd handshake
    let handshakeComplete = false;
    tunnel.oninstruction = function (opcode: string, args: string[]) {
      if (!handshakeComplete && opcode === 'args') {
        handshakeComplete = true;
        log(`guacd args: ${args.slice(0, 10).join(', ')}...`);

        const width = params.get('width') || '1024';
        const height = params.get('height') || '768';
        const dpi = params.get('dpi') || '96';

        const sizeInstr = buildInstruction(['size', width, height, dpi]);
        const audioInstr = buildInstruction(['audio']);
        const videoInstr = buildInstruction(['video']);
        const imageInstr = buildInstruction(['image', 'image/png', 'image/jpeg']);

        // Build connect instruction with args in the order guacd expects
        const connectArgs = args.map((argName) => {
          // First arg is the guacd protocol version - echo it back
          if (argName.startsWith('VERSION_')) return argName;
          return params.get(argName) || '';
        });
        const connectInstr = buildInstruction(['connect', ...connectArgs]);

        const handshakeData = sizeInstr + audioInstr + videoInstr + imageInstr + connectInstr;
        log(`Sending handshake (${handshakeData.length} bytes)`);
        ws.send('rdp:data', { sessionId, data: handshakeData });

        // Restore original oninstruction handler
        tunnel.oninstruction = origOninstruction;
        log(`Restored origOninstruction: ${typeof origOninstruction}`);

        // Mark tunnel as open
        tunnel.state = Guacamole.Tunnel.State.OPEN;
        if (tunnel.onstatechange) {
          tunnel.onstatechange(Guacamole.Tunnel.State.OPEN);
        }
        return;
      }

      // Pass through to original handler if set
      if (origOninstruction) {
        origOninstruction(opcode, args);
      }
    };
  };

  tunnel.sendMessage = function (...elements: unknown[]): void {
    const instruction = buildInstruction(elements.map(String));
    const ws = getBrowserWebSocket();
    ws.send('rdp:data', { sessionId, data: instruction });
  };

  tunnel.disconnect = function (): void {
    log(`Tunnel disconnect. Total data msgs: ${dataMessageCount}, opcodes: ${JSON.stringify(opcodeCounts)}`);
    if (unsubscribeData) {
      unsubscribeData();
      unsubscribeData = null;
    }
    if (unsubscribeClose) {
      unsubscribeClose();
      unsubscribeClose = null;
    }

    const ws = getBrowserWebSocket();
    ws.send('rdp:close', { sessionId, reason: 'Client disconnect' });

    tunnel.state = Guacamole.Tunnel.State.CLOSED;
    if (tunnel.onstatechange) {
      tunnel.onstatechange(Guacamole.Tunnel.State.CLOSED);
    }
  };

  return tunnel;
}
