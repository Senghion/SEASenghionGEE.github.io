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
        { label: "Grid number", id: "GridNumber", type: "text" },
        { label: "Apparent power(MVA)", id: "ApparentPower", type: "number" },
        { label: "Nominal voltage(KV)", id: "NominalVoltage", type: "number" },
        { label: "1 or 3 Phase", id: "Phase", type: "number" },
    ],
    Bus: [
        { label: "Bus number", id: "BusNumber", type: "text" },
        { label: "Nominal voltage (KV)", id: "NominalVoltage", type: "number" }
    ],
    Generator: [
        { label: "Generator number", id: "GeneratorNumber", type: "text" },
        { label: "Apparent power(MVA)", id: "ApparentPower", type: "number" },
        { label: "Nominal voltage(KV)", id: "NominalVoltage", type: "number" },
        { label: "Active power", id: "ActivePower", type: "number" },
        { label: "Reactive power", id: "ReactivePower", type: "number" },
    ],
    Transformer: [
        { label: "Transformer number", id: "TransformerNumber", type: "text" },
        { label: "Apparent power(MVA)", id: "ApparentPower", type: "number" },
        { label: "Nominal voltage(KV)", id: "NominalVoltage", type: "number" },
        { label: "Primary voltage(KV)", id: "PrimaryVoltage", type: "number" },
        { label: "Secondary voltage(KV)", id: "SecondaryVoltage", type: "number" },
    ],
    Load: [
        { label: "Load number", id: "LoadNumber", type: "text" },
        { label: "Real power(MVA)", id: "RealPower", type: "number" },
        { label: "Nominal voltage(KV)", id: "NominalVoltage", type: "number" },
        { label: "Reactive power(MVar)", id: "ReactivePower", type: "number" },
    ],
    Cable: [
        { label: "Cable number", id: "CableNumber", type: "text" },
        { label: "Connection(1 or 3 Phase)", id: "Connection", type: "number" },
        { label: "Size(mm^2)", id: "Size", type: "number" },
        { label: "R", id: "R", type: "number" },
        { label: "X", id: "X", type: "number" },
    ],
    PV: [
        { label: "PV number", id: "PVNumber", type: "text" },

        { label: "Nominal voltage(KV)", id: "NominalVoltage", type: "number" },
        { label: "Rated power(MW)", id: "RatedPower", type: "number" },
        { label: "Efficiency(%)", id: "Efficiency", type: "number" },
    ],
    Battery: [
        { label: "Battery number", id: "BatteryNumber", type: "text" },
        { label: "Nominal voltage(KV)", id: "NominalVoltage", type: "number" },
        { label: "Capacity(Kwh)", id: "Capacity", type: "number" },
        { label: "Charge/Discharge(KW)", id: "Charge/Discharge", type: "number" },
    ],
};

var markers = []; // Global array to store markers
var toolDataStore = {}; // Store user inputs dynamically

function createToolForm(toolName, formId) {
    var toolFields = toolConfig[toolName];
    if (!toolFields) {
        console.error("Invalid tool selected:", toolName);
        return;
    }

    var container = document.getElementById("dataForm");
    container.innerHTML = ""; // Clear existing fields
    formId = formId || `form_${toolName}_${Date.now()}`;
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
    toolDataStore[formId] = { toolName, data: formData, formId: formId};

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
function createMarkerAndDisplayForm(e, formId) {
    var lat = e.latlng.lat.toFixed(6);
    var lng = e.latlng.lng.toFixed(6);

    var toolBarMarker = markerShapes[window.activeTool] 

    // Generate a unique formId 
    var formId = `form_${window.activeTool}_${Date.now()}`;

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
    marker.toolData = { toolName: window.activeTool, data: {}, formId: formId }; // Ensure toolData is initialized


    marker.bindPopup(`<b>${window.activeTool}</b><br>Lat: ${lat}<br>Lng: ${lng}`).openPopup();

    document.getElementById("dataForm").style.display = "block";
    createToolForm(window.activeTool, formId); // Pass formId to form

    marker.on('click', selectMarker);


    map.off('click', createMarkerAndDisplayForm);
}

// Attach function to toolbar button click events
document.querySelectorAll(".toolbarButton").forEach(button => {
    button.addEventListener("click", function() {
        window.activeTool = this.id;
        map.on('click', createMarkerAndDisplayForm);
        
    });
});


//Line Tool---
// Add a global array to track cables and their forms
var cables = []; // Each item: { line, formShown: false }
var selectedMarkers = []; // Store clicked markers
let cableDrawingActive = false;

// Cable button logic
document.querySelector(".CableButton").addEventListener("click", function() {
    if (cableDrawingActive) return; // Prevent multiple activations for a single draw
    cableDrawingActive = true;
    this.disabled = true; // Disable the button when clicked

    // Enable marker selection for cable drawing
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            layer.on('click', selectMarkers);
        }
    });
});

