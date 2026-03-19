// data.js - VERSÃO SEM DEPENDÊNCIAS EXTERNAS

async function fetchAndProcessChartData(chartType) {
    if (chartsConfig?.[chartType]?.loaded) return true;
    
    const config = chartsConfig?.[chartType];
    const url = `${config.url}&_=${new Date().getTime()}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Could not access spreadsheet for ${config.title}.`);
        }
        
        let csvText = await response.text();
        if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.substring(1);
        }

        const rows = csvText.trim().split('\n').map(row => parseCsvRow(row));
        if (rows.length < 2) {
            throw new Error(`Spreadsheet for ${config.title} doesn't have enough data.`);
        }
        
        const header = rows?.[0]?.map(h => h.toLowerCase().trim());
        const data = rows.slice(1);
        
        const findIndex = (keys) => {
            for (const key of keys) {
                const index = header.indexOf(key);
                if (index !== -1) return index;
            }
            return -1;
        };

        appState.colMaps[chartType] = {
            date: findIndex(['date', 'chart date']),
            position: findIndex(['position', 'rank', 'pos']),
            diff: findIndex(['dif', 'diff', '▲▼']),
            song: findIndex(['song', 'title', 'track']),
            album: findIndex(['album']),
            artist: findIndex(['artist', 'artists']),
            lastWeek: findIndex(['last week', 'lw']),
            peak: findIndex(['peak']),
            weeks: findIndex(['weeks', 'wks']),
            weeksAt1: findIndex(['weeks at 1', 'wks at 1']),
            units: findIndex(['units']),
            totalUnits: findIndex(['total units']),
            certification: findIndex(['certification']),
            year: findIndex(['year', 'ano']),
            chart: findIndex(['chart']),
            item: findIndex(['item']),
            record: findIndex(['record']),
            firstEntry: findIndex(['first entry', 'first', 'debut']),
            peakDate: findIndex(['peak date', 'peakdate', 'date peak']),
            unitsSold: findIndex(['units sold', 'sales', 'total sales'])
        };
        
        if (chartType === 'artistStats') {
            appState.artistDetailsData = {};
            data.forEach(row => {
                const artistName = row[appState.colMaps.artistStats.artist];
                if (!artistName) return;
                const chartTypeEntry = row[appState.colMaps.artistStats.chart];
                const itemName = row[appState.colMaps.artistStats.item];
                const peak = parseInt(row[appState.colMaps.artistStats.peak]);
                const weeks = parseInt(row[appState.colMaps.artistStats.weeks]);
                const unitsSold = row[appState.colMaps.artistStats.unitsSold] || null;
                const firstEntry = row[appState.colMaps.artistStats.firstEntry] || null;
                const peakDate = row[appState.colMaps.artistStats.peakDate] || null;

                if (!appState.artistDetailsData[artistName]) {
                    appState.artistDetailsData[artistName] = {
                        'Hot 100 Songs': [],
                        'Top 100 Albums': [],
                        'Top 50 Artists': [],
                    };
                }

                if (appState.artistDetailsData[artistName][chartTypeEntry]) {
                    appState.artistDetailsData[artistName][chartTypeEntry].push({
                        item: itemName,
                        peak: peak,
                        weeks: weeks,
                        unitsSold: unitsSold,
                        firstEntry: firstEntry,
                        peakDate: peakDate,
                        chartType: chartTypeEntry
                    });
                }
            });

            for (const artist in appState.artistDetailsData) {
                for (const chart in appState.artistDetailsData[artist]) {
                    const entries = appState.artistDetailsData[artist][chart];
                    let numberOnes = 0;
                    let topTens = 0;

                    entries.sort((a, b) => {
                        if (a.peak !== b.peak) {
                            return a.peak - b.peak;
                        }
                        if (a.weeks !== b.weeks) {
                            return b.weeks - a.weeks;
                        }
                        return a.item.localeCompare(b.item);
                    });

                    entries.forEach(entry => {
                        if (entry.peak === 1) numberOnes++;
                        if (entry.peak >= 1 && entry.peak <= 10) topTens++;
                    });

                    appState.artistDetailsData[artist][chart] = {
                        entries: entries,
                        count: entries.length,
                        numberOnes: numberOnes,
                        topTens: topTens
                    };
                }
            }
        } else if (chartType.includes('yearEnd')) {
            const yearIndex = appState.colMaps[chartType].year;
            
            if (yearIndex === -1) {
                throw new Error(`Year column not found for ${config.title}.`);
            }
            
            const dataByYear = {};
            
            data.forEach(row => {
                const year = row[yearIndex];
                if (!year) return;
                
                if (!dataByYear[year]) {
                    dataByYear[year] = [];
                }
                
                dataByYear[year].push(row);
            });
            
            appState.chartData[chartType] = dataByYear;
            
            const years = Object.keys(dataByYear).sort((a, b) => b - a);
            const mostRecentYear = years?.[0] || new Date().getFullYear().toString();
            
            if (mostRecentYear && dataByYear[mostRecentYear]) {
                appState.top3Data[chartType] = dataByYear[mostRecentYear]
                    .slice(0, 3)
                    .map(row => {
                        const colMap = appState.colMaps[chartType];
                        const name = chartType === 'yearEndSongs' ? row[colMap.song] : 
                                     chartType === 'yearEndAlbums' ? row[colMap.album] : 
                                     row[colMap.artist];
                        return {
                            position: row[colMap.position] || 0,
                            artist: row[colMap.artist] || 'Unknown',
                            name: name || 'Unknown',
                            year: mostRecentYear
                        };
                    });
            }
        } else if (chartType.includes('goat')) {
            if (data.length > 0) {
                appState.chartData[chartType] = data;
                
                const colMap = appState.colMaps[chartType];
                appState.top3Data[chartType] = data.slice(0, 3)
                    .map(row => {
                        const name = chartType.includes('Songs') ? row[colMap.song] : 
                                     chartType.includes('Albums') ? row[colMap.album] : 
                                     row[colMap.artist];
                        return {
                            position: row[colMap.position] || 0,
                            artist: row[colMap.artist] || 'Unknown',
                            name: name || 'Unknown',
                            year: row[colMap.year] || 'N/A'
                        };
                    });
            }
        } else {
            const dateIndex = appState.colMaps[chartType].date;
            
            if (dateIndex === -1) {
                throw new Error(`Date column not found for ${config.title}.`);
            }
            
            let dateGroups = {};
            const dateMap = {};
            
            data.forEach(row => {
                const originalDate = row[dateIndex];
                if (!originalDate) return;
                
                let standardizedDate = originalDate;
                if (originalDate.includes('/')) {
                    const dateParts = originalDate.split('/');
                    if (dateParts.length === 3) {
                        standardizedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                        
                        if (!dateMap[standardizedDate]) {
                            dateMap[standardizedDate] = originalDate;
                        }
                        
                        row[dateIndex] = standardizedDate;
                    }
                }
            });
            
            data.forEach(row => {
                const date = row[dateIndex];
                if (!date) return;
                
                if (!dateGroups[date]) {
                    dateGroups[date] = [];
                }
                
                dateGroups[date].push(row);
            });
            
            const sortedDates = Object.keys(dateGroups).sort((a, b) => {
                return new Date(a) - new Date(b);
            });
            
            sortedDates.forEach(date => {
                appState.chartData[chartType][date] = dateGroups[date];
            });

            if (['songs', 'artists', 'albums'].includes(chartType)) {
                appState.allEntries[chartType] = [];
                const uniqueEntries = new Set();
                
                sortedDates.forEach(date => {
                    dateGroups[date].forEach(row => {
                        const colMap = appState.colMaps[chartType];
                        const name = chartType === 'songs' ? row[colMap.song] : 
                                  chartType === 'albums' ? row[colMap.album] : 
                                  row[colMap.artist];
                        const artist = row[colMap.artist] || 'Unknown';
                        
                        const entryKey = `${name.toLowerCase()}_${artist.toLowerCase()}`;
                        
                        if (!uniqueEntries.has(entryKey)) {
                            uniqueEntries.add(entryKey);
                            
                            const entry = {
                                name: name,
                                artist: artist,
                                peak: colMap.peak !== -1 ? row[colMap.peak] : null,
                                weeks: colMap.weeks !== -1 ? row[colMap.weeks] : null,
                                weeksAt1: colMap.weeksAt1 !== -1 ? row[colMap.weeksAt1] : null
                            };
                            appState.allEntries[chartType].push(entry);
                        }
                    });
                });
            }

            appState.chartRunData[chartType] = {};
            data.forEach(row => {
                const colMap = appState.colMaps[chartType];
                const date = row[colMap.date];
                if (!date) return;
                const name = row[colMap.song] || row[colMap.album] || row[colMap.artist];
                const artist = row[colMap.artist] || 'Unknown';
                const key = `${name.toLowerCase()}:${artist.toLowerCase()}`;
                const position = parseInt(row[colMap.position]);
                const peak = parseInt(row[colMap.peak]);
                const weeks = parseInt(row[colMap.weeks]);

                if (!appState.chartRunData[chartType][key]) {
                    appState.chartRunData[chartType][key] = [];
                }

                appState.chartRunData[chartType][key].push({
                    date: date,
                    position: position,
                    peak: peak,
                    weeks: weeks,
                    name: name,
                    artist: artist
                });
            });

            for (const key in appState.chartRunData[chartType]) {
                appState.chartRunData[chartType][key].sort((a,b) => {
                    return new Date(a.date) - new Date(b.date);
                });
            }

            const dates = Object.keys(appState.chartData[chartType]);
            if (dates.length > 0) {
                const mostRecentDate = dates[dates.length - 1];
                const recentData = appState.chartData[chartType][mostRecentDate];
                
                if (recentData && recentData.length > 0) {
                    const colMap = appState.colMaps[chartType];
                    appState.top3Data[chartType] = recentData
                        .sort((a, b) => parseInt(a[colMap.position]) - parseInt(b[colMap.position]))
                        .slice(0, 3)
                        .map(row => {
                            const name = chartType === 'songs' ? row[colMap.song] : 
                                         chartType === 'albums' ? row[colMap.album] : 
                                         row[colMap.artist];
                            return {
                                position: row[colMap.position] || 0,
                                artist: row[colMap.artist] || 'Unknown',
                                name: name || 'Unknown',
                                weeksAt1: row[colMap.weeksAt1] || 0
                            };
                        });
                }
            }
        }
        
        chartsConfig[chartType].loaded = true;
        return true;
    } catch (error) {
        console.error(`Error processing ${chartType} data:`, error);
        return false;
    }
}

