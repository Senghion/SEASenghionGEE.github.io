// Initialize the map
var map = L.map('map').setView([11.5564, 104.9282], 10); // Phnom Penh

// Load and display OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


// Place initial marker for Phnom Penh (default location)
var marker = L.marker([11.5564, 104.9282]).addTo(map)
    .bindPopup("<b>Phnom Penh</b><br>Capital of Cambodia.")
    .openPopup();


// Function to update location based on dropdown selection
document.getElementById('provinceSelected').addEventListener('change', function() {
    var selectedOption = this.options[this.selectedIndex]; // Get selected option
    var provinceName = selectedOption.text; // Get province name
    var coords = this.value.split(',');
    var lat = parseFloat(coords[0]);
    var lng = parseFloat(coords[1]);

    // Move the map to the selected location
    map.setView([lat, lng], 10);

    // Remove old marker if exists
    if (marker) {
        map.removeLayer(marker);
    }

    // Add new marker
    marker = L.marker([lat, lng]).addTo(map)
        .bindPopup("<b>" + provinceName + "</b><br>Lat: " + lat + ", Lng: " + lng)
        .openPopup();
});

var markerShapes = {
    "Grid": '<span style="font-size:24px; margin: -11px -5px; position: absolute; color:#0000cd;">&#9660;</span>', 
    "Bus": '<div style="background:red; width:17px; height:17px; border-radius:50%; margin: -3px -2px;"></div>',
    "Generator": '<div style="background:#79443b; width:16px; height:16px; margin: -2px; border-radius:3px;"></div>',
    "Transformer": '<span style="font-size:24px; margin: -18px -5px; position: absolute; color:#bf00ff ;">&#9650;</span>',
    "Load": '<div style="font-size:20px; margin: -11.5px -8px;">&#128310;</div>', 
    "PV": '<span style="font-size:24px; margin: -14px -5px; position: absolute;">&#127327;</span>', 
    "Battery": '<span style="font-size:24px; margin: -14px -5px; position: absolute;">&#127313;</span>', 
};

var toolConfig = {
    Grid: [
        { label: "Grid number", id: "Number", type: "text" },
        { label: "Apparent power(MVA)", id: "Apparent Power", type: "number" },
        { label: "Nominal voltage(KV)", id: "Nominal Voltage", type: "number" },
        { label: "1 or 3 Phase", id: "Phase", type: "number" },
    ],
    Bus: [
        { label: "Bus number", id: "Number", type: "text" },
        { label: "Nominal voltage (KV)", id: "Nominal Voltage", type: "number" }
    ],
    Generator: [
        { label: "Generator number", id: "Number", type: "text" },
        { label: "Apparent power(MVA)", id: "Apparent Power", type: "number" },
        { label: "Nominal voltage(KV)", id: "Nominal Voltage", type: "number" },
        { label: "Active power", id: "Active Power", type: "number" },
        { label: "Reactive power", id: "Reactive Power", type: "number" },
    ],
    Transformer: [
        { label: "Transformer number", id: "Number", type: "text" },
        { label: "Apparent power(MVA)", id: "Apparent Power", type: "number" },
        { label: "Nominal voltage(KV)", id: "Nominal Voltage", type: "number" },
        { label: "Primary voltage(KV)", id: "Primary Voltage", type: "number" },
        { label: "Secondary voltage(KV)", id: "Secondary Voltage", type: "number" },
    ],
    Load: [
        { label: "Load number", id: "Number", type: "text" },
        { label: "Real power(MVA)", id: "Real Power", type: "number" },
        { label: "Nominal voltage(KV)", id: "Nominal Voltage", type: "number" },
        { label: "Reactive power(MVar)", id: "Reactive Power", type: "number" },
        { label: "Load current(KA)", id: "Load Current", type: "number" },
    ],
    Cable: [
        { label: "Line number", id: "Number", type: "text" },
        { label: "Connection(1 or 3 Phase)", id: "Connection", type: "number" },
        { label: "Size(mm^2)", id: "Size", type: "number" },
        { label: "Length(Km)", id: "Length", type: "number" },
        { label: "R", id: "R", type: "number" },
        { label: "X", id: "X", type: "number" },
    ],
    PV: [

        { label: "PV number", id: "Number", type: "text" },
        { label: "Nominal voltage(KV)", id: "Nominal Voltage", type: "number" },
        { label: "Rated power(MW)", id: "Rated Power", type: "number" },
        { label: "Efficiency(%)", id: "Efficiency", type: "number" },
    ],
    Battery: [
        { label: "Battery number", id: "Number", type: "text" },
        { label: "Nominal voltage(KV)", id: "Nominal Voltage", type: "number" },
        { label: "Capacity(Kwh)", id: "Capacity", type: "number" },
        { label: "Charge/Discharge(KW)", id: "Charge/Discharge", type: "number" },
    ],
};

