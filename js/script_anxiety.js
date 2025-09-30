// Error handling function
function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    console.error(message);
}

// Initialize the map
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            osm: {
                type: 'raster',
                tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256
            }
        },
        layers: [
            {
                id: 'osm-layer',
                type: 'raster',
                source: 'osm',
                minzoom: 0,
                maxzoom: 19,
                paint: {
                    'raster-opacity': 0.6
                }
            }
        ]
    },
    center: [12, 49],  // Center map over Europe
    zoom: 2.9,
    pitch: 40,         // Enable 3D view
    bearing: 0,
    antialias: true
});

// Add map controls
map.addControl(new maplibregl.NavigationControl());
map.addControl(new maplibregl.ScaleControl({
    maxWidth: 100,
    unit: 'metric'
}), 'bottom-right');

// Color scale for the data
const COLOR_SCALE = {
    low: '#fef0d9',
    mediumLow: '#fdcc8a',
    medium: '#fc8d59',
    mediumHigh: '#e34a33',
    high: '#b30000'
};

function getColorScale() {
    return [
        'step', ['coalesce', ['get', 'Anxiety'], 0],
        COLOR_SCALE.low, 32, COLOR_SCALE.mediumLow, 43, COLOR_SCALE.medium, 54, COLOR_SCALE.mediumHigh, 65, COLOR_SCALE.high
    ];
}

// Application state
const yearData = {};
let allYears = [];
let currentYear = 1990;
let isPlaying = false;
let animationInterval;
let speed = 5;
let trendChart = null;
let selectedCountry = null;
const extrusionState = {};

// Initialize the timeline
function initializeTimeline() {
    const yearsContainer = document.querySelector('.timeline-years');
    yearsContainer.innerHTML = '';
    
    allYears.forEach(year => {
        const yearElement = document.createElement('div');
        yearElement.className = 'year-marker';
        if (year === currentYear) yearElement.classList.add('active');
        yearElement.textContent = year;
        yearElement.addEventListener('click', () => {
            if (isPlaying) {
                stopAnimation();
                document.getElementById('play-icon').textContent = '▶';
            }
            currentYear = year;
            updateYearDisplay();
            updateMapData();
            highlightCurrentYear();
        });
        yearsContainer.appendChild(yearElement);
    });
    
    centerCurrentYear();
}

function centerCurrentYear() {
    const timelineScroll = document.querySelector('.timeline-scroll');
    const activeYear = document.querySelector('.year-marker.active');
    if (activeYear) {
        const scrollLeft = activeYear.offsetLeft - (timelineScroll.offsetWidth / 2) + (activeYear.offsetWidth / 2);
        timelineScroll.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
        });
    }
}

function highlightCurrentYear() {
    document.querySelectorAll('.year-marker').forEach(marker => {
        marker.classList.remove('active');
        if (parseInt(marker.textContent) === currentYear) {
            marker.classList.add('active');
        }
    });
    centerCurrentYear();
}

// Constants for button text
const BUTTON_TEXT = {
    SHOW_STATS: 'Show Distribution 📉',
    HIDE_STATS: 'Hide Distribution 📉',
    PLAY: '▶',
    PAUSE: '❚❚'
};

// Timeline controls
function setupControls() {
    const playButton = document.getElementById('play-button');
    const prevButton = document.getElementById('prev-year');
    const nextButton = document.getElementById('next-year');
    const speedSlider = document.getElementById('speed-slider');
    const showStatsButton = document.getElementById('show-stats-button');
    const toggle3DButton = document.getElementById('toggle-3d-button');
    
    // Play/Pause button
    playButton.addEventListener('click', () => {
        isPlaying = !isPlaying;
        const playIcon = document.getElementById('play-icon');
        playIcon.textContent = isPlaying ? '❚❚' : '▶';
        
        if (isPlaying) {
            startAnimation();
        } else {
            stopAnimation();
        }
    });
    
    // Previous year button
    prevButton.addEventListener('click', () => {
        if (isPlaying) {
            stopAnimation();
            document.getElementById('play-icon').textContent = '▶';
        }
        const currentIndex = allYears.indexOf(currentYear);
        if (currentIndex > 0) {
            currentYear = allYears[currentIndex - 1];
            updateYearDisplay();
            updateMapData();
            highlightCurrentYear();
        }
    });
    
    // Next year button
    nextButton.addEventListener('click', () => {
        if (isPlaying) {
            stopAnimation();
            document.getElementById('play-icon').textContent = '▶';
        }
        const currentIndex = allYears.indexOf(currentYear);
        if (currentIndex < allYears.length - 1) {
            currentYear = allYears[currentIndex + 1];
            updateYearDisplay();
            updateMapData();
            highlightCurrentYear();
        }
    });
    
    // Speed slider
    speedSlider.addEventListener('input', () => {
        speed = parseInt(speedSlider.value);
        document.getElementById('speed-value').textContent = `${speed}x`;
        
        if (isPlaying) {
            stopAnimation();
            startAnimation();
        }
    });
    
    // Show statistics button
    showStatsButton.addEventListener('click', () => {
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer.style.display === 'none') {
            chartContainer.style.display = 'block';
            showStatsButton.textContent = 'Hide Distribution 📉';
        } else {
            chartContainer.style.display = 'none';
            showStatsButton.textContent = 'Show Distribution 📉';
        }
    });

    // Show info button

    // Toggle 3D view button
    toggle3DButton.addEventListener('click', () => {
        const is3DEnabled = map.getPaintProperty('data-extrusion', 'fill-extrusion-height') !== 0;
        if (is3DEnabled) {
            map.setPaintProperty('data-extrusion', 'fill-extrusion-height', 0);
            map.setPaintProperty('data-extrusion', 'fill-extrusion-opacity', 0);
            toggle3DButton.textContent = '2D View 🗺️';
        } else {
            map.setPaintProperty('data-extrusion', 'fill-extrusion-height', [
                '*', ['coalesce', ['get', 'Anxiety'], 0], 5000
            ]);
            map.setPaintProperty('data-extrusion', 'fill-extrusion-opacity', 1);
            toggle3DButton.textContent = '3D View 🌐';
        }
    });
}