function selectMarkers(e) {
    if (selectedMarkers.length < 2) {
        selectedMarkers.push(e.target.getLatLng());
    }
    if (selectedMarkers.length === 2) {
        drawLineBetweenMarkers();
        // Remove marker click listeners for cable drawing
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                layer.off('click', selectMarkers);
            }
        });
        // Do NOT re-enable the button here; wait for form submission
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

    // Generate a unique formId for this cable
    var formId = `form_Cable_${Date.now()}`;
    var cableObj = { line: line, formShown: false };
    cables.push(cableObj);

    // Store formId in line's toolData
    line.toolData = { toolName: "Cable", data: {}, formId: formId };

    var midpoint = L.latLng(
        (latlng1.lat + latlng2.lat) / 2,
        (latlng1.lng + latlng2.lng) / 2
    );

    window.lastMidpoint = midpoint;
    window.lastDistance = formattedDistance;

    var popup = L.popup()
        .setLatLng(midpoint)
        .setContent(`<b>Distance:</b> ${formattedDistance}`);

    window.lastPopup = popup;

    // Show the form for this cable immediately after drawing
    document.getElementById("dataForm").style.display = "block";
    createToolForm("Cable", formId); // Pass formId to form
    cableObj.formShown = true;

    // Only show the popup on subsequent clicks (not the form)
    line.on('click', function() {
        var cable = cables.find(c => c.line === line);
        if (!cable.formShown) {
            document.getElementById("dataForm").style.display = "block";
            createToolForm("Cable", formId);
            cable.formShown = true;
        } else {
            if (map.hasLayer(popup)) {
                map.closePopup(popup);
            }
            popup.openOn(map);
        }
    });

    selectedMarkers = []; // Reset selection for next drawing
      // Re-enable Cable button and deactivate cable drawing after form submission
    document.getElementById("Cable").disabled = false;
    cableDrawingActive = false;
}

//----


// --- Remove function ---
// Function to remove a marker and its associated data

let selectedMarker = null;
let selectedLine = null;
let removalMode = false;

// Helper: Find all cables connected to a marker
function getCablesConnectedToMarker(marker) {
    const markerLatLng = marker.getLatLng();
    return cables.filter(cable => {
        const latlngs = cable.line.getLatLngs();
        return latlngs.some(ll => ll.lat === markerLatLng.lat && ll.lng === markerLatLng.lng);
    });
}

// Highlight and unhighlight helpers
function highlightLayer(layer) {
    if (layer instanceof L.Marker) {
        layer._icon.style.filter = "drop-shadow(0 0 5px red)";
    } else if (layer instanceof L.Polyline) {
        layer.setStyle({ color: "#ff0000", weight: 5 });
    }
}
function unhighlightLayer(layer) {
    if (layer instanceof L.Marker) {
        layer._icon.style.filter = "";
    } else if (layer instanceof L.Polyline) {
        layer.setStyle({ color: "#d2691e", weight: 3 });
    }
}

// Show/hide removal message
function showRemovalMessage() {
    let msg = document.getElementById("removalMsg");
    if (!msg) {
        msg = document.createElement("div");
        msg.id = "removalMsg";
        msg.style.position = "fixed";
        msg.style.top = "20px";
        msg.style.left = "50%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "#fff3cd";
        msg.style.color = "#856404";
        msg.style.padding = "10px 30px";
        msg.style.border = "1px solid #ffeeba";
        msg.style.borderRadius = "6px";
        msg.style.zIndex = 9999;
        msg.innerText = "Removal mode: Click a marker or cable to remove, or press ESC to cancel.";
        document.body.appendChild(msg);
    } else {
        msg.style.display = "block";
    }
}

function hideRemovalMessage() {
    let msg = document.getElementById("removalMsg");
    if (msg) msg.style.display = "none";
}

// Removal mode activation
document.getElementById("remove").addEventListener("click", function () {
    if (removalMode) return;
    removalMode = true;
    document.body.style.cursor = "not-allowed";
    showRemovalMessage();

    // Highlight all markers and cables
    markers.forEach(highlightLayer);
    cables.forEach(cableObj => highlightLayer(cableObj.line));

    // Attach one-time removal listeners
    markers.forEach(marker => {
        marker.once("click", onRemoveMarker);
    });
    cables.forEach(cableObj => {
        cableObj.line.once("click", onRemoveLine);
    });

    // ESC to cancel
    document.addEventListener("keydown", escCancelRemoval);
});