var markers = []; // Global array to store markers
var toolDataStore = {}; // Store user inputs dynamically

function createToolForm(toolName) {
    var toolFields = toolConfig[toolName];
    if (!toolFields) {
        console.error("Invalid tool selected:", toolName);
        return;
    }

    var container = document.getElementById("dataForm");
    container.innerHTML = ""; // Clear existing fields
    var formId = `form_${toolName}_${Date.now()}`;
    var formHTML = `<div id="${formId}" class="toolForm"><h3>${toolName} Form</h3>`;

    toolFields.forEach(field => {
        formHTML += `<label for="${formId}_${field.id}">${field.label}:</label>
                     <input type="${field.type}" id="${formId}_${field.id}">`;
    });

    formHTML += `<button onclick="submitToolData('${formId}', '${toolName}')" id="submitButton">Submit</button></div>`;
    container.insertAdjacentHTML("beforeend", formHTML);
}

function submitToolData(formId, toolName) {
    const toolFields = toolConfig[toolName];
    let formData = {};

     // Ensure we have a valid marker reference
    if (!window.lastMarker || !window.lastMarker.toolData) {
        console.error("No marker selected for editing.");
        return;
    }

    let marker = window.lastMarker; // Get the correct marker

    toolFields.forEach(field => {
        let inputElement = document.getElementById(`${formId}_${field.id}`);
        if (inputElement) {
            let newValue = inputElement.value.trim(); // Trim spaces to check empty input
            formData[field.id] = newValue !== " " ? newValue : marker.toolData.data[field.id]; // Preserve old value if unchanged

        }
    });

    // Update tool data storage
    marker.toolData.data = formData;
    toolDataStore[formId] = { toolName, data: formData };

    console.log("Stored Tool Data:", toolDataStore);

    // Check if the tool is Cable, display its data at midpoint with distance
    if (toolName === "Cable" && window.lastMidpoint) {
        let popupContent = `<b>${toolName} Details</b><br>Distance: ${window.lastDistance}<br>`;

        for (const [key, value] of Object.entries(formData)) {
            if (key !== "lat" && key !== "lng") { // Exclude lat/lng
                popupContent += `${key}: ${value}<br>`;
            }
        }

        window.lastPopup.setContent(popupContent).openOn(map); // Update popup at midpoint
    } else if (window.lastMarker) {
        // Existing condition for other tools (excluding Cable)
        let popupContent = `<b>${toolName} Details</b><br>Lat: ${window.lastLat}<br>Lng: ${window.lastLng}<br>`;
        
        for (const [key, value] of Object.entries(formData)) {
            popupContent += `${key}: ${value}<br>`;
        }

        window.lastMarker.setPopupContent(popupContent).openPopup();
    }

    // document.getElementById(formId).style.display = "none"; // Hide form after submission
    document.getElementById("dataForm").style.display = "none";
}


// Function to create marker and display the form
function createMarkerAndDisplayForm(e) {
    var lat = e.latlng.lat.toFixed(6);
    var lng = e.latlng.lng.toFixed(6);

    var toolBarMarker = markerShapes[window.activeTool] 

    var marker = L.marker([lat, lng], {
        icon: L.divIcon({
            html: toolBarMarker,  
            iconSize: [12, 12]
        })
    }).addTo(map);

    markers.push(marker); // Store marker in global array


    window.lastMarker = marker;
    window.lastLat = lat;
    window.lastLng = lng;
    marker.toolData = { toolName: window.activeTool, data: {} }; // Ensure toolData is initialized


    marker.bindPopup(`<b>${window.activeTool}</b><br>Lat: ${lat}<br>Lng: ${lng}`).openPopup();

    document.getElementById("dataForm").style.display = "block";

    marker.on('click', selectMarker);

    map.off('click', createMarkerAndDisplayForm);
}

// Attach function to toolbar button click events
document.querySelectorAll(".toolbarButton").forEach(button => {
    button.addEventListener("click", function() {
        window.activeTool = this.id;
        map.on('click', createMarkerAndDisplayForm);
        createToolForm(window.activeTool); // Ensure the correct form is generated
    });
});


//Line Tool---
var selectedMarkers = []; // Store clicked markers

function selectMarkers(e) {
    if (selectedMarkers.length < 2) {
        selectedMarkers.push(e.target.getLatLng()); // Store clicked marker's location
    }

    if (selectedMarkers.length === 2) {
        drawLineBetweenMarkers(); // Once two markers are selected, draw the line
    }
}

