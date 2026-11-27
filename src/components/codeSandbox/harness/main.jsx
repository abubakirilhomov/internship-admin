// Тестовая обвязка (только для sandpack.browser.test.js): боевой SandpackAnswerRunner на странице
// с «токеном» в storage. В прод-бандл не попадает.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import SandpackAnswerRunner from "../SandpackAnswerRunner";

const TOKEN = "SECRET-TOKEN-7f3a";
localStorage.setItem("token", TOKEN);
sessionStorage.setItem("token", TOKEN);
document.cookie = `sid=${TOKEN}; path=/`;

function Host() {
  const [s, set] = useState(() => {
    const q = new URLSearchParams(location.search);
    return { editor: q.get("editor") || "jsx", code: q.get("code") || "" };
  });
  window.__setSandbox = set;
  return <div style={{ maxWidth: 720, padding: 16 }}><SandpackAnswerRunner editor={s.editor} code={s.code} /></div>;
}
createRoot(document.getElementById("root")).render(<Host />);
