import React, { useState, useEffect } from "react";
import axios from "axios";
import "./styles.css";
import * as R from "ramda"


const setSocketResponseReducer = ({ action, state, value, type }: any) => {
  const appendItem = (act: any, st: any, v: any) => {
    // if the user refreshes, all items are sent, filter accordingly. Probably needs done on the api side of things.

    if (Array.isArray(v.res)) {
      act([
        ...st,
        ...v.res.filter((res: string) => {
          try {
            const r = JSON.parse(res);
            if (v.type === r.type) {
              return v.res;
            }
          } catch (err) {
            return res;
          }
        }),
      ]);
    } else {
      act([...st, v.res]);
    }
  };

  const val = JSON.parse(value);
  switch (val.type) {
    case "message":
      // this additional check is used to prevent other websocket connections from hitting each other
      if (type === "message") {
        appendItem(action, state, val);
      }
      break;
    case "user":
      if (type === "user") {
        console.log(state, val)
        // appendItem(action, state, val);
        action([...state, val.res])
      }
      break;
    case "letter":
      if (type === "letter") {
        action(val.res);
      }
      break;
    case "timer":
      if (type === "timer") {
        action(val.res);
      }
      break;
    case "userVotes":
      if (type === "userVotes") {
        const user = Object.keys(val.res)[0];
        const userPoints = state[user] ? state[user] : [];
        action({ ...state, [user]: [...userPoints, val.res[user]] });
      }
      break;
    case "userVotesCompleted":
      if (type === "userVotesCompleted") {
        action([...state, val.res]);
      }
      break;
    case "vote":
      if (type === "vote") {
        action(val.res);
      }
      break;
    case "votingPanel":
      if (type === "votingPanel") {
        action(val.res);
      }
      break;
  }
};

// hook up to websockets
const wsUsers: any = new WebSocket("ws://localhost:3030/users");
const stringCheese = (val: any) => JSON.stringify(val);

const Login = ({
  currentUsers,
  setCurrentUsers,
  username,
  setUsername,
  userIsSet,
  setCurrentUser,
}: any) => {
  console.log('currentUsers')
  console.log(currentUsers)
  const [userGroup, setUserGroup]: any = useState();

  wsUsers.onmessage = (event: any) => {
    setSocketResponseReducer({
      action: setCurrentUsers,
      state: currentUsers,
      value: event.data,
      type: "user",
    });
  };

  const saveUser = () => {
    wsUsers.send(
      stringCheese({
        type: "user",
        username,
        userGroup,
      })
    );
    setCurrentUser(true);
  };

  return (
    <div>
      {/*TODO need to only display this data whenever the user joins the game and can see the active users*/}
      {/*TODO re-route here*/}
      {!userIsSet && (
        <>
          <label htmlFor="">username</label>
          <input
            type="text"
            onChange={(e) => setUsername(e.target.value)}
            value={username}
          />
          <label htmlFor="">group Id:</label>
          <input
            type="text"
            onChange={(e) => setUserGroup(e.target.value)}
            value={userGroup}
          />
          <button onClick={saveUser}>Submit</button>
        </>
      )}
    </div>
  );
};

const ChatWindow = () => {
  const [messages, setMessages]: any = useState([]);
  const [newMessage, setNewMessage]: any = useState("");

  // useEffect(() => {
  //   wsMessages.onopen = () => {};
  // }, []);

  wsMessages.onmessage = (event: any) => {
    setSocketResponseReducer({
      action: setMessages,
      state: messages,
      value: event.data,
      type: "message",
    });
  };

  const fire = () => {
    wsMessages.send(`user: ${newMessage}`);
    setNewMessage("");
  };

  return (
    <div className="gameCard">
      <input
        type="text"
        onChange={(e) => setNewMessage(e.target.value)}
        value={newMessage}
      />
      <input
        type="text"
        onChange={(e) => setNewMessage(e.target.value)}
        value={newMessage}
      />
      <button onClick={fire}>send</button>
      {messages.map((message: any) => (
        <div key={message}>{message}</div>
      ))}
    </div>
  );
};