async function fetchAndProcessChartBeatData() {
    for (const [key, config] of Object.entries(chartBeatConfig)) {
        try {
            const response = await fetch(config.url);
            if (!response.ok) {
                throw new Error(`Could not access spreadsheet for ${config.title}.`);
            }
            
            let csvText = await response.text();
            if (csvText.charCodeAt(0) === 0xFEFF) {
                csvText = csvText.substring(1);
            }

            const rows = csvText.trim().split('\n').map(row => parseCsvRow(row));
            if (rows.length < 2) {
                throw new Error(`Spreadsheet for ${config.title} doesn't have enough data.`);
            }
            
            const header = rows[0].map(h => h.toLowerCase().trim());
            const data = rows.slice(1);
            
            const processedData = data.map(row => {
                const findIndex = (keys) => {
                    for (const k of keys) {
                        const index = header.indexOf(k);
                        if (index !== -1) return index;
                    }
                    return -1;
                };

                const dateIndex = findIndex(config.colMap.date);
                const titleIndex = findIndex(config.colMap.title);
                const textIndex = findIndex(config.colMap.text);
                const artistIndex = findIndex(config.colMap.artist);
                const chartLinkIndex = findIndex(config.colMap.chartLink);
                
                const publicationDate = row[dateIndex] || 'NO DATE';
                const title = row[titleIndex] || 'NO TITLE';
                const fullText = row[textIndex] || 'No content available.';
                const artist = row[artistIndex] || null;
                const chartLink = row[chartLinkIndex] || null;
                
                return {
                    title,
                    publicationDate,
                    artist,
                    fullText,
                    chartLink,
                    imageUrl: null
                };
            });
            
            appState.chartBeatData[key] = processedData.reverse();
            
        } catch (error) {
            console.error(`Error processing ${key} blog data:`, error);
            appState.chartBeatData[key] = [];
        }
    }
}
