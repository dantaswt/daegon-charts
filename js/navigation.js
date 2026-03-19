// --- NAVIGATION FUNCTIONS ---
function navigateBack() {
    const previousState = appState.navigationHistory.pop();
    
    if (previousState) {
        if (previousState.view === 'chart') {
            appState.activeChart = previousState.chart;
            appState.currentDate = previousState.date;
            appState.currentYear = previousState.year;
            appState.currentView = 'chart';
            showChartPage(previousState.chart);
        } else if (previousState.view === 'artist') {
            const lastNav = appState.navigationHistory?.[appState.navigationHistory.length - 1];
            if (lastNav && lastNav.view === 'allArtists') {
                showAllArtistsPage();
            } else if (lastNav && lastNav.view === 'allEntriesList') {
                showAllEntriesPage();
            } else if (lastNav && lastNav.view === 'chart') {
                showChartPage(lastNav.chart);
            } else {
                renderHomePage();
            }
        } else if (previousState.view === 'allEntries') {
            showAllEntriesPage();
        } else if (previousState.view === 'chartBeat') {
            showChartBeatPage();
        } else if (previousState.view === 'allEntriesList') {
            if (previousState.entryType === 'artists') {
                showAllArtistsPage();
            } else {
                showAllEntriesPage();
            }
        } else if (previousState.view === 'allArtists') {
            showAllEntriesPage();
        } else {
            renderHomePage();
        }
    } else {
        renderHomePage();
    }
}

function goToChartWeek(chartType, date) {
    appState.navigationHistory.push({
        view: 'chart',
        chart: appState.activeChart,
        date: appState.currentDate,
        year: appState.currentYear
    });
    
    appState.currentDate = date;
    appState.sharedDate = date;
    showChartPage(chartType, date);
    itemDetailsModal.classList.remove('active');
}

function navigateToPrevWeek() {
    const chartType = appState.activeChart;
    const dates = Object.keys(appState.chartData[chartType]).sort();
    const currentIndex = dates.indexOf(appState.currentDate);
    
    if (currentIndex > 0) {
        appState.currentDate = dates[currentIndex - 1];
        appState.sharedDate = appState.currentDate;
        
        const otherCharts = ['songs', 'artists', 'albums'].filter(c => c !== chartType);
        for(const otherChart of otherCharts) {
            if (appState.chartData[otherChart][appState.sharedDate]) {
                appState.chartData[otherChart].activeDate = appState.sharedDate;
            }
        }
        
        document.getElementById('chartContainer').innerHTML = renderChartItems();
        updateWeekNavButtons();
        loadSpotifyImages();
        
        if (window.flatpickr && document.getElementById('weekSelector')) {
            const datePicker = document.getElementById('weekSelector')._flatpickr;
            if (datePicker) {
                datePicker.setDate(appState.currentDate);
            }
        }
    }
}

function navigateToNextWeek() {
    const chartType = appState.activeChart;
    const dates = Object.keys(appState.chartData[chartType]).sort();
    const currentIndex = dates.indexOf(appState.currentDate);
    
    if (currentIndex < dates.length - 1) {
        appState.currentDate = dates[currentIndex + 1];
        appState.sharedDate = appState.currentDate;
        
        const otherCharts = ['songs', 'artists', 'albums'].filter(c => c !== chartType);
        for(const otherChart of otherCharts) {
            if (appState.chartData[otherChart][appState.sharedDate]) {
                appState.chartData[otherChart].activeDate = appState.sharedDate;
            }
        }
        
        document.getElementById('chartContainer').innerHTML = renderChartItems();
        updateWeekNavButtons();
        loadSpotifyImages();
        
        if (window.flatpickr && document.getElementById('weekSelector')) {
            const datePicker = document.getElementById('weekSelector')._flatpickr;
            if (datePicker) {
                datePicker.setDate(appState.currentDate);
            }
        }
    }
}

function updateWeekNavButtons() {
    const chartType = appState.activeChart;
    const dates = Object.keys(appState.chartData[chartType]).sort();
    const currentIndex = dates.indexOf(appState.currentDate);
    
    const prevBtn = document.getElementById('prevWeekBtn');
    const nextBtn = document.getElementById('nextWeekBtn');
    const bottomPrevBtn = document.getElementById('bottomPrevWeekBtn');
    const bottomNextBtn = document.getElementById('bottomNextWeekBtn');
    
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= dates.length - 1;
    if (bottomPrevBtn) bottomPrevBtn.disabled = currentIndex <= 0;
    if (bottomNextBtn) bottomNextBtn.disabled = currentIndex >= dates.length - 1;
}