const SignedIn = ({ users }: any) => {
  return (
    <div>
      <div>
        {users.length > 0
          ? `Current users in game: ${users.join(",")} and You!`
          : "Just you right now!"}
      </div>
    </div>
  );
};

const gameSessionWs = {
  wsTimer: new WebSocket("ws://localhost:3030/timer"),
  wsVote: new WebSocket("ws://localhost:3030/vote"),
};
const GameSession = ({
  userLeader,
  username,
  users,
  gameCount,
  timesUp,
  setTimesUp,
  timeLeft,
  setTimeLeft,
  setVoting,
}: any) => {
  const [wordList, setWordList] = useState(null);
  const [letter, setLetter]: any = useState(null);
  const [timerIsStarted, setStartTimer]: any = useState(false);
  const [gameIsStarted, setGameIsStarted]: any = useState(false);
  const [responseMessage, setResponseMessage]: any = useState(null);
  const [gameValues, setGameValues] = useState(Array(10).fill(""));

  gameSessionWs.wsTimer.onmessage = (event: any) => {
    setSocketResponseReducer({
      action: setStartTimer,
      value: event.data,
      type: "timer",
    });
  };

  const startTimer = () => {
    gameSessionWs.wsTimer.send(
      stringCheese({
        type: "timer",
      })
    );
  };

  gameSessionWs.wsVote.onmessage = (event: any) => {
    setSocketResponseReducer({
      action: setVoting,
      value: event.data,
      type: "vote",
    });
  };

  const goVote = () => {
    gameSessionWs.wsVote.send(
      stringCheese({
        type: "vote",
      })
    );
  };

  useEffect(() => {
    if (timesUp) {
      const data = {
        user: username,
        // values: gameValues,
        values: Array(10)
          .fill("")
          .map((i: string, idx: number) => `${username} - ${idx}`),
      };
      axios.post("/sendscores", data).then((response) => {
        if (response.status === 200) {
          setResponseMessage(
            "Thank you for your answers, hope they didn't suck!"
          );
        } else {
          setResponseMessage(
            "Error saving your messages, they must've been pretty bad"
          );
        }
      });
    }
  }, [timesUp]);

  useEffect(() => {
    axios.get(`/wordList?gameCount=${gameCount}`).then((response) => {
      if (response.status === 200) {
        setWordList(response.data.list);
      } else {
        alert("error loading the list");
      }
    });
  }, []);

  const handleOnChange = (idx: number) => (e: any) => {
    const newVals = [...gameValues];
    const curValue = e.target.value;
    newVals[idx] = curValue;
    setGameValues(newVals);
  };

  if (wordList == null) {
    return <div>Still Loading!</div>;
  }

  const isCurrentUser = userLeader === username;
  console.log(isCurrentUser)
  console.log(userLeader, username)
  return (
    <div>
      {timerIsStarted && (
        <Timer
          setTimesUp={setTimesUp}
          timeLeft={timeLeft}
          setTimeLeft={setTimeLeft}
          timesUp={timesUp}
          setGameIsStarted={setGameIsStarted}
        />
      )}
      {!timerIsStarted && (
        <RollDice
          userLeader={userLeader}
          setLetter={setLetter}
          letter={letter}
          isCurrentUser={isCurrentUser}
          startTimer={startTimer}
          users={users}
        />
      )}
      <h1>{letter}</h1>
      {gameIsStarted &&
        //@ts-ignore - cant be null
        wordList.map((phrase: string, idx: number) => (
          <div className="inputRow" key={`inputRow-${idx}`}>
            {/*might be cool to allow the user to remove items if they want, I always got embarassed by certain answers*/}
            <label htmlFor="">{phrase}</label>
            <input
              type="text"
              disabled={timesUp}
              placeholder={phrase}
              value={gameValues[idx]}
              onChange={handleOnChange(idx)}
            />
          </div>
        ))}
      {responseMessage && (
        <div>
          <p>{responseMessage}</p>
          {isCurrentUser && <button onClick={goVote}>Go Vote!</button>}
        </div>
      )}
    </div>
  );
};

