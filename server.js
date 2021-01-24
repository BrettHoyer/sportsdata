/** @format */

// const json2csv = require("json2csv").parse;

// const csvString = json2csv(yourDataAsArrayOfObjects);
// res.setHeader("Content-disposition", "attachment; filename=shifts-report.csv");
// res.set("Content-Type", "text/csv");
// res.status(200).send(csvString);
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const axios = require("axios");
const cheerio = require("cheerio");
const axiosRetry = require("axios-retry");
axiosRetry(axios, { retries: 3 });
const moment = require("moment");
const { convertArrayToCSV } = require("convert-array-to-csv");
const port = process.env.PORT || 8080;
const path = require("path");
const { Parser } = require("json2csv");
const url = require("url");
const querystring = require("querystring");

const downloadResource = (res, fileName, fields, data) => {
  const json2csv = new Parser({ fields });
  const csv = json2csv.parse(data);
  res.header("Content-Type", "text/csv");
  res.attachment(fileName);
  return res.send(csv);
};

const getAllData = async (formData) => {
  console.log("formData", formData);
  let date = Date.parse(formData.startDate);
  console.log("date", date);
  const endDate = moment(formData.endDate, ["YYYY-MM-DD"]).valueOf();
  console.log("endDate", endDate);

  const urls = [];
  const data = [];

  let baseURl = "https://www.covers.com/sports/ncaab/matchups?selectedDate=";

  while (date < endDate) {
    const urlDate = moment(date).format("YYYY-MM-DD");
    console.log("urlDate", urlDate);
    const url = baseURl + urlDate;
    console.log("url", url);

    urls.push(url);

    date = moment(date).add(1, "day").valueOf();
  }

  const requests = urls.map((url) => axios.get(url));
  //   console.log(requests);
  const response = await axios.all(requests).catch(console.error);
  //   console.log(response);

  response.forEach((resp) => {
    const parsedUrl = url.parse(resp.config.url);
    const qs = querystring.parse(parsedUrl.query);
    console.log("selectedDate of request", qs.selectedDate);
    const $ = cheerio.load(resp.data);

    $(".cmg_matchup_game_box.cmg_game_data").each((idx, node) => {
      const date = $(node).data("game-date");
      if (date.indexOf(qs.selectedDate) > -1) {
        const odds = $(node).data("game-odd");
        const homeName = $(node).data("home-team-fullname-search");
        const awayName = $(node).data("away-team-fullname-search");
        const homeScore = $(node).data("home-score");
        const awayScore = $(node).data("away-score");
        data.push({ date, odds, homeScore, awayScore, homeName, awayName });
      }
    });
  });

  // console.log("data", data);

  // console.log("CSV", convertArrayToCSV(data));
  return convertArrayToCSV(data);
};

app.post("/download", (req, res) => {
  getAllData({ ...req.body }).then((data) => {
    res.header("Content-Type", "text/csv");
    res.attachment("beefy.csv");
    return res.send(data);
  });
});

app.use(express.static(path.join(`${__dirname}/`, "build")));

app.get("/*", (req, res) => {
  res.sendFile(path.join(`${__dirname}/`, "index.html"));
});

// console.log(urls);

// getAllData();

app.listen(port);
