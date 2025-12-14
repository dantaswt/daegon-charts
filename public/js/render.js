import { appState } from "./state.js";

export function renderChart(chartKey) {
  const data = appState.chartData[chartKey];
  const col = appState.colMaps[chartKey];

  return data
    .slice(0, 100)
    .map(row => `
      <div class="flex gap-4 border-b py-3">
        <div class="font-bold w-8">${row[col.position]}</div>
        <div>
          <div class="font-semibold">
            ${row[col.song] || row[col.album] || row[col.artist]}
          </div>
          <div class="text-sm text-gray-500">${row[col.artist]}</div>
        </div>
      </div>
    `)
    .join("");
}
