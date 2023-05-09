const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 }, () => {
  console.log("server started");
});

let clients = [];
let clientId = 0;

wss.on("connection", function connection(ws) {
  const socketId = ++clientId;
  console.log("A user ready for connection!", socketId);

  ws.on("message", (data) => {
    console.log("data received \n %o", data);
    const res = JSON.stringify({
      id: "test",
      data: "hello"
    });
    ws.send(res);
  });

  // Create a callback fuction to listening EmitPing() method in NetworkMannager.cs unity script
  ws.on("PING", (msg) => {
    const data = JSON.parse(msg);
    console.log("Message from user# " + socketId + ": " + data.msg);

    // Emit back to NetworkManager in Unity by client.js script
    ws.emit("PONG", socketId, data.msg);
  });

  // Create a callback fuction to listening EmitJoin() method in NetworkMannager.cs unity script
  ws.on("JOIN", (msg) => {
    console.log("A player is joined.");

    const data = JSON.parse(msg);
    console.log('data', data);
    
    // Fills out with the information emitted by the player in the unity
    currentUser = {
      id: socketId,
      socketId,
      name: data.name,
      publicAddress: data.publicAddress,
      model: data.model,
      posX: data.posX,
      posY: data.posY,
      posZ: data.posZ,
      rotation: "0",
      muteUsers: [],
      muteAll: false,
      isMute: true,
    };

    // Add currentUser in clients list
    clients.push(currentUser);

    // Send to the client.js script
    ws.emit(
      "JOIN_SUCCESS",
      currentUser.id,
      currentUser.name,
      currentUser.posX,
      currentUser.posY,
      currentUser.posZ,
      data.model
    );
  });
});

wss.on("listening", () => {
  console.log("listening on 8080");
});
