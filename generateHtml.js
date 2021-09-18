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
  console.log("START!");

  await fs.emptyDir("docs");

  const sitemap = [];

  await Promise.all(
    (
      await find(path.join("resource", process.argv?.[2] ?? "", "/**/*.md"))
    ).map(async (md) => {
      console.log(`started mume("${md}").`);

      const mdPath = md.replace(/^resource\/|\.md$/g, "");

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
        filePath: md,
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

      console.log(`finished mume("${md}").`);
    })
  );

  // generate config file
  await fs.promises.writeFile("docs/_config.yml", "theme: jekyll-theme-merlot", "utf-8");

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
