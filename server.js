/*
 *@autor: Rio 3D Studios
 *@description:  java script server that works as master server of the Basic Example of WebGL Multiplayer Kit
 */
let express = require("express"); //import express NodeJS framework module
let app = express(); // create an object of the express module
let http = require("http").Server(app); // create a http web server using the http library
let io = require("socket.io")(http); // import socketio communication module
let _ = require("underscore");
let nsp = io.of('/');  // this is what needs to happen

app.use(
  "/public/TemplateData",
  express.static(__dirname + "/public/TemplateData")
);
app.use("/public/Build", express.static(__dirname + "/public/Build"));
app.use(express.static(__dirname + "/public"));

const MAX_PLAYER_COUNT = 2;
const NUMBER_OF_HORSES = 4;

let clients = []; // to storage clients
let clientLookup = {}; // clients search engine
let sockets = {}; //// to storage sockets
let finishedHorses = [];

function getDistance(x1, y1, x2, y2) {
  let y = x2 - x1;
  let x = y2 - y1;

  return Math.sqrt(x * x + y * y);
}

//open a connection with the specific client
nsp.on("connection", function (socket) {
  //print a log in node.js command prompt
  console.log("A user ready for connection!");

  //to store current client connection
  let currentUser;

  let sended = false;

  let muteAll = false;

  const broadcast = (message, payload) => {
    clients.forEach(function (client) {
      const socket = sockets[client.id];
      socket.emit(message, payload);
    });
  }

  const broadcast2clients = (message, payload) => {
    clients.forEach(function (client) {
      if (client.id !== currentUser.id) {
        const socket = sockets[client.id];
        socket.emit(message, payload);
      }
    });
  }

  //create a callback fuction to listening EmitPing() method in NetworkMannager.cs unity script
  socket.on("PING", function () {
    //console.log("Received ping message from user# " + socket.id);
    socket.emit("PONG", socket.id);
  });

  //create a callback fuction to listening EmitJoin() method in NetworkMannager.cs unity script
  socket.on("JOIN", function (data) {
    console.log("[INFO] JOIN received !!! ", socket.id, data);
    let isHost = clients.length == 0;
    // fills out with the information emitted by the player in the unity
    currentUser = {
      name: data.name || `Player${clients.length}`,
      publicAddress: data.publicAddress,
      model: data.model,
      posX: data.posX,
      posY: data.posY,
      posZ: data.posZ,
      rotation: "0",
      id: socket.id, //alternatively we could use socket.id
      socketId: socket.id, //fills out with the id of the socket that was open
      muteUsers: [],
      muteAll: false,
      isMute: true,
      isReady: false,
      isHost : isHost
    }; //new user  in clients list

    console.log("[INFO] player " + currentUser.name + ": logged!");
    console.log("[INFO] currentUser.position " + currentUser.position);

    //add currentUser in clients list
    clients.push(currentUser);

    //add client in search engine
    clientLookup[currentUser.id] = currentUser;

    sockets[currentUser.id] = socket; //add curent user socket

    console.log("[INFO] Total players: " + clients.length);

    /*********************************************************************************************/

    const playerInfo = {
      id: currentUser.id,
      name: currentUser.name,
      isReady: false,
    };

    //send to the client.js script
    socket.emit("JOIN_SUCCESS", playerInfo);

    //spawn all connected clients for currentUser client
    broadcast2clients("SPAWN_PLAYER", playerInfo);

    //spawn currentUser client on clients in broadcast
    socket.broadcast.emit("SPAWN_PLAYER", playerInfo);
  }); //END_SOCKET_ON
  
  socket.on("FINISH_HORSE", function (data) {
    console.log("FINISH_HORSE", currentUser.name);
    if (currentUser && currentUser.isHost) {
      console.log("FINISH_HORSE_Accepted", data);
      finishedHorses.push(data);
      if(finishedHorses.length == NUMBER_OF_HORSES){
      console.log("Finish_RACE", finishedHorses);
      broadcast("Finish_RACE", finishedHorses);
        finishedHorses = [];
      }
    }
  });

  socket.on("READY", function (data) {
    console.log("READY", currentUser);
    if (currentUser) {
      currentUser.isReady = true;
    }
    socket.emit("READY_SUCCESS", currentUser.id);

    if (clients.length >= MAX_PLAYER_COUNT) {
      if (_.every(clients, (client) => client.isReady)) {
        console.log('Start game');
        const emulate = emulateRace();
        broadcast("START_RACE", emulate);
      }
    }
  });

  const emulateRace = () => {
    const result = [];
    for (let i = 0; i < NUMBER_OF_HORSES; i++) {
      const speeds = [];
      for (let n = 0; n < 20; n++) {
        const value = Math.floor(Math.random() * 400) - 200;
        speeds.push(value);
      }
      result.push({ speeds });
    }
    console.log('emulateRace', result)
    return { data: result };
  }

  //create a callback fuction to listening EmitMoveAndRotate() method in NetworkMannager.cs unity script
  socket.on("MOVE_AND_ROTATE", function (_data) {
    let data = JSON.parse(_data);

    if (currentUser) {
      currentUser.posX = data.posX;
      currentUser.posY = data.posY;
      currentUser.posZ = data.posZ;

      currentUser.rotation = data.rotation;

      // send current user position and  rotation in broadcast to all clients in game
      socket.broadcast.emit(
        "UPDATE_MOVE_AND_ROTATE",
        currentUser.id,
        currentUser.posX,
        currentUser.posY,
        currentUser.posZ,
        currentUser.rotation
      );
    }
  }); //END_SOCKET_ON

  //create a callback fuction to listening EmitAnimation() method in NetworkMannager.cs unity script
  socket.on("ANIMATION", function (_data) {
    let data = JSON.parse(_data);

    if (currentUser) {
      currentUser.timeOut = 0;

      //send to the client.js script
      //updates the animation of the player for the other game clients
      socket.broadcast.emit(
        "UPDATE_PLAYER_ANIMATOR",
        currentUser.id,
        data.animation
      );
    } //END_IF
  }); //END_SOCKET_ON

  //create a callback fuction to listening EmitGetBestKillers() method in NetworkMannager.cs unity script
  socket.on("GET_USERS_LIST", function (pack) {
    if (currentUser) {
      //spawn all connected clients for currentUser client
      clients.forEach(function (i) {
        if (i.id != currentUser.id) {
          //send to the client.js script
          socket.emit("UPDATE_USER_LIST", i.id, i.name, i.publicAddress);
        } //END_IF
      }); //end_forEach
    }
  }); //END_SOCKET.ON

  //create a callback fuction to listening EmitMoveAndRotate() method in NetworkMannager.cs unity script
  socket.on("MESSAGE", function (_data) {
    let data = JSON.parse(_data);

    if (currentUser) {
      // send current user position and  rotation in broadcast to all clients in game
      socket.emit("UPDATE_MESSAGE", currentUser.id, data.message);
      // send current user position and  rotation in broadcast to all clients in game
      socket.broadcast.emit("UPDATE_MESSAGE", currentUser.id, data.message);
    }
  }); //END_SOCKET_ON

  //create a callback fuction to listening EmitMoveAndRotate() method in NetworkMannager.cs unity script
  socket.on("PRIVATE_MESSAGE", function (_data) {
    let data = JSON.parse(_data);

    if (currentUser) {
      // send current user position and  rotation in broadcast to all clients in game
      socket.emit(
        "UPDATE_PRIVATE_MESSAGE",
        data.chat_box_id,
        currentUser.id,
        data.message
      );

      sockets[data.guest_id].emit(
        "UPDATE_PRIVATE_MESSAGE",
        data.chat_box_id,
        currentUser.id,
        data.message
      );
    }
  }); //END_SOCKET_ON

  //create a callback fuction to listening EmitMoveAndRotate() method in NetworkMannager.cs unity script
  socket.on("SEND_OPEN_CHAT_BOX", function (_data) {
    let data = JSON.parse(_data);

    if (currentUser) {
      // send current user position and  rotation in broadcast to all clients in game
      socket.emit("RECEIVE_OPEN_CHAT_BOX", currentUser.id, data.player_id);

      //spawn all connected clients for currentUser client
      clients.forEach(function (i) {
        if (i.id == data.player_id) {
          console.log("send to : " + i.name);
          //send to the client.js script
          sockets[i.id].emit("RECEIVE_OPEN_CHAT_BOX", currentUser.id, i.id);
        } //END_IF
      }); //end_forEach
    }
  }); //END_SOCKET_ON

  socket.on("CONFIRM_TRANSACTION", function (_data) {
    let data = JSON.parse(_data);

    sockets[data.idTo].emit("UPDATE_CONFIRM_TRANSACTION", data.amount);
  }); //END_SOCKET_ON

  socket.on("MUTE_ALL_USERS", function () {
    if (currentUser) {
      currentUser.muteAll = true;
      clients.forEach(function (u) {
        currentUser.muteUsers.push(clientLookup[u.id]);
      });
    }
  }); //END_SOCKET_ON

  socket.on("REMOVE_MUTE_ALL_USERS", function () {
    if (currentUser) {
      currentUser.muteAll = false;
      while (currentUser.muteUsers.length > 0) {
        currentUser.muteUsers.pop();
      }
    }
  }); //END_SOCKET_ON

  socket.on("ADD_MUTE_USER", function (_data) {
    let data = JSON.parse(_data);

    if (currentUser) {
      //console.log("data.id: "+data.id);
      console.log("add mute user: " + clientLookup[data.id].name);
      currentUser.muteUsers.push(clientLookup[data.id]);
    }
  }); //END_SOCKET_ON

  socket.on("REMOVE_MUTE_USER", function (_data) {
    let data = JSON.parse(_data);

    if (currentUser) {
      for (let i = 0; i < currentUser.muteUsers.length; i++) {
        if (currentUser.muteUsers[i].id == data.id) {
          console.log(
            "User " +
              currentUser.muteUsers[i].name +
              " has removed from the mute users list"
          );
          currentUser.muteUsers.splice(i, 1);
        }
      }
    }
  }); //END_SOCKET_ON

  socket.on("VOICE", function (data) {
    let minDistanceToPlayer = 3;

    if (currentUser) {
      let newData = data.split(";");

      newData[0] = "data:audio/ogg;";
      newData = newData[0] + newData[1];

      clients.forEach(function (u) {
        let distance = getDistance(
          parseFloat(currentUser.posX),
          parseFloat(currentUser.posY),
          parseFloat(u.posX),
          parseFloat(u.posY)
        );

        let muteUser = false;

        for (let i = 0; i < currentUser.muteUsers.length; i++) {
          if (currentUser.muteUsers[i].id == u.id) {
            muteUser = true;
          }
        }

        //console.log("distance: "+distance);

        // console.log("mute user: "+muteUser);

        if (
          sockets[u.id] &&
          u.id != currentUser.id &&
          !currentUser.isMute &&
          distance < minDistanceToPlayer &&
          !muteUser &&
          !sockets[u.id].muteAll
        ) {
          //  console.log("current user: "+currentUser.name);

          //  console.log("u.name: "+u.name);

          //sockets[u.id].emit('UPDATE_VOICE',currentUser.id,newData);
          sockets[u.id].emit("UPDATE_VOICE", newData);

          sockets[u.id].broadcast.emit("SEND_USER_VOICE_INFO", currentUser.id);
        }
      });
    }
  });

  socket.on("AUDIO_MUTE", function (data) {
    if (currentUser) {
      currentUser.isMute = !currentUser.isMute;
    }
  });

  // called when the user desconnect
  socket.on("disconnect", function () {
    if (currentUser) {
      currentUser.isDead = true;

      //send to the client.js script
      //updates the currentUser disconnection for all players in game
      socket.broadcast.emit("USER_DISCONNECTED", currentUser.id);

      for (let i = 0; i < clients.length; i++) {
        if (
          clients[i].name == currentUser.name &&
          clients[i].id == currentUser.id
        ) {
          let needToResetHost = currentUser.isHost && clients.length > 1;
          console.log("User " + clients[i].name + " has disconnected");
          clients.splice(i, 1);
          if(needToResetHost){
            clients[0].isHost = true;
          }
        }
      }
    }
  }); //END_SOCKET_ON
}); //END_IO.ON

http.listen(process.env.PORT || 8040, function () {
  console.log("listening on *:8040");
});
console.log("------- server is running -------");