function escCancelRemoval(e) {
    if (e.key === "Escape") {
        exitRemovalMode();
    }
}

function exitRemovalMode() {
    removalMode = false;
    document.body.style.cursor = "";
    hideRemovalMessage();
    markers.forEach(unhighlightLayer);
    cables.forEach(cableObj => unhighlightLayer(cableObj.line));
    // Remove any pending listeners by re-attaching selection events
    attachSelectionEvents();
    document.removeEventListener("keydown", escCancelRemoval);
}

// --- Remove marker and its cables, and their data ---
function onRemoveMarker(e) {
    if (!removalMode) return;
    selectedMarker = e.target;


    // Remove all cables connected to this marker
    const connectedCables = getCablesConnectedToMarker(selectedMarker);
    connectedCables.forEach(cableObj => {
        // Remove cable data from toolDataStore if formId exists
        if (cableObj.line.toolData && cableObj.line.toolData.formId) {
            const formId = cableObj.line.toolData.formId;
            const existed = toolDataStore.hasOwnProperty(formId);
            delete toolDataStore[formId];
            if (existed && !toolDataStore.hasOwnProperty(formId)) {
                console.log(`Cable data with formId ${formId} deleted successfully.`);
                showDeleteNotification(`Cable data deleted (formId: ${formId})`);
            } else {
                console.warn(`Cable data with formId ${formId} was not found or failed to delete.`);
            }
        }
        // Remove cable from map and cables array
        map.removeLayer(cableObj.line);
        const idx = cables.indexOf(cableObj);
        if (idx !== -1) cables.splice(idx, 1);
    });

        // Remove marker data from toolDataStore if formId exists
    if (selectedMarker.toolData && selectedMarker.toolData.formId) {
        const formId = selectedMarker.toolData.formId;
        const existed = toolDataStore.hasOwnProperty(formId);
        delete toolDataStore[formId];
        if (existed && !toolDataStore.hasOwnProperty(formId)) {
            console.log(`${formId}: This tool and their data deleted successfully.`);
            showDeleteNotification(`${formId}: This tool and their data deleted successfully.`);
        } else {
            console.warn(`${formId}: This tool and their data were not found or failed to delete.`);
        }
    }

    // Remove marker from map and markers array
    map.removeLayer(selectedMarker);
    const idx = markers.indexOf(selectedMarker);
    if (idx !== -1) markers.splice(idx, 1);

    selectedMarker = null;
    exitRemovalMode();
}

// --- Remove cable only, and its data ---
function onRemoveLine(e) {
    if (!removalMode) return;
    selectedLine = e.target;

    // Remove cable data from toolDataStore if formId exists
    if (selectedLine.toolData && selectedLine.toolData.formId) {
        const formId = selectedLine.toolData.formId;
        const existed = toolDataStore.hasOwnProperty(formId);
        delete toolDataStore[formId];
        if (existed && !toolDataStore.hasOwnProperty(formId)) {
            console.log(`${formId}: This cable and their data deleted successfully.`);
            showDeleteNotification(`${formId}: This cable and their data deleted successfully.`);
        } else {
            console.warn(`${formId}: This cable and their data were not found or failed to delete.`);
        }
    }

    // Remove cable from map and cables array
    map.removeLayer(selectedLine);
    const idx = cables.findIndex(c => c.line === selectedLine);
    if (idx !== -1) cables.splice(idx, 1);

    selectedLine = null;
    exitRemovalMode();
}

// --- Helper: Show notification at the bottom of the page ---
function showDeleteNotification(msg) {
    let note = document.createElement("div");
    note.innerText = msg;
    note.style.position = "fixed";
    note.style.top = "20px";
    note.style.left = "50%";
    note.style.transform = "translateX(-50%)";
    note.style.background = "#d4edda";
    note.style.color = "#155724";
    note.style.padding = "10px 30px";
    note.style.border = "1px solid #c3e6cb";
    note.style.borderRadius = "6px";
    note.style.zIndex = 9999;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 2000);
}


// Attach click event to all markers and lines for selection (for edit mode)
function selectMarker(e) {
    selectedMarker = e.target;
    selectedLine = null;
}
function selectLine(e) {
    selectedLine = e.target;
    selectedMarker = null;
}
function attachSelectionEvents() {
    markers.forEach(marker => {
        marker.off('click', selectMarker);
        marker.on('click', selectMarker);
    });
    cables.forEach(cableObj => {
        cableObj.line.off('click', selectLine);
        cableObj.line.on('click', selectLine);
    });
}

