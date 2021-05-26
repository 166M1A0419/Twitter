const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();
app.use(express.json());

let db = null;
const initializeDbToServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbToServer();

const convertUserDbObjToResponseObj = (dbObject) => {
  return {
    userId: dbObject.user_id,
    name: dbObject.name,
    username: dbObject.username,
    password: dbObject.password,
    gender: dbObject.gender,
  };
};

const convertFollowerDbObjToResponseDObj = (dbObject) => {
  return {
    followId: dbObject.follower_id,
    followerUserId: follower_user_id,
    followingUserId: following_user_id,
  };
};
const convertTweetDbObjToResponseObj = (dbObject) => {
  return {
    tweet: dbObject.tweet,
    tweetId: dbObject.tweet_id,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

const convertReplyDbObjToResponseObj = (dbObject) => {
  return {
    reply: dbObject.reply,
    replyId: dbObject.reply_id,
    tweetId: dbObject.tweet_id,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

const convertLikeDbObjToResponseObj = (dbObject) => {
  return {
    likeId: dbObject.like_id,
    tweetId: dbObject.tweet_id,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

const validatePassword = (password) => {
  return password.length > 6;
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "axbycz", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// user Register API

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const createUserQuery = `
    INSERT INTO 
        user(username, password, name, gender)
    VALUES 
    (
        '${username}',
        '${hashedPassword}',
        '${name}',
        '${gender}'
    );`;

    if (validatePassword(password)) {
      await db.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// user login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
     SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "axbycz");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getUserTweetQuery = `
    SELECT username, tweet, date_time
     FROM 
    (user INNER JOIN tweet ON user.user_id = tweet.user_id) AS T INNER JOIN 
    follower ON T.user_id = follower_user_id
    WHERE user.user_id = follower.follower_user_id
    GROUP BY username
    ORDER BY tweet DESC
    LIMIT 4`;
  const tweets = await db.all(getUserTweetQuery);
  response.send(tweets);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const getUserFollowsQuery = `
    SELECT DISTINCT(name) 
    FROM 
     user INNER JOIN follower ON user.user_id = follower.follower_user_id`;
  const followUser = await db.all(getUserFollowsQuery);
  response.send(
    followUser.map((eachName) => convertUserDbObjToResponseObj(eachName))
  );
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getUserFollowersQuery = `
    SELECT DISTINCT(name) 
     FROM 
     user INNER JOIN follower ON user.user_id = follower.following_user_id`;
  const followUser = await db.all(getUserFollowersQuery);
  response.send(
    followUser.map((eachName) => convertUserDbObjToResponseObj(eachName))
  );
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;

  const userTweetQuery = `
    SELECT
    tweet AS tweet,
    COUNT(like_id) AS likes,
    COUNT(reply) AS replies,
    date_time AS dateTime
    FROM user INNER JOIN like ON user.user_id = like.like_id INNER JOIN reply ON like.user_id = reply.user_id 
    INNER JOIN tweet ON reply.user_id = tweet.user_id INNER JOIN follower ON follower.follower_user_id = tweet.user_id 
    WHERE follower.follower_user_id LIKE "%${tweetId}%"`;

  if (tweetId !== undefined) {
    const dbResponse = await db.get(userTweetQuery);
    response.send(dbResponse);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const getUserTweetsQuery = `
     SELECT
     tweet AS tweet,
    COUNT(like_id) AS likes,
    COUNT(reply) AS replies,
    date_time AS dateTime
    FROM (user NATURAL JOIN like NATURAL JOIN reply NATURAL JOIN tweet) AS T INNER JOIN follower 
    ON T.user_id = follower.follower_user_id
   GROUP BY tweet`;
  const dbResponse = await db.all(getUserTweetsQuery);
  response.send(dbResponse);
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const postUserTweetQuery = `
    INSERT INTO tweet ( tweet ) 
    VALUES ('${tweet}')`;
  await db.run(postUserTweetQuery);
  response.send("Created a Tweet");
});

app.delete("tweets/:tweetId", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  if (tweet_id !== undefined) {
    const deleteUserQuery = `
    DELETE FROM tweet 
    WHERE tweet_id = ${tweetId}`;

    await db.run(deleteUserQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