// Animation control
function startAnimation() {
    const delay = 1100 - (speed * 100); // Faster with higher speed
    
    animationInterval = setInterval(() => {
        const currentIndex = allYears.indexOf(currentYear);
        const nextIndex = (currentIndex + 1) % allYears.length;
        
        if (nextIndex === 0) {
            currentYear = allYears[0];
            stopAnimation();
            document.getElementById('play-icon').textContent = '▶';
        } else {
            currentYear = allYears[nextIndex];
        }
        
        updateYearDisplay();
        updateMapData();
        highlightCurrentYear();
    }, delay);
}

function stopAnimation() {
    clearInterval(animationInterval);
    isPlaying = false;
}

// Update display functions
function updateYearDisplay() {
    document.getElementById('current-year').textContent = currentYear;
    // document.getElementById('map-title').textContent = `Anxiety Disorders (${currentYear})`;
}

function updateMapData() {
    if (!yearData[currentYear]) return;
    
    // Update the source data
    map.getSource('current-data').setData(yearData[currentYear]);
    
    // Update trend chart
    updateTrendChart();
}

// Map interaction
function setupExtrusionInteraction() {
    // Click handler for both layers
    map.on('click', ['data-fill', 'data-extrusion'], (e) => {
        if (!e.features || e.features.length === 0) return;
        
        const feature = e.features[0];
        const featureId = feature.id || feature.properties?.NAME_ENGL || 'unknown';
        const anxiety = feature.properties?.Anxiety || 0;
        
        // Set the selected country
        selectedCountry = feature.properties?.NAME_ENGL;
        
        // Toggle extrusion
        const isExtruded = !extrusionState[featureId];
        
        // Set extrusion properties
        map.setPaintProperty('data-extrusion', 'fill-extrusion-opacity', isExtruded ? 1 : 0);
        map.setPaintProperty('data-extrusion', 'fill-extrusion-height', [
            'case',
            ['==', ['id'], featureId],
            isExtruded ? anxiety * 5000 : 0,
            0
        ]);
        
        extrusionState[featureId] = isExtruded;
        
        // Show popup
        new maplibregl.Popup({ offset: 25 })
            .setLngLat(e.lngLat)
            .setHTML(`
                <h2>${feature.properties?.NAME_ENGL || 'Unknown'} (${currentYear})</h2>
                <p>Anxiety Disorders (${currentYear}): <h3> ${anxiety.toFixed(2)} <small>Cases per 1000 people</small> </h3></p>
                <footer><em>Data: <a href='https://ourworldindata.org/grapher/prevalence-by-mental-and-substance-use-disorder?time=earliest..2019' target="_blank">IHME, Global Burden of Disease (2024) – with major processing by Our World in Data</em></a></footer> <br>
                <footer><small>Click to ${isExtruded ? 'flatten' : 'extrude'}</small></footer>
            `)
            .addTo(map);
        
        
        // Update the chart with this country's data
        updateTrendChart();
    });
    
    // Change cursor on hover
    map.on('mouseenter', ['data-fill', 'data-extrusion'], () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', ['data-fill', 'data-extrusion'], () => {
        map.getCanvas().style.cursor = '';
    });
}

