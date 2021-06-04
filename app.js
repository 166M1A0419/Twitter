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

let userId = null;

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
        request.username = payload.username;
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
      userId = dbUser.user_id;
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// UserTweetFeed API

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getUserTweetQuery = `
    SELECT username, tweet, date_time AS dateTime
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


// UserFollowing API

app.get("/user/following/", authenticateToken, async (request, response) => {
  //   console.log(userId);

  console.log(request.username);
  const userQuery = `
     SELECT user_id FROM user WHERE username = "${request.username}"`;
  let dbResponse = await db.get(userQuery);
  //response.send(dbResponse);
  console.log(dbResponse);

  const getUserFollowsQuery = `
          SELECT following_user_id
          FROM follower
           WHERE follower_user_id = ${dbResponse.user_id}`;
  console.log(userId);
  const followUser = await db.all(getUserFollowsQuery);
  console.log(followUser);
  let userIdsArray = followUser.map((eachUser) => {
    return eachUser.following_user_id;
  });
  console.log(userIdsArray);

  const followerUserQuery = `
  SELECT  name FROM user WHERE user_id IN (${userIdsArray})`;
  let userDetails = await db.all(followerUserQuery);
  response.send(userDetails);
});

 // UserFollowers API

app.get("/user/followers/", authenticateToken, async (request, response) => {
  console.log(request.username);
  const userQuery = `
     SELECT user_id FROM user WHERE username = "${request.username}"`;
  let dbResponse = await db.get(userQuery);
  //response.send(dbResponse);

  const getUserFollowsQuery = `
          SELECT follower_user_id
          FROM follower
           WHERE following_user_id = ${dbResponse.user_id}`;
  console.log(userId);
  const followUser = await db.all(getUserFollowsQuery);
  console.log(followUser);
  let userIdsArray = followUser.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  console.log(userIdsArray);

  const followerUserQuery = `
  SELECT  name FROM user WHERE user_id IN (${userIdsArray})`;
  let userDetails = await db.all(followerUserQuery);
  response.send(userDetails);
});

// UserRequestTweet API

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;

  const UserIdFromTweetQuery = `
          SELECT user_id FROM tweet WHERE tweet_id = ${tweetId}`;
  console.log(userId);
  const userRes = await db.get(UserIdFromTweetQuery);
  console.log(userRes);
  //response.send(userRes);

  const loggedUserQuery = `
            SELECT user_id FROM user  WHERE username = "${request.username}"`;
  const userDetails = await db.get(loggedUserQuery);
  //response.send(userDetails);
  console.log(userDetails);

  const userFollowerQuery = `
            SELECT following_user_id FROM follower WHERE follower_user_id = ${userDetails.user_id}`;
  const followingUserDetails = await db.all(userFollowerQuery);
  //response.send(followingUserDetails);
  console.log(followingUserDetails);

  let userIdsArray = followingUserDetails.map((eachUser) => {
    return eachUser.following_user_id;
  });
  console.log(userIdsArray);

  const UserPostedTweetQuery = `
        SELECT tweet FROM tweet WHERE tweet.user_id IN (${userIdsArray})`;
  const userTweets = await db.get(UserPostedTweetQuery);
  //response.send(userTweets);

  if (userIdsArray.includes(userRes.user_id)) {
    const getTweetQuery = `
             SELECT tweet AS tweet,
             COUNT(like_id) AS likes,
             COUNT(reply) AS replies,
             date_time AS dateTime
             FROM tweet NATURAL JOIN like NATURAL JOIN reply
             `;
    const result = await db.get(getTweetQuery);
    response.send(result);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
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

  const UserIdFromTweetQuery = `
          SELECT user_id FROM tweet WHERE tweet_id = ${tweetId}`;
  console.log(userId);
  const userRes = await db.get(UserIdFromTweetQuery);
  console.log(userRes);
  //response.send(userRes);

  const loggedUserQuery = `
            SELECT user_id FROM user  WHERE username = "${request.username}"`;
  const userDetails = await db.get(loggedUserQuery);
  //response.send(userDetails);
  console.log(userDetails);

  const userFollowerQuery = `
            SELECT following_user_id FROM follower WHERE follower_user_id = ${userDetails.user_id}`;
  const followingUserDetails = await db.all(userFollowerQuery);
  response.send(followingUserDetails);
  console.log(followingUserDetails);

  let userIdsArray = followingUserDetails.map((eachUser) => {
    return eachUser.following_user_id;
  });
  console.log(userIdsArray);
});
});

module.exports = app;
