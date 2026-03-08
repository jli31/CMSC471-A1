// Set up dimensions for the map
const mapWidth = 800;
const mapHeight = 500;

// Set up dimensions for the secondary chart
const chartWidth = 500;
const chartHeight = 500;

// Create the Map SVG
const mapSvg = d3.select("#map-view")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`);

// Create a group (<g>) for the map items. 
// Applying zoom/pan to a <g> tag is much easier than the whole SVG.
const mapGroup = mapSvg.append("g");

// Create the Chart SVG
const chartSvg = d3.select("#chart-view")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);

// Load the data
// Note: You will need the TopoJSON/GeoJSON for the US map, AND your weather CSV
Promise.all([
    // d3.json("data/us-states.json"), // You'll need to grab a map file
    d3.csv("data/weather_2017.csv")  // Your provided dataset
]).then(function(data) {
    // const mapData = data[0];
    const weatherData = data[1];

    console.log("Data loaded successfully!", weatherData);

    // TODO: Draw Map
    // TODO: Draw secondary chart
    // TODO: Setup Zoom on mapGroup
    // TODO: Setup Brush on chartSvg
    
}).catch(function(error){
    console.error("Error loading data: ", error);
});