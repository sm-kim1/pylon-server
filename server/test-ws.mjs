import WebSocket from 'ws';

const BASE_URL = 'ws://localhost:3000/ws';

async function testBrowserConnection() {
  return new Promise((resolve, reject) => {
    console.log('\n=== Test 1: Browser connection - devices:list:request ===');
    const ws = new WebSocket(`${BASE_URL}?type=browser`);
    
    ws.on('open', () => {
      console.log('Browser connected');
      ws.send(JSON.stringify({
        type: 'devices:list:request',
        timestamp: Date.now()
      }));
    });
    
    ws.on('message', (data) => {
      console.log('Browser received:', data.toString());
      ws.close();
    });
    
    ws.on('close', () => {
      console.log('Browser disconnected');
      resolve();
    });
    
    ws.on('error', (err) => {
      console.error('Browser error:', err.message);
      reject(err);
    });
    
    setTimeout(() => {
      ws.close();
      resolve();
    }, 2000);
  });
}

async function testAgentConnection() {
  return new Promise((resolve, reject) => {
    console.log('\n=== Test 2: Agent registration ===');
    const ws = new WebSocket(`${BASE_URL}?type=agent`);
    
    ws.on('open', () => {
      console.log('Agent connected');
      ws.send(JSON.stringify({
        type: 'agent:register',
        timestamp: Date.now(),
        payload: {
          deviceId: 'test-device-1',
          deviceName: 'Test Pi',
          ipAddress: '192.168.1.100',
          capabilities: { ssh: true, screenShare: true }
        }
      }));
    });
    
    ws.on('message', (data) => {
      console.log('Agent received:', data.toString());
    });
    
    ws.on('close', () => {
      console.log('Agent disconnected');
      resolve();
    });
    
    ws.on('error', (err) => {
      console.error('Agent error:', err.message);
      reject(err);
    });
    
    setTimeout(() => {
      ws.close();
      resolve();
    }, 2000);
  });
}

async function testHeartbeat() {
  return new Promise((resolve, reject) => {
    console.log('\n=== Test 3: Agent heartbeat ===');
    const ws = new WebSocket(`${BASE_URL}?type=agent`);
    let registered = false;
    
    ws.on('open', () => {
      console.log('Agent connected for heartbeat test');
      ws.send(JSON.stringify({
        type: 'agent:register',
        timestamp: Date.now(),
        payload: {
          deviceId: 'heartbeat-test-device',
          deviceName: 'Heartbeat Test',
          ipAddress: '192.168.1.101',
          capabilities: { ssh: true, screenShare: false }
        }
      }));
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('Heartbeat test received:', msg.type);
      
      if (msg.type === 'agent:register:ack' && !registered) {
        registered = true;
        ws.send(JSON.stringify({
          type: 'agent:heartbeat',
          timestamp: Date.now(),
          payload: { deviceId: 'heartbeat-test-device' }
        }));
      }
    });
    
    ws.on('close', () => {
      console.log('Heartbeat test disconnected');
      resolve();
    });
    
    ws.on('error', (err) => {
      console.error('Heartbeat error:', err.message);
      reject(err);
    });
    
    setTimeout(() => {
      ws.close();
      resolve();
    }, 2000);
  });
}

async function testInvalidMessage() {
  return new Promise((resolve, reject) => {
    console.log('\n=== Test 4: Invalid message handling ===');
    const ws = new WebSocket(`${BASE_URL}?type=browser`);
    
    ws.on('open', () => {
      console.log('Sending invalid JSON');
      ws.send('not valid json');
    });
    
    ws.on('message', (data) => {
      console.log('Error response:', data.toString());
      ws.close();
    });
    
    ws.on('close', () => {
      console.log('Invalid message test disconnected');
      resolve();
    });
    
    ws.on('error', (err) => {
      console.error('Error:', err.message);
      reject(err);
    });
    
    setTimeout(() => {
      ws.close();
      resolve();
    }, 2000);
  });
}

async function checkStats() {
  console.log('\n=== Test 5: Stats endpoint ===');
  const response = await fetch('http://localhost:3000/ws/stats');
  const stats = await response.json();
  console.log('Stats:', JSON.stringify(stats, null, 2));
}

async function main() {
  try {
    await testBrowserConnection();
    await testAgentConnection();
    await testHeartbeat();
    await testInvalidMessage();
    await checkStats();
    console.log('\n=== All tests completed ===');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

main();
