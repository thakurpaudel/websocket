const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

let clients = {};
let deviceStatus = {}; // To store status of each device
let web_client_id = {};
let test_true=false;

wss.on('connection', (ws) => {
    ws.id = generateUniqueID();
    ws.isWebClient = false;  // Flag to differentiate web clients from devices
    ws.selectedDeviceId = null; // To track selected device for each web client
    ws.isAlive = true; // Heartbeat flag
    clients[ws.id] = ws;
    

    console.log(`Client connected: ${ws.id}`);

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);

            if (parsedMessage.device_id && !ws.device_id) {
                ws.device_id = parsedMessage.device_id;
                deviceStatus[ws.device_id] = { id: ws.id, gunConnected: false, charging: false, status: 'Online' };
                console.log(`Device connected: ${ws.device_id} (${ws.id})`);
                for (const id in web_client_id) {
                    if(web_client_id[id] === ws.id){
                        test_true = true;
                        console.log("from the same web client");
                    }
                }
                if(!test_true){
                updateClientList();
                test_true =false;
                console.log("from the different web client");
                }
            } else if (parsedMessage.type === 'webClient') {
                ws.isWebClient = true;
                console.log(`Web client connected: ${ws.id}`);
                //ws.send(JSON.stringify({ type: 'updateClientList', clientList: getClientList() }));
                web_client_id[ws.id] =ws.id;
            } else if (parsedMessage.msg) {
                if (parsedMessage.targetId) {
                    sendMessageToClient(parsedMessage.targetId, parsedMessage.msg, ws.device_id || ws.id);
                } else if (ws.id) {
                    displayMessageOnWebPage(ws.id, parsedMessage.msg);
                    updateDeviceStatus (ws.device_id, parsedMessage.msg); // Update device status based on message
                }
            } else if (parsedMessage.type === 'selectDevice') {
                ws.selectedDeviceId = parsedMessage.device_id;  // Store selected device ID in the web client connection
                console.log(`Device selected: ${ws.selectedDeviceId} by Web Client: ${ws.id}`);
            }
        } catch (e) {
            console.log(`Error processing message from ${ws.id}:`, e.message);
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });

    ws.on('error', (error) => {
        console.log(`WebSocket error from client ${ws.id}: ${error.message}`);
        handleDisconnect(ws);
    });
});

const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            return handleDisconnect(ws);
        }

        ws.isAlive = false;
        ws.ping(() => {});
    });
}, 10000); // Adjust the interval as needed

function handleDisconnect(ws) {
    console.log(`Client disconnected: ${ws.id}`);
    if (ws.isWebClient) {
        console.log(`Web client disconnected: ${ws.id}`);
    } else if (ws.device_id) {
        console.log(`Device disconnected: ${ws.device_id} (${ws.id})`);
        // delete deviceStatus[ws.device_id]; // Remove device from status
    }
    delete deviceStatus[ws.device_id];
    delete clients[ws.id];
    updateClientList();
}

function getClientList() {
    return Object.keys(deviceStatus).map(device_id => ({
        id: deviceStatus[device_id].id,
        device_id,
        status: deviceStatus[device_id].status,
        gunConnected: deviceStatus[device_id].gunConnected,
        charging: deviceStatus[device_id].charging
    })).filter(client => client.status === 'Online'); // Filter out offline devices
}

function updateClientList() {
    const clientListMessage = JSON.stringify({ type: 'updateClientList', clientList: getClientList() });

    for (const id in clients) {
        if (clients[id].isWebClient) {
            clients[id].send(clientListMessage);
        }
    }
}

function sendMessageToClient(targetId, msg, senderId) {
    if (clients[targetId] && clients[targetId].readyState === WebSocket.OPEN) {
        clients[targetId].send(JSON.stringify({ msg, from: senderId }));
        console.log(`Message sent to client ${targetId}: ${msg}`);
    } else {
        console.log(`Failed to send message to client ${targetId}: Client not connected`);
    }
}

function displayMessageOnWebPage(deviceId, msg) {
    const logMessage = JSON.stringify({ type: 'logMessage', message: { msg }, senderId: deviceId });

    for (const id in clients) {
        if (clients[id].isWebClient && clients[id].selectedDeviceId === deviceId) {
            clients[id].send(logMessage);
            // console.log(`Message sent to web client ${id} for device ${deviceId}: ${msg}`);
        }
    }
}

function updateDeviceStatus(deviceId, msg) {
    if (msg.toLowerCase().includes('charging')) {
        deviceStatus[deviceId].charging = true;
    } else if (msg.toLowerCase().includes('not charging')) {
        deviceStatus[deviceId].charging = false;
    }

    if (msg.toLowerCase().includes('gun connected')) {
        deviceStatus[deviceId].gunConnected = true;
    } else if (msg.toLowerCase().includes('gun not connected')) {
        deviceStatus[deviceId].gunConnected = false;
    }

    updateClientList();
}

function generateUniqueID() {
    return Math.random().toString(36).substr(2, 9);
}




// const server = express()
//   .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
//   .listen(PORT, () => console.log(`Listening on ${PORT}`));
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});