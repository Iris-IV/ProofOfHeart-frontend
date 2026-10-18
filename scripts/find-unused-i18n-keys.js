const fs = require("fs");
const path = require("path");

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function flattenKeys(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + "." : "";
    if (typeof obj[k] === "object" && obj[k] !== null) {
      Object.assign(acc, flattenKeys(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

function findUnusedKeys() {
  const messagesPath = path.join(__dirname, "../messages/en.json");
  const srcPath = path.join(__dirname, "../src");

  if (!fs.existsSync(messagesPath)) {
    console.error("en.json not found at", messagesPath);
    process.exit(1);
  }

  const enJson = JSON.parse(fs.readFileSync(messagesPath, "utf8"));
  const flatKeys = flattenKeys(enJson);
  const keys = Object.keys(flatKeys);

  const files = getFiles(srcPath);
  const fileContents = files.map((f) => fs.readFileSync(f, "utf8"));

  const unusedKeys = [];

  for (const key of keys) {
    const parts = key.split(".");
    const leaf = parts[parts.length - 1];

    // Check if the leaf key or the full key is present in any file.
    let isUsed = fileContents.some((content) => content.includes(leaf) || content.includes(key));

    // Heuristic for dynamic keys (like step_connect_title or level_Bronze)
    // If the exact leaf is not found, check if its underscore-separated parts are all present in a single file
    if (!isUsed && leaf.includes("_")) {
      const leafParts = leaf.split("_");
      isUsed = fileContents.some((content) => {
        return leafParts.every((p) => content.includes(p));
      });
    }

    if (!isUsed) {
      unusedKeys.push(key);
    }
  }

  if (unusedKeys.length > 0) {
    console.log(`Found ${unusedKeys.length} potentially unused i18n keys:\n`);
    unusedKeys.forEach((k) => console.log(`- ${k}`));
    console.log(
      "\nNote: Some dynamic keys might be incorrectly flagged if they are constructed in complex ways.",
    );
    // Don't exit with error code so it doesn't fail CI if wired later
  } else {
    console.log("No unused i18n keys found! 🎉");
  }
}

findUnusedKeys();
