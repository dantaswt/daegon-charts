import { loadChart } from "./data.js";
import { renderChart } from "./render.js";

const app = document.getElementById("app");

async function init() {
  await loadChart("songs");
  app.innerHTML = `
    <h2 class="text-xl font-bold mb-4">Hot 100</h2>
    ${renderChart("songs")}
  `;
}

init();
