// --- 1. SETUP DIMENSIONS & CONTAINERS ---
const mapWidth = 800;
const mapHeight = 500;
const chartWidth = 500;
const chartHeight = 500;

// The Map SVG
const mapSvg = d3.select("#map-view")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`);

const mapGroup = mapSvg.append("g");

// The Chart/Legend SVG
const chartSvg = d3.select("#chart-view")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${chartWidth} ${chartHeight}`);

// Tooltip Setup
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");

// Tracking active states
let currentMetric = "temp"; 
let activeLegendFilter = null; 

// --- 2. MAP PROJECTION ---
const projection = d3.geoAlbersUsa()
    .translate([mapWidth / 2, mapHeight / 2])
    .scale(1000);

const path = d3.geoPath().projection(projection);

const zoom = d3.zoom()
    .scaleExtent([1, 8]) // Don't let them zoom out past 1x or in past 8x
    .on("zoom", (event) => {
        // This is the magic: it moves and scales the entire map group
        mapGroup.attr("transform", event.transform);
    });

// Attach the zoom behavior to the SVG
mapSvg.call(zoom);
mapSvg.on("dblclick.zoom", null); // Disable the default double-click zoom
mapSvg.on("dblclick", () => {
    mapSvg.transition().duration(750).call(
        zoom.transform, 
        d3.zoomIdentity // Resets the map to the original view
    );
});