function drawLineBetweenMarkers() {
    if (selectedMarkers.length < 2) {
        alert("Select two markers first!");
        return;
    }

    var latlng1 = selectedMarkers[0]; 
    var latlng2 = selectedMarkers[1]; 

    var distance = latlng1.distanceTo(latlng2) / 1000; 
    var formattedDistance = distance.toFixed(2) + " km"; 

    var line = L.polyline([latlng1, latlng2], { color: '#d2691e', weight: 3 }).addTo(map);

    document.getElementById("dataForm").style.display = "block";
    createToolForm("Cable"); 

    // Calculate midpoint placement
    var midpoint = L.latLng(
        (latlng1.lat + latlng2.lat) / 2,
        (latlng1.lng + latlng2.lng) / 2
    );

    // Store midpoint and distance globally for later update
    window.lastMidpoint = midpoint;
    window.lastDistance = formattedDistance;

    // Create popup for distance (will later be updated with Cable data)
    var popup = L.popup()
        .setLatLng(midpoint)
        .setContent(`<b>Distance:</b> ${formattedDistance}`)
        .openOn(map);

    window.lastPopup = popup; // Store popup reference globally

       
    // Toggle popup visibility on line click
    line.on('click', function() {
        if (map.hasLayer(popup)) {
            map.closePopup(popup); // Hide popup
        } 
        popup.openOn(map); // Show popup
    });

    selectedMarkers = []; // Reset selection for next drawing

    document.getElementById("Cable").disabled = false;
}
document.querySelector(".CableButton").addEventListener("click", function() {
    this.disabled = true;   // Disable the button when clicked
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            layer.on('click', selectMarkers); // Activate line drawing mode
        }
    });
});
//----

// Function to select a marker for editing or removal
function selectMarker(e) {
    selectedMarker = e.target;
}

//Remove marker
// Function to remove selected marker
function removeSelectedMarker() {
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
    } else {
        alert("No marker selected! Click a marker first.");
    }
}
// Attach button events
document.getElementById("remove").addEventListener("click", removeSelectedMarker);
//----

// Function to edit marker data
function editDataTool(marker) {
    if (!marker || !marker.toolData) {
        console.error("Invalid marker selection.");
        return;
    }

    var toolName = marker.toolData.toolName;
    var toolFields = toolConfig[toolName];

    if (!toolFields) {
        console.error("Invalid tool selected:", toolName);
        return;
    }

    var container = document.getElementById("dataForm");
    container.innerHTML = ""; // Clear existing form fields
    var formId = `editForm_${toolName}_${Date.now()}`;
    var formHTML = `<div id="${formId}" class="toolForm"><h3>Edit ${toolName} Data</h3>`;


    // Populate the form with existing marker data
    toolFields.forEach(field => {
        var existingValue = marker.toolData.data[field.id] || ""; // Ensure existing data is used
        formHTML += `<label for="${formId}_${field.id}">${field.label}:</label>
                     <input type="${field.type}" id="${formId}_${field.id}" value="${existingValue}">`
    });

    formHTML += `<button id="saveButton">Save</button></div>`;
    container.insertAdjacentHTML("beforeend", formHTML);

    // Display the form for editing
    document.getElementById("dataForm").style.display = "block";

    // Attach event listener to save button dynamically
    document.getElementById("saveButton").addEventListener("click", function () {
        saveEditedData(formId, toolName, marker);
    });
}

// Function to save edited data and update the popup
function saveEditedData(formId, toolName, marker) {
    const toolFields = toolConfig[toolName];
    let updatedData = {};

    // Retrieve updated data from the form inputs
    toolFields.forEach(field => {
        let inputElement = document.getElementById(`${formId}_${field.id}`);
        if (inputElement) {
            // Keep existing data if no changes are made
            updatedData[field.id] = inputElement.value.trim() ? inputElement.value.trim() : marker.toolData.data[field.id];

        }
    });

    // Update stored tool data
    marker.toolData.data = updatedData;
    console.log("Updated Tool Data:", marker.toolData);

    // Update popup content with new data
    let popupContent = `<b>${toolName} Details</b><br>`;
    
    if (toolName === "Cable" && window.lastMidpoint) {
        popupContent += `Distance: ${window.lastDistance}<br>`;
        for (const [key, value] of Object.entries(updatedData)) {
            if (key !== "lat" && key !== "lng") {
                popupContent += `${key}: ${value}<br>`;
            }
        }
        window.lastPopup.setContent(popupContent).openOn(map);
    } else {
        popupContent += `Lat: ${window.lastLat}<br>Lng: ${window.lastLng}<br>`;
        for (const [key, value] of Object.entries(updatedData)) {
            popupContent += `${key}: ${value}<br>`;
        }
        marker.setPopupContent(popupContent).openPopup();
    }

    // Hide form after saving edits
    document.getElementById("dataForm").style.display = "none";
}

// Function to select a marker and trigger edit mode
function SelectMarkers(e) {
    var selectMarker = e.target;
    editDataTool(selectMarker);
}

// Attach click event to markers for editing
markers.forEach(marker => {
    marker.on("click", SelectMarkers);
});

document.getElementById("edit").addEventListener("click", function() {
    if (window.lastMarker) {
        editDataTool(window.lastMarker); // Pass the selected marker
    } else {
        console.error("No marker selected for editing.");
    }
});
