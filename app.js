const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

const toConvertObjectToString = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// authentication Token
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "login", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login user API1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "login");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// get states API2
app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state WHERE state_id;
    `;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachOne) => {
      return {
        stateId: eachOne.state_id,
        stateName: eachOne.state_name,
        population: eachOne.population,
      };
    })
  );
});

//get state API3
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};
    `;
  const stateArray = await db.get(getStateQuery);
  response.send(toConvertObjectToString(stateArray));
});

// add district API4
//add district API3
app.post("/districts/", authenticationToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO 
    district (district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');
    `;
  const dbResponse = await db.run(addDistrictQuery);
  const { districtId } = dbResponse.lastID;
  response.send("District Successfully Added");
});

//get district API5
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};
    `;
    const districtArray = await db.get(getDistrictQuery);
    response.send(toConvertObjectToString(districtArray));
  }
);

//delete district API6
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//update district API7
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
    UPDATE 
    district
    SET district_name='${districtName}', state_id='${stateId}', cases='${cases}', cured='${cured}', active='${active}', deaths='${deaths}'
    WHERE district_id = ${districtId};
    `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//get total API8
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateDetailsQuery = `
    SELECT SUM(cases), SUM(cured), SUM(active), SUM(deaths) FROM district 
    WHERE
    state_id = ${stateId};
    `;
    const stateDetails = await db.get(getStateDetailsQuery);

    response.send({
      totalCases: stateDetails["SUM(cases)"],
      totalCured: stateDetails["SUM(cured)"],
      totalActive: stateDetails["SUM(active)"],
      totalDeaths: stateDetails["SUM(deaths)"],
    });
  }
);

module.exports = app;
