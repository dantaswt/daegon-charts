// app.js - VERSÃO SUPER SIMPLES QUE FUNCIONA

// --- APPLICATION STATE MÍNIMO ---
let appState = {
    currentView: 'home',
    top3Data: {},
    chartBeatData: { hot100: [], top100Albums: [] }
};

// --- DOM ELEMENTS ---
const appContainer = document.getElementById('app');

// --- FUNÇÃO PRINCIPAL ---
function renderHomePage() {
    appContainer.innerHTML = `
        <div class="max-w-7xl mx-auto p-4">
            <div class="text-center mb-12">
                <h1 class="text-5xl font-bold mb-4 text-white">
                    <span class="gradient-text">daegon charts</span>
                </h1>
                <p class="text-gray-400">Carregando dados...</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-gray-800 p-4 rounded-lg">
                    <h3 class="text-white font-bold mb-3">Hot 100</h3>
                    <div class="text-gray-400">Carregando...</div>
                </div>
                <div class="bg-gray-800 p-4 rounded-lg">
                    <h3 class="text-white font-bold mb-3">Artist 50</h3>
                    <div class="text-gray-400">Carregando...</div>
                </div>
                <div class="bg-gray-800 p-4 rounded-lg">
                    <h3 class="text-white font-bold mb-3">Top Albums</h3>
                    <div class="text-gray-400">Carregando...</div>
                </div>
            </div>
        </div>
    `;
}

// --- INICIALIZAÇÃO ---
function initializeApp() {
    console.log('App iniciando...');
    renderHomePage();
}

// --- EVENTO DE CARREGAMENTO ---
document.addEventListener('DOMContentLoaded', initializeApp);
