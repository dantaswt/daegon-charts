import { chartsConfig } from "./config.charts.js";
import { appState } from "./state.js";
import { parseCsvRow } from "./csv.js";

export async function loadChart(chartKey) {
  const res = await fetch(chartsConfig[chartKey].url);
  const csv = await res.text();

  const rows = csv.trim().split("\n").map(parseCsvRow);
  const header = rows[0].map(h => h.toLowerCase());

  const data = rows.slice(1);
  appState.chartData[chartKey] = data;

  appState.colMaps[chartKey] = {
    position: header.indexOf("position"),
    artist: header.indexOf("artist"),
    song: header.indexOf("song"),
    album: header.indexOf("album")
  };

  appState.top3Data[chartKey] = data.slice(0, 3);
}