const wsLetter: any = new WebSocket("ws://localhost:3030/letter");
export const RollDice = ({
  setLetter,
  letter,
  userLeader,
  startTimer,
  users,
}: any) => {
  wsLetter.onmessage = (event: any) => {
    setSocketResponseReducer({
      action: setLetter,
      state: letter,
      value: event.data,
      type: "letter",
    });
  };

  const rollDice = async () => {
    wsLetter.send(
      stringCheese({
        type: "letter",
        letter,
      })
    );
  };

  const startGame = () => {
    if (users.length) {
      startTimer();
    } else {
      alert("cant start the game by yourself, that's not much fun");
    }
  };

  return userLeader ? (
    <div>
      <p>If All users are in the game, click</p>
      {!letter && (
        <button onClick={async () => await rollDice()}>Roll Dice</button>
      )}
      {letter && (
        <div>
          <button onClick={async () => await rollDice()}>Re-Roll?</button>
          <button onClick={startGame}>We good.</button>
        </div>
      )}
    </div>
  ) : null;
};

const Timer = ({
  setTimesUp,
  timeLeft,
  setTimeLeft,
  timesUp,
  setGameIsStarted,
}: any) => {
  const timer = 3;

  const [countDown, setCountDown] = useState(3);
  const [timeLeftStyle, setTimeLeftStyle] = useState({});

  let style = {};

  // run the time 60 second timer
  useEffect(() => {
    if (timeLeft) {
      setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      if (timeLeft <= 10) {
        // TODO initiate hurry up sounds
        // TODO run animation here
        console.log("less than 10 seconds left countdown");
      }
    }
    if (timeLeft === 0) {
      console.log("TIMES UP!");
      setTimesUp(true);
    }
  }, [timeLeft]);

  // run the 3 second countdown
  useEffect(() => {
    if (countDown > 0) {
      setTimeout(() => {
        setCountDown(countDown - 1);
      }, 1000);
    }

    if (countDown === 0) {
      // TODO initiate go! animation
      // TODO open up submissions for users
      setGameIsStarted(true);
      setTimeLeft(timer);
    }
  }, [countDown]);

  return (
    <div>
      {countDown > 0 && <div className="countDown">{countDown}</div>}
      {countDown === 0 && !timesUp && <div>GO!</div>}
      {timesUp && <div>times up!</div>}
      {!timesUp && (
        <div className="timeLeft" style={timeLeftStyle}>
          {timeLeft}
        </div>
      )}
    </div>
  );
};

