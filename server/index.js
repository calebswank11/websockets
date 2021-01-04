const express = require("express");
const path = require("path");
const WebSocket = require("ws");
const enableWs = require("express-ws");

const app = express(); // create express app
const wsInstance = enableWs(app);
let { alphabet } = require("./utils/alphabet");
const pgp = require("pg-promise")(/* options */);

// Note: We can have multiple express.static methods in a single file each for serving different folder content.
app.use(express.static(path.join(__dirname, "..", "build")));
app.use(express.static("public"));
app.use(express.urlencoded());
app.use(express.json());

const db = pgp({
  host: "localhost",
  port: 5432,
  database: "sockets",
  user: "sockets",
  password: "pass1234",
});

const dbOne = async (query, val) => {
  try {
    return await db.one(query);
  } catch (err) {
    console.log(err);
    throw err;
  }
};

const voting = {
  list: null,
  answers: [],
};
// generic routes
app.get("/wordList", function (req, res) {
  dbOne(`select * from wordlist where id = ${req.query.gameCount}`)
    .then((list) => {
      voting.list = list;
      // reset answers
      voting.answers = [];

      res.send(list);
    })
    .catch((err) => {
      res.status(400).send({
        message: err.message,
      });
    });
});

app.get("/rolldice", function (req, res) {
  res.send({
    letter: alphabet[Math.floor(Math.random() * 26) + 1],
  });
});

app.post("/sendscores", (req, res) => {
  // need to save this to a database
  voting.answers = [
    ...voting.answers,
    { user: req.body.user, answers: req.body.values },
  ];
  res.send({});
});

const votingMock = {
  list: {
    listNumber: 12,
    phrases: [
      "question 1",
      "question 2",
      "question 3",
      "question 4",
      "question 5",
      "question 6",
      "question 7",
      "question 8",
      "question 9",
      "question 10",
    ],
  },
  answers: [
    {
      user: "user",
      answers: ["user", "sdfg", "sdfg", "", "asdf", "", "", "", "", ""],
    },
    {
      user: "user1",
      answers: [
        "user1's answer",
        "sdfg",
        "sdfg",
        "",
        "asdf",
        "",
        "",
        "",
        "",
        "",
      ],
    },
  ],
};
app.get("/answers", (req, res) => {
  // TODO will need to call wordlist and answers and merge them
  const response = voting.answers.map(
    (cur) => ({
      ...cur,
      answers: cur.answers.map((answer) => (answer === "" ? false : answer)),
    }),
    {}
  );
  const newVoting = { ...voting };
  newVoting.answers = response;
  res.send(newVoting);
});

// messages socket
const messages = ["Start Chatting!"];
app.ws("/messages", (ws, req) => {
  ws.send(JSON.stringify({ type: "message", res: messages }));

  ws.on("message", function (msg) {
    messages.push(msg);
    wsInstance.getWss().clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "message", res: msg }));
      }
    });
  });

  ws.on("close", (socketClient) => {
    console.log("closed message");
  });
});

const users = [];
app.ws("/users", (ws, req) => {
  ws.on("message", function (user) {
    users.push(user);
    wsInstance.getWss().clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({ type: "user", res: JSON.parse(user).username })
        );
      }
    });
  });

  ws.on("close", (socketClient) => {
    console.log("closed user");
  });
});

const getLetter = (letter) => {
  if (letter) {
    const idx = alphabet.indexOf(letter);
    const retLetter = alphabet[idx + 1];
    // if the user re-rolls so many times, start from beginning
    if (!retLetter) {
      return alphabet[0];
    }
    return retLetter;
  } else {
    return alphabet[0];
  }
};
app.ws("/letter", (ws, req) => {
  ws.on("message", (obj) => {
    wsInstance.getWss().clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const letter = JSON.parse(obj).letter;

        client.send(JSON.stringify({ type: "letter", res: getLetter(letter) }));
      }
    });
  });
});

app.ws("/timer", (ws, req) => {
  ws.on("message", (obj) => {
    wsInstance.getWss().clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "timer", res: true }));
      }
    });
  });
});

app.ws("/vote", (ws, req) => {
  ws.on("message", (obj) => {
    const votes = JSON.parse(obj);
    wsInstance.getWss().clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        switch (votes.type) {
          case "vote":
            client.send(
              JSON.stringify({
                type: "vote",
                res: true,
              })
            );
            break;
          case "userVotes":
            client.send(
              JSON.stringify({
                type: "userVotes",
                res: votes.userVotes,
              })
            );
            break;
          case "userVotesCompleted":
            client.send(
              JSON.stringify({
                type: "userVotesCompleted",
                res: votes.user,
              })
            );
            break;
          case "votingPanel":
            client.send(
              JSON.stringify({
                type: "votingPanel",
                res: votes.votingStep,
              })
            );
            break;
          default:
            return;
        }
      }
    });
  });
});

// start express server on port 3030
app.listen(3030, () => {
  console.log("server started on port 3030");
});
