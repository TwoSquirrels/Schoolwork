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
          (await fs.promises.readFile(`docs/${mdPath}.html`, "utf-8"))
            .replace(
              /<title>/,
              '<meta name="robots" content="noindex">\n      ' +
                ["", "/typography.css", "/forms.css"]
                  .map(
                    (css) =>
                      `<link href="https://unpkg.com/sanitize.css${css}" rel="stylesheet" />`
                  )
                  .join("\n      ") +
                "\n      <title>"
            )
            .replace(
              /<\/body>/,
              "<footer>\n" +
                // home
                `<div class="back"><a href="${"../".repeat(
                  (mdPath.match(/\//g) ?? []).length
                )}">&lt; 入口へ</a></div>\n` +
                (mdPath.match(/^暗記用\//)
                  ? // switch
                    '<button class="switch" onclick="' +
                    "document.querySelector('.mume').classList.toggle('hidered')" +
                    '">赤文字</button>\n' +
                    // sizing script
                    "<script>\n" +
                    "let size = 14;\n" +
                    "function sizing(move) {\n" +
                    "  size += move;\n" +
                    "  if (size <= 10) {\n" +
                    "    size = 10;\n" +
                    '    document.querySelector("footer .small").classList.add("limiting");\n' +
                    '  } else document.querySelector("footer .small").classList.remove("limiting");\n' +
                    "  if (size >= 18) {\n" +
                    "    size = 18;\n" +
                    '    document.querySelector("footer .big").classList.add("limiting");\n' +
                    '  } else document.querySelector("footer .big").classList.remove("limiting");\n' +
                    '  document.querySelector(".mume").style.setProperty("font-size", `${size}px`, "important");\n' +
                    '  docunent.querySelectorAll(".mume img").forEach((img) => {\n' +
                    '    img.style.setAttribute("width", `{img.naturalWidth * size / 14}px`);\n' +
                    '    img.style.setAttribute("height", `{img.naturalHeight * size / 14}px`);\n' +
                    "  });\n" +
                    "}\n" +
                    "</script>\n" +
                    // small
                    '<button class="small" onclick="sizing(-1)">-</button>\n' +
                    // big
                    '<button class="big" onclick="sizing(1)">+</button>\n'
                  : "") +
                "</footer>\n</body>"
            ) + "\n",
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
  function mapping(mapPath) {
    let md = "";
    try {
      (function recursive(current, depth = 0) {
        current.forEach((item) => {
          if (item.dir) {
            md += `${"  ".repeat(depth)}- ${item.name}\n`;
            recursive(item.dir, depth + 1);
          } else
            md += `${"  ".repeat(depth)}- [${path.basename(item.name)}](${
              item.name
            }.html)\n`;
        });
      })(
        mapPath === ""
          ? sitemap
          : mapPath
              .split("/")
              .reduce(
                (previous, current) =>
                  previous.find((dir) => dir.name === current).dir,
                sitemap
              )
      );
    } catch (_err) {
      return "虚無";
    }
    return md;
  }
  await fs.promises.writeFile(
    "docs/index.md",
    `\
# りすりすの勉強部屋

## 暗記用

印刷すれば赤シートが使えるよ！  

${mapping("暗記用")}
## りすりすの巣の入口へ

<a href="//twosquirrels.pages.dev/">https://twosquirrels.pages.dev/</a>
`,
    "utf-8"
  );

  console.log("DONE!");
  process.exit();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