// cycle through answers, dont show names on answers, just disable their own answer
// maybe show names on answers?
// button for cancel and duplicate - would do same thing?
// show people who havent voted yet so people can bitch at them
const votingWs = {
  wsVoting: new WebSocket("ws://localhost:3030/vote"),
};
const Voting = ({ userLeader, username, currentUsers }: any) => {
  const [answers, setAnswers]: any = useState([]);
  const [questions, setQuestions] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentAnswerStep, setCurrentAnswerStep] = useState(0);
  // TODO needs reset after each answer session
  const [groupVotes, setGroupVotes]: any = useState({});
  const [hasAnswered, setHasAnswered]: any = useState([]);
  const [numberOfAnswers, setNumberOfAnswers] = useState(0);
  const [completedUsers, setCompletedUsers]: any = useState([]);
  const [usersScore, setUsersScore]: any = useState({});

  R.once(() => {
    console.log('currentUsers')
    console.log(currentUsers)
  })

  votingWs.wsVoting.onmessage = (event: any) => {
    const type = JSON.parse(event.data).type;
    switch (type) {
      case "userVotes":
        setSocketResponseReducer({
          action: setGroupVotes,
          state: groupVotes,
          value: event.data,
          type,
        });
        break;
      case "userVotesCompleted":
        setSocketResponseReducer({
          action: setCompletedUsers,
          state: completedUsers,
          value: event.data,
          type,
        });
        break;
      case "votingPanel":
        setSocketResponseReducer({
          action: (step: number) => {
            setCurrentAnswerStep(step)
            setGroupVotes([]);
            setCompletedUsers([]);
            setNumberOfAnswers(0);
            setDefaults()
          },
          value: event.data,
          type,
        });
        break;
    }
  };

  const sendUserVote = async (newUserVotes: any) => {
    votingWs.wsVoting.send(
      stringCheese({
        type: "userVotes",
        userVotes: newUserVotes,
      })
    );
  };

  const setDefaults = (val = answers) => {
    setHasAnswered(Array(val.length).fill([]))
    setUsersScore(
      val.reduce(
        (acc: any, cur: any) => ({
          ...acc,
          [cur.user]: 0,
        }),
        {}
      )
    );
    setNumberOfAnswers(
      val.filter((answer: any) => {
        if (username !== answer.user && answer.answers[0] !== "") {
          return true;
        }
      }).length
    );
    setUsers(
      val.reduce(
        (acc: any, cur: any) => ({
          ...acc,
          [cur.user]: [],
        }),
        {}
      )
    );
  }

  useEffect(() => {
    axios.get(`/answers?`).then((response) => {
      if (response.status === 200) {
        setAnswers(response.data.answers);
        setDefaults(response.data.answers)
        setQuestions(response.data.list.list);
      } else {
        alert("error loading the answers");
      }
    });
  }, []);

  if (answers.length === 0 || questions.length === 0 || users.length === 0) {
    return <div>still loading</div>;
  }

  const doAnswer = async (user: string, answer: string, type: boolean) => {
    const newUserVotes = { ...groupVotes };
    newUserVotes[user] = newUserVotes[user] ? newUserVotes[user] : [];
    newUserVotes[user] = [...newUserVotes[user], type ? 1 : 0];
    await sendUserVote({ [user]: type ? 1 : 0 });
  };

  const doSetHasAnswered = (idx: number, answerValue: boolean) => {
    const newHasAnswered = [...hasAnswered];
    newHasAnswered[idx] = [...newHasAnswered[idx], answerValue];
    setHasAnswered([...newHasAnswered]);
  };

  // TODO need to send score
  // const calculateScore = () => {
  //   Object.keys(users).map((user: any) => {
  //     const userAnswers = answers.filter((answer: any) => {
  //       if (answer.user === user) {
  //         return answer.answers;
  //       }
  //     });
  //     const points = groupVotes[user].reduce(
  //       (score: number, mark: number) => score + mark,
  //       0
  //     );
  //     if (points >= Math.ceil(users.length / 2)) {
  //       // users has scored, add points to total
  //       setUsersScore({
  //         ...usersScore,
  //         [user]: usersScore + userAnswers[currentAnswerStep].split(" ").length,
  //       });
  //     }
  //   });
  // };

  const navToNextQuestion = () => {
    votingWs.wsVoting.send(
      stringCheese({
        type: "votingPanel",
        votingStep: currentAnswerStep + 1,
      })
    );
  };

  const Vote = ({ answer, user, idx }: any) => {
    if (!answer || user === username) {
      return null;
    }

    // console.log(hasAnswered)
    // console.log(hasAnswered[idx])
    // console.log(idx)
    // console.log(username)
    // console.log('--------')
    // hides the answer buttons if user has answered
    console.log(hasAnswered)
    // if (hasAnswered[idx] && hasAnswered[idx].indexOf(username) < 0) {
    //   console.log('returning here???')
    //   return null;
    // }

    return (
      <>
        <button
          onClick={async () => {
            await doAnswer(user, answer, true);
            doSetHasAnswered(idx, true);
          }}
        >
          Yes
        </button>
        <button
          onClick={async () => {
            await doAnswer(user, answer, false);
            doSetHasAnswered(idx, false);
          }}
        >
          No
        </button>
      </>
    );
  };

  return (
    <div>
      <p>{questions[currentAnswerStep]}</p>
      <ul>
        {answers.map((answer: any, idx: number) => {
          const _answer = answer.answers[currentAnswerStep];
          return (
            <div>
              {answer.user}: {_answer ? _answer : "N/A"}
              <Vote answer={_answer} user={answer.user} idx={idx} />
              <div className="score">
                {groupVotes[answer.user]
                  ? groupVotes[answer.user].reduce(
                      (score: number, curr: number) => score + curr,
                      0
                    )
                  : 0}
              </div>
            </div>
          );
        })}
      </ul>
      <div>
        {Object.keys(users).map((user: any) => {
          const allAnswered =
            hasAnswered.reduce(
              (answered: number, cur: any) =>
                answered + (cur.includes(user) ? 1 : 0),
              0
            ) === numberOfAnswers || completedUsers.includes(user);
          return (
            <UserVoting
              user={user}
              allAnswered={allAnswered}
              userScore={usersScore[user]}
            />
          );
        })}
      </div>
      {userLeader && (
        <div>
          <p>When the voting is complete, continue to the next vote</p>
          <button onClick={navToNextQuestion}>Next Question</button>
        </div>
      )}
    </div>
  );
};