// Chart functions
function initializeTrendChart() {
    const ctx = document.getElementById('trend-chart').getContext('2d');

    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allYears,
            datasets: [
                {
                    label: 'Mean Anxiety Disorders',
                    data: calculateAverageData(),
                    borderColor: '#7a0177',
                    backgroundColor: 'rgba(122, 1, 119, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    hidden: selectedCountry !== null
                },
                {
                    label: selectedCountry || 'Selected Country',
                    data: selectedCountry ? getCountryData(selectedCountry) : [],
                    borderColor: '#ff7f00',
                    backgroundColor: 'rgba(255, 127, 0, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    hidden: selectedCountry === null
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} cases per 1000 people`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Cases per 1000 people' }
                },
                x: {
                    title: { display: true, text: 'Year' }
                }
            }
        }
    });
}

function calculateAverageData() {
    const averages = [];
    
    for (const year of allYears) {
        const data = yearData[year];
        if (!data || !data.features) continue;
        
        let sum = 0;
        let count = 0;
        
        for (const feature of data.features) {
            if (feature.properties && feature.properties.Anxiety !== undefined) {
                sum += feature.properties.Anxiety;
                count++;
            }
        }
        
        averages.push(count > 0 ? sum / count : 0);
    }
    
    return averages;
}

function getCountryData(countryName) {
    const countryData = [];
    
    for (const year of allYears) {
        const data = yearData[year];
        if (!data || !data.features) continue;
        
        const feature = data.features.find(f => 
            f.properties?.NAME_ENGL === countryName
        );
        
        if (feature && feature.properties?.Anxiety !== undefined) {
            countryData.push(feature.properties.Anxiety);
        } else {
            countryData.push(null);
        }
    }
    
    return countryData;
}

function updateTrendChart() {
    if (!trendChart) return;
    
    trendChart.data.datasets[0].data = calculateAverageData();
    trendChart.data.datasets[0].hidden = selectedCountry !== null;
    
    if (selectedCountry) {
        trendChart.data.datasets[1].data = getCountryData(selectedCountry);
        trendChart.data.datasets[1].label = selectedCountry;
        trendChart.data.datasets[1].hidden = false;
    } else {
        trendChart.data.datasets[1].hidden = true;
    }
    
    const yearIndex = allYears.indexOf(currentYear);
    trendChart.data.datasets.forEach(dataset => {
        dataset.pointBackgroundColor = allYears.map((year, index) => 
            index === yearIndex ? dataset.borderColor : 'rgba(0, 0, 0, 0.1)'
        );
    });
    
    trendChart.update();
}

// Load data and initialize application
map.on('load', () => {
    const yearPromises = [];
    
    for (let year = 1990; year <= 2019; year++) {
        yearPromises.push(
            fetch(`../geojson/eu_${year}.geojson`)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to load ${year} data: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    if (!data || !data.features || !data.features.length) {
                        console.warn(`${year} data is empty or invalid`);
                        return null;
                    }
                    yearData[year] = data;
                    return year;
                })
                .catch(error => {
                    console.error(`Failed to load ${year} data: ${error.message}`);
                    return null;
                })
        );
    }

    Promise.all(yearPromises).then(loadedYears => {
        allYears = loadedYears.filter(year => year !== null).sort((a, b) => a - b);
        
        if (allYears.length === 0) {
            showError("No data could be loaded. Please check your data files or network connection.");
            return;
        }

        console.log('Data loaded successfully for years:', allYears);
        document.getElementById('loading').style.display = 'none';
        
        currentYear = allYears[0];
        updateYearDisplay();
        
        map.addSource('current-data', {
            type: 'geojson',
            data: yearData[currentYear],
            promoteId: 'NAME_ENGL'
        });

        const colorScale = getColorScale();

        map.addLayer({
            id: 'data-fill',
            type: 'fill',
            source: 'current-data',
            paint: {
                'fill-color': colorScale,
                'fill-opacity': 1,
                'fill-outline-color': '#000'
            }
        });

        map.addLayer({
            id: 'data-extrusion',
            type: 'fill-extrusion',
            source: 'current-data',
            paint: {
                'fill-extrusion-color': colorScale,
                'fill-extrusion-opacity': 1,
                'fill-extrusion-translate': [0, 0],
                'fill-extrusion-height': [
                    '*', ['coalesce', ['get', 'Anxiety'], 0], 5000
                ],
                'fill-extrusion-base': 0,
                'fill-extrusion-translate-anchor': 'map',
                'fill-extrusion-vertical-gradient': true
            }
        });

        initializeTimeline();
        setupControls();
        setupExtrusionInteraction();
        initializeTrendChart();

    }).catch(error => {
        showError(`Error loading data: ${error.message}`);
    });
});

map.on('error', (e) => {
    showError(`Map error: ${e.error.message}`);
});

// Clear country selection on double click
document.getElementById('map').addEventListener('dblclick', () => {
    selectedCountry = null;
    updateTrendChart();
});