// --- 3. LOAD DATA ---
Promise.all([
    d3.json("https://gist.githubusercontent.com/michellechandra/0b2ce4923dc9b5809922/raw/a476b9098ba0244718b496697c5b350460d32f99/us-states.json"),
    d3.csv("data/weather_summary_us_only.csv")
]).then(function(data) {
    const usMapData = data[0];
    const weatherData = data[1];

    // Project coordinates
    const projectedData = [];
    weatherData.forEach(d => {
        const coords = projection([+d.longitude, +d.latitude]);
        if (coords) {
            projectedData.push({
                x: coords[0],
                y: coords[1],
                station: d.station,
                avg_temp: +d.avg_temp,
                total_prcp: +d.total_prcp,
                elevation: +d.elevation
            });
        }
    });

    // --- 4. COLOR SCALES ---
    const tempScale = d3.scaleSequential(d3.interpolateRdYlBu)
        .domain([75, 30])
        .clamp(true);

    const elevationScale = d3.scaleLinear()
        .domain([0, 500, 1500, 3000])
        .range(["#000000", "#555555", "#aaaaaa", "#ffffff"])
        .clamp(true);

    const prcpScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, 60])
        .clamp(true);

    // --- 5. DRAW THE VORONOI MAP ---
    // Clip path (Cookie cutter for US borders)
    mapSvg.append("defs").append("clipPath")
        .attr("id", "us-clip")
        .selectAll("path")
        .data(usMapData.features)
        .enter()
        .append("path")
        .attr("d", path);

    const delaunay = d3.Delaunay.from(projectedData.map(d => [d.x, d.y]));
    const voronoi = delaunay.voronoi([0, 0, mapWidth, mapHeight]);

    const voronoiGroup = mapGroup.append("g")
        .attr("clip-path", "url(#us-clip)");

    voronoiGroup.selectAll("path")
        .data(projectedData)
        .enter()
        .append("path")
        .attr("d", (d, i) => voronoi.renderCell(i)) 
        .attr("fill", d => tempScale(d.avg_temp))   
        .attr("stroke", "white")                    
        .attr("stroke-width", 0.5)                  
        .attr("class", "voronoi-cell")
        // Tooltip Interactivity
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "black").attr("stroke-width", 2);
            
            let metricText = "";
            if (currentMetric === "temp") {
                metricText = `<strong>Avg Temp:</strong> ${d.avg_temp.toFixed(1)}°F`;
            } else if (currentMetric === "prcp") {
                metricText = `<strong>Precipitation:</strong> ${d.total_prcp.toFixed(1)}"`;
            } else if (currentMetric === "elevation") {
                metricText = `<strong>Elevation:</strong> ${d.elevation} m`;
            }

            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <div style="margin-bottom: 5px;"><strong>Station:</strong> ${d.station}</div>
                <div>${metricText}</div>
            `)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(event, d) {
            // Restore previous stroke depending on if it's currently highlighted by the legend
            let isHighlighted = false;
            if (activeLegendFilter) {
                let val = currentMetric === "temp" ? d.avg_temp : currentMetric === "prcp" ? d.total_prcp : d.elevation;
                isHighlighted = (val >= activeLegendFilter.min && val < activeLegendFilter.max);
            }

            d3.select(this)
              .attr("stroke", isHighlighted ? "black" : "white")
              .attr("stroke-width", isHighlighted ? 1.5 : 0.5);
            
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // Draw state borders on top
    mapGroup.append("g")
        .selectAll("path")
        .data(usMapData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#333333") 
        .attr("stroke-width", 1)
        .attr("pointer-events", "none");

    // --- 6. LEGEND & BRUSHING ---
    const legendBins = {
        temp: [
            { label: "Under 40°F", min: -100, max: 40 },
            { label: "40°F to 50°F", min: 40, max: 50 },
            { label: "50°F to 60°F", min: 50, max: 60 },
            { label: "60°F to 70°F", min: 60, max: 70 },
            { label: "Over 70°F", min: 70, max: 200 }
        ],
        prcp: [
            { label: "Under 15 inches", min: -1, max: 15 },
            { label: "15 to 30 inches", min: 15, max: 30 },
            { label: "30 to 45 inches", min: 30, max: 45 },
            { label: "Over 45 inches", min: 45, max: 500 }
        ],
        elevation: [
            { label: "Sea Level (0-500m)", min: -100, max: 500 },
            { label: "Hills (500-1500m)", min: 500, max: 1500 },
            { label: "Mountains (1500m+)", min: 1500, max: 5000 }
        ]
    };

    const legendGroup = chartSvg.append("g")
        .attr("transform", "translate(50, 50)");

    const legendTitle = legendGroup.append("text")
    .attr("x", 0)
    .attr("y", -20) // Position it above the first legend row
    .style("font-family", "sans-serif")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text("Filter by Range"); // Initial Title

    function updateLegend(metric) {
        const titleMap = {
                temp: "Filter by Temperature",
                prcp: "Filter by Precipitation",
                elevation: "Filter by Elevation"
            };
            legendTitle.text(titleMap[metric]);

        const bins = legendBins[metric];
        const rows = legendGroup.selectAll(".legend-row").data(bins, d => d.label);

        rows.exit().remove();

        const rowsEnter = rows.enter()
            .append("g")
            .attr("class", "legend-row")
            .style("cursor", "pointer")
            .attr("transform", (d, i) => `translate(0, ${i * 45})`);

        rowsEnter.append("rect")
            .attr("width", 30)
            .attr("height", 30)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1);

        rowsEnter.append("text")
            .attr("x", 45)
            .attr("y", 20)
            .style("font-family", "sans-serif")
            .style("font-size", "14px");

        const allRows = rowsEnter.merge(rows);
        allRows.attr("transform", (d, i) => `translate(0, ${i * 45})`);
        allRows.select("text").text(d => d.label);
        
        allRows.select("rect").attr("fill", d => {
            const midValue = (d.min + d.max) / 2;
            if (metric === "temp") return tempScale(midValue);
            if (metric === "prcp") return prcpScale(midValue);
            if (metric === "elevation") return elevationScale(midValue);
        });

        // The Legend Click Event (Brushing & Linking)
        allRows.on("click", function(event, clickedBin) {
            if (activeLegendFilter && activeLegendFilter.label === clickedBin.label) {
                // Turn off filter
                activeLegendFilter = null;
                allRows.select("rect").attr("stroke", "#ccc").attr("stroke-width", 1);
                
                voronoiGroup.selectAll("path")
                    .transition().duration(400)
                    .attr("opacity", 1)
                    .attr("stroke", "white")
                    .attr("stroke-width", 0.5);
            } else {
                // Turn on filter
                activeLegendFilter = clickedBin;
                
                allRows.select("rect").attr("stroke", "#ccc").attr("stroke-width", 1);
                d3.select(this).select("rect").attr("stroke", "black").attr("stroke-width", 3);

                voronoiGroup.selectAll("path")
                    .transition().duration(400)
                    .attr("opacity", cellData => {
                        let val = metric === "temp" ? cellData.avg_temp :
                                  metric === "prcp" ? cellData.total_prcp : cellData.elevation;
                        return (val >= clickedBin.min && val < clickedBin.max) ? 1 : 0.1;
                    })
                    .attr("stroke", cellData => {
                        let val = metric === "temp" ? cellData.avg_temp :
                                  metric === "prcp" ? cellData.total_prcp : cellData.elevation;
                        return (val >= clickedBin.min && val < clickedBin.max) ? "black" : "none";
                    })
                    .attr("stroke-width", cellData => {
                        let val = metric === "temp" ? cellData.avg_temp :
                                  metric === "prcp" ? cellData.total_prcp : cellData.elevation;
                        return (val >= clickedBin.min && val < clickedBin.max) ? 1.5 : 0;
                    });
            }
        });
    }

    // --- 7. RADIO BUTTONS ---
    d3.selectAll("input[name='metric']").on("change", function(event) {
        currentMetric = event.target.value; 
        
        // Reset filters when switching metrics
        activeLegendFilter = null;
        updateLegend(currentMetric);

        voronoiGroup.selectAll("path")
            .transition().duration(750)
            .attr("fill", d => {
                if (currentMetric === "temp") return tempScale(d.avg_temp);
                if (currentMetric === "prcp") return prcpScale(d.total_prcp);
                if (currentMetric === "elevation") return elevationScale(d.elevation);
            })
            .attr("opacity", 1)
            .attr("stroke", "white")
            .attr("stroke-width", 0.5);
    });

    // Initialize the legend on page load
    updateLegend("temp");

}).catch(function(error){
    console.error("Error loading data: ", error);
});