const UserVoting = ({ user, allAnswered, userScore }: any) => {
  useEffect(() => {
    if (allAnswered)
      votingWs.wsVoting.send(
        stringCheese({
          type: "userVotesCompleted",
          user,
        })
      );
  }, [allAnswered]);

  return (
    <div style={{ color: allAnswered ? "lightgrey" : "black" }}>
      {user} - {userScore} pts
    </div>
  );
};

const gameContext = {};
const GameContext: any = React.createContext(gameContext);

const wsMessages: any = new WebSocket("ws://localhost:3030/messages");
const App = () => {
  const [userIsSet, setCurrentUser]: any = useState(false);
  // const [userIsSet, setCurrentUser]: any = useState(true);
  const [currentUsers, setCurrentUsers]: any = useState([]);
  const [username, setUsername]: any = useState();
  // TODO need to pass this down to send on saving scores to keep records
  const [groupName, setGroupName]: any = useState();
  const [gameCount, setGameCount] = useState(1);
  const [timesUp, setTimesUp] = useState(false);
  const [timeLeft, setTimeLeft]: [null | number, any] = useState(null);
  const [voting, setVoting]: any = useState(false);
  const [context, setGameContext] = useState(gameContext);

  const getUsers = () =>
    currentUsers.filter((user: string) => user !== username);

  const setContext = (props: any) => {
    setGameContext({
      ...context,
      ...props,
    });
  };

  // need to update the game count here
  // useEffect(() => {
  //     if(gameSessionInProgress) {
  //
  //     }
  // }, [gameSessionInProgress])

  const userLeader =
    currentUsers.length < 0
      ? currentUsers[0]
      // ? currentUsers[gameCount % currentUsers.length]
      : currentUsers[1];

  console.log('userLeader')
  console.log(userLeader)
  console.log(currentUsers)

  return (
    <GameContext.Provider
      value={{
        ...context,
        setContext,
      }}
    >
      <div>
        {!voting && (
          <>
            <ul className="users">
              {/*login infos*/}
              {!userIsSet && (
                <Login
                  currentUsers={currentUsers}
                  setCurrentUsers={setCurrentUsers}
                  username={username}
                  setUsername={setUsername}
                  setCurrentUser={setCurrentUser}
                  userIsSet={userIsSet}
                />
              )}
              {/*game card after login */}
              {/*This could be a fun chat window for everyone in your group*/}
              {/*functionality is basically there for it already, pub/sub anyways*/}
              {/*<ChatWindow />*/}
            </ul>
            <div>
              {userIsSet && (
                <>
                  <SignedIn users={getUsers()} />
                  <GameSession
                    userLeader={userLeader}
                    username={username}
                    users={currentUsers}
                    gameCount={gameCount}
                    timesUp={timesUp}
                    setTimesUp={setTimesUp}
                    timeLeft={timeLeft}
                    setTimeLeft={setTimeLeft}
                    setVoting={setVoting}
                  />
                </>
              )}
            </div>
          </>
        )}
        {voting && (
          <Voting
            userLeader={userLeader === username}
            username={username}
            currentUsers={currentUsers}
          />
        )}
      </div>
    </GameContext.Provider>
  );
};

// TODO need to eliminate the ability for new users to join after game has started
// submit answers,
// cycle answers for user votes to veto,
// calculate score (keep in mind multiple words here),
// keep score history,
// opt for another game / opt to quit
// if quit
// display winning user
// else
//     roll dice and start anew

export default App;
