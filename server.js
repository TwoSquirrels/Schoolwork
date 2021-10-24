/*!
 * server.js in Schoolwork
 *
 * Copyright (c) 2021 TwoSquirrels
 *
 * This source code is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 */

// requires
const path = require("path");
const express = require("express");
const opener = require("opener");

// constants
const root = path.join(__dirname, "docs");
const port = 8080;

// server
const app = express();
app.use(express.static(root, { extensions: ["html", "htm", "md"] }));
app.use((_req, res) => res.status(404).sendFile("404.html", { root }));
console.log("Launching a server...");
let server;
server = app.listen(port, () => {
  console.log("Server has been launched!");
  const url = `http://localhost:${port}/index.md`;
  console.log(`Opening ${url} ...`);
  opener(url);
  process.stdin.setRawMode(true);
  console.log("Press any key to stop the server...");
  process.stdin.once("data", () => {
    process.stdin.setRawMode(false);
    server.close();
    console.log("Server has been closed.");
    process.exit();
  });
});