// Call this after adding/removing markers/lines
attachSelectionEvents();
//-----


//Edit Function
// --- Edit mode state ---
let editMode = false;

// Show/hide edit mode message
function showEditMessage() {
    let msg = document.getElementById("editMsg");
    if (!msg) {
        msg = document.createElement("div");
        msg.id = "editMsg";
        msg.style.position = "fixed";
        msg.style.top = "60px";
        msg.style.left = "50%";
        msg.style.transform = "translateX(-50%)";
        msg.style.background = "#d1ecf1";
        msg.style.color = "#0c5460";
        msg.style.padding = "10px 30px";
        msg.style.border = "1px solid #bee5eb";
        msg.style.borderRadius = "6px";
        msg.style.zIndex = 9999;
        msg.innerText = "Edit mode: Click a marker or cable to edit, or press ESC to cancel.";
        document.body.appendChild(msg);
    } else {
        msg.style.display = "block";
    }
}
function hideEditMessage() {
    let msg = document.getElementById("editMsg");
    if (msg) msg.style.display = "none";
}

// Highlight for edit mode
function highlightEditLayer(layer) {
    if (layer instanceof L.Marker) {
        layer._icon.style.filter = "drop-shadow(0 0 5px #17a2b8)";
    } else if (layer instanceof L.Polyline) {
        layer.setStyle({ color: "#17a2b8", weight: 5 });
    }
}
function unhighlightEditLayer(layer) {
    if (layer instanceof L.Marker) {
        layer._icon.style.filter = "";
    } else if (layer instanceof L.Polyline) {
        layer.setStyle({ color: "#d2691e", weight: 3 });
    }
}

// --- Edit mode activation ---
document.getElementById("edit").addEventListener("click", function () {
    if (editMode) return;
    editMode = true;
    document.body.style.cursor = "pointer";
    showEditMessage();

    // Highlight all markers and cables
    markers.forEach(highlightEditLayer);
    cables.forEach(cableObj => highlightEditLayer(cableObj.line));

    // Attach one-time edit listeners
    markers.forEach(marker => {
        marker.once("click", onEditMarker);
    });
    cables.forEach(cableObj => {
        cableObj.line.once("click", onEditLine);
    });

    // ESC to cancel
    document.addEventListener("keydown", escCancelEdit);
});

function escCancelEdit(e) {
    if (e.key === "Escape") {
        exitEditMode();
    }
}

function exitEditMode() {
    editMode = false;
    document.body.style.cursor = "";
    hideEditMessage();
    markers.forEach(unhighlightEditLayer);
    cables.forEach(cableObj => unhighlightEditLayer(cableObj.line));
    attachSelectionEvents();
    document.removeEventListener("keydown", escCancelEdit);
}

// --- Edit marker ---
function onEditMarker(e) {
    if (!editMode) return;
    const marker = e.target;
    showEditForm(marker);
    exitEditMode();
}

// --- Edit cable ---
function onEditLine(e) {
    if (!editMode) return;
    const line = e.target;
    showEditForm(line);
    exitEditMode();
}

// --- Show edit form with previous data and Save button (calls submitToolData) ---
function showEditForm(obj) {
    let toolName = obj.toolData.toolName;
    let toolFields = toolConfig[toolName];
    let formId = obj.toolData.formId; // Use the same formId for consistency

    let container = document.getElementById("dataForm");
    container.innerHTML = ""; // Clear existing form fields
    let formHTML = `<div id="${formId}" class="toolForm"><h3>Edit ${toolName} Data</h3>`;


    // Populate the form with existing data
    toolFields.forEach(field => {
        let existingValue = obj.toolData.data[field.id] || "";
        formHTML += `<label for="${formId}_${field.id}">${field.label}:</label>
                     <input type="${field.type}" id="${formId}_${field.id}" value="${existingValue}">`;
    });

    // Save button calls submitToolData (reuse your submit logic)
    formHTML += `<button onclick="submitToolData('${formId}', '${toolName}')" id="saveButton">Save</button></div>`;
    container.insertAdjacentHTML("beforeend", formHTML);

    document.getElementById("dataForm").style.display = "block";

    // Set as lastMarker/lastLine for popup update
    if (obj instanceof L.Marker) {
        window.lastMarker = obj;
    } else {
        window.lastLine = obj;
    }
}
