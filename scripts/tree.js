const fs = require("fs");
const path = require("path");

function buildTree(dir, prefix = "") {
  const files = fs.readdirSync(dir);

  files.forEach((file, index) => {
    const fullPath = path.join(dir, file);
    const isLast = index === files.length - 1;

    console.log(prefix + (isLast ? "└── " : "├── ") + file);

    if (fs.statSync(fullPath).isDirectory()) {
      buildTree(fullPath, prefix + (isLast ? "    " : "│   "));
    }
  });
}

buildTree("./src");