/*!
 * generateHtml.js in Schoolwork
 *
 * Copyright (c) 2021 TwoSquirrels
 *
 * This source code is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 */

const fs = require("fs-extra");
const glob = require("glob");
const mume = require("@shd101wyy/mume");
const path = require("path");
const util = require("util");

const find = util.promisify(glob);

(async () => {
  const configPath = path.resolve(__dirname, ".mume");
  await mume.init(configPath);
  console.log("START!\n");

  await fs.emptyDir("docs");

  const sitemap = [];
  const logLines = [];
  class GraphLine {
    constructor() {
      this.logLine = logLines.findIndex((line) => !line);
      if (this.logLine === -1) this.logLine = logLines.push(true) - 1;
      else logLines[this.logLine] = true;
    }
    log(message, finish = false) {
      console.log(
        logLines.reduce(
          (acc, line, index) =>
            index < this.logLine ? acc + (line ? "| " : "  ") : acc,
          " "
        ) + message.replace(/\n/, " ") ?? ""
      );
      if (finish) {
        if (logLines.indexOf(true, this.logLine + 1) === -1)
          logLines.splice(this.logLine, logLines.length);
        else logLines[this.logLine] = false;
      }
      console.log(
        logLines.reduce((acc, line) => acc + (line ? "| " : "  "), " ")
      );
    }
  }

  await Promise.all(
    (
      await find(path.join("resource", process.argv?.[2] ?? "", "/**/*"), {
        nodir: true,
      })
    ).map(async (file) => {
      const graphLine = new GraphLine();

      if (file.endsWith(".md")) {
        graphLine.log(`Started to convert "${file}" to html with mume.`);

        const mdPath = file.replace(/^resource\/|\.md$/g, "");

        // update sitemap
        let current = sitemap;
        path
          .dirname(mdPath)
          .split("/")
          .forEach((dir) => {
            const matchings = current.filter((item) => item.name === dir);
            if (matchings.length) current = matchings[0].dir;
            else {
              current.push({
                name: dir,
                dir: [],
              });
              current = current.filter((item) => item.name === dir)[0].dir;
            }
          });
        current.push({
          name: mdPath,
          dir: false,
        });

        // generate html file from markdown file
        await new mume.MarkdownEngine({
          filePath: file,
          config: {
            configPath,
          },
        }).htmlExport({ offline: false, runAllCodeChunks: true });

        // move this html file into the docs directory
        await fs.move(`resource/${mdPath}.html`, `docs/${mdPath}.html`);

        // add noindex
        await fs.promises.writeFile(
          `docs/${mdPath}.html`,
          (
            await fs.promises.readFile(`docs/${mdPath}.html`, "utf-8")
          ).replace(
            /<title>/,
            '<meta name="robots" content="noindex">\n      <title>'
          ),
          "utf-8"
        );

        graphLine.log(`Finished converting "${file}".`, true);
      } else if (!path.basename(file).startsWith("_")) {
        graphLine.log(`Started to copy "${file}".`);

        await fs.copy(file, file.replace(/resource/, "docs"));

        graphLine.log(`Finished copying "${file}".`, true);
      }
    })
  );

  // generate config file
  await fs.promises.writeFile(
    "docs/_config.yml",
    "theme: jekyll-theme-merlot",
    "utf-8"
  );

  // generate index page
  let index = `\
# りすりすの勉強部屋

## 暗記用 (赤シート対応)

`;
  (function mapping(current, depth) {
    current.forEach((item) => {
      if (item.dir) {
        index += `${"  ".repeat(depth)}- ${item.name}\n`;
        mapping(item.dir, depth + 1);
      } else
        index += `${"  ".repeat(depth)}- [${path.basename(item.name)}](${
          item.name
        })\n`;
    });
  })(sitemap, 0);
  await fs.promises.writeFile("docs/index.md", index, "utf-8");

  console.log("DONE!");
  process.exit();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
