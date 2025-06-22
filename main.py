from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask import send_from_directory
import numpy as np
from loadflowcal import run_loadflow

app = Flask(__name__, static_folder='static')
CORS(app)

# Matrix storage for each tool type
busdata = []      # For Grid, Generator, Load (bus info)
linedata = []     # For lines 

# Tool type to bus code mapping
TOOL_BUS_CODE = {
    "Load": 0,
    "Slack": 1,
    "Generator": 2,

}

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico', mimetype='image/vnd.microsoft.icon')
@app.route('/')
def home():
    return render_template('index.html')

# ----User input endpoint----
# This endpoint receives user input from the frontend, processes it, and updates the busdata and linedata matrices.
@app.route('/submit', methods=['POST'])
def user_input():
    data = request.get_json()
    # Example expected: data = {"toolName": "Grid", "data": {...}, ...}

    # Extract tool type and assign bus code
    tool_name = data.get("toolName")
    tool_data = data.get("data", {})

    if tool_name == "Cable":
        # Get user values
        R_user = float(tool_data.get("R", 0))      # Ohm/km
        X_user = float(tool_data.get("X", 0))      # Ohm/km
        line_length_km = float(tool_data.get("distance", 1))  # km, default 1 if not provided

        # Base values (could be made configurable)
        baseMVA = 100
        baseKV = 138

        # Calculate total R, X in ohms
        R_total = R_user * line_length_km
        X_total = X_user * line_length_km

        # Calculate base impedance
        Z_base = (baseKV ** 2) / baseMVA

        # Convert to per unit
        R_pu = R_total / Z_base
        X_pu = X_total / Z_base
        
        row = [
            float(tool_data.get("nl", 0)),    # From bus number
            float(tool_data.get("nr", 0)),    # To bus number
            R_pu,                             # Resistance (p.u.)
            X_pu,                             # Reactance (p.u.)
            float(tool_data.get("B", 0)),     # 1/2 B (p.u.)
            float(tool_data.get("code", 1))   # Line code (default 1)
        ]
        linedata.append(row)
        return jsonify({
            "status": "success",
            "linedata": linedata
        })
    
    bus_code = TOOL_BUS_CODE.get(tool_name, -1)  # -1 if unknown
    # TOOL_BUS_CODE is a Python dictionary that maps tool names (like "Slack", "Generator", "Load") to their corresponding bus codes (1, 2, 0).
    # .get(tool_name, -1) tries to find the value for tool_name in the dictionary.
    # If tool_name exists in TOOL_BUS_CODE, it returns the corresponding code (e.g., 1 for "Grid").
    # If tool_name does not exist in the dictionary, it returns -1 (the default value).

    # Build row for busdata matrix (order: code, voltage, angle, load MW, load Mvar, gen MW, gen Mvar, ...)
    # You can adjust the order and fields as needed
    row = [
        float(tool_data.get("Number", 0)),           # Bus or tool number
        bus_code,
        float(tool_data.get("NominalVoltage", 0)),   # Voltage Mag
        0,                                           # Angle (not provided by the user, set to 0)
        float(tool_data.get("RealPower", 0)) if tool_name == "Load" else 0,           # load Real Power (Mva)
        float(tool_data.get("LoadReactivePower", 0)) if tool_name == "Load" else 0,   # Load Reactive Power (Mvar)
        float(tool_data.get("ActivePower", 0)) if tool_name == "Generator" else 0,    # Gen Active Power (MW)
        float(tool_data.get("ReactivePower", 0) if tool_name == "Generator" else 0),  # Gen Reactive Power (Mvar)
        0,                                           # Qmin (not provided, set to 0)
        0,                                           # Qmax (not provided, set to 0)
        0                                            # Injected Mvar (not provided, set to 0)
        # ... add more fields as needed
    ]
    busdata.append(row)

    return jsonify({
        "status": "success",
        "busdata": busdata
    })
# ----End of user input endpoint----

# ----Clear or Refresh endpoint----
@app.route('/clear', methods=['POST'])
def clear_data():
    global busdata, linedata
    busdata.clear()
    linedata.clear()
    return jsonify({"status": "success", "message": "All data cleared."})
# ----End of clear or refresh endpoint----

# ----Load flow calculation endpoint----
@app.route('/run_loadflowCal', methods=['POST'])
def run_loadflowCal():
    print("busdata:", busdata)
    print("linedata:", linedata)
    print("hello")
    # Validate busdata and linedata length
    for row in busdata:
        if len(row) < 11:
            return jsonify({"error": "Each bus must have at least 11 fields."}), 400
    for row in linedata:
        if len(row) < 6:
            return jsonify({"error": "Each line must have at least 6 fields."}), 400
    try:
        busdata_np = np.array(busdata, dtype=float)
        linedata_np = np.array(linedata, dtype=float)
        results = run_loadflow(busdata_np, linedata_np)
        return jsonify(results)
    except Exception as e:
        print("Load flow error:", e)
        return jsonify({"error": str(e)}), 500
# ----End of load flow calculation endpoint----
    
# ----Remove bus or line endpoint----
@app.route('/remove_bus', methods=['POST'])
def remove_bus():
    global busdata, linedata
    data = request.get_json()
    number = float(data.get("Number"))  # Get the bus number to remove
    # Remove any bus row where the first column (bus number) matches 'number'
    busdata[:] = [row for row in busdata if row[0] != number]

    # Remove any lines connected to this bus
    linedata[:] = [row for row in linedata if row[0] != number and row[1] != number]
    # --- Renumber buses to be consecutive starting from 1 ---
    # Build a mapping from old bus numbers to new bus numbers
    old_numbers = sorted([row[0] for row in busdata])
    number_map = {old: new for new, old in enumerate(old_numbers, start=1)}

    # Update busdata with new numbers
    for row in busdata:
        row[0] = number_map[row[0]]

    # Update linedata with new bus numbers
    for row in linedata:
        row[0] = number_map.get(row[0], row[0])
        row[1] = number_map.get(row[1], row[1])
    return jsonify({"status": "success", "busdata": busdata, "linedata": linedata})

@app.route('/remove_line', methods=['POST'])
def remove_line():
    global linedata
    data = request.get_json()
    nl = float(data.get("nl"))  # Get the 'from' bus number
    nr = float(data.get("nr"))  # Get the 'to' bus number
    # Remove any line where both nl and nr match
    linedata[:] = [row for row in linedata if not (row[0] == nl and row[1] == nr)]
    return jsonify({"status": "success", "linedata": linedata})

# ----End of eemove bus or line endpoint----

# ----Edit bus or line data endpoint----

@app.route('/edit', methods=['POST'])
def edit_data():
    try:
        # print("EDIT endpoint called")
        data = request.get_json()
        print("Received data:", data)
        tool_name = data.get("toolName")
        tool_data = data.get("data", {})
        row_index = data.get("rowIndex")
        # print("tool_name:", tool_name, "row_index:", row_index)

        global busdata, linedata

        if tool_name == "Cable":
            if row_index is not None and 0 <= row_index < len(linedata):
                row = linedata[row_index]
                if len(row) >= 6:
                    row[0] = float(tool_data.get("nl", row[0]))
                    row[1] = float(tool_data.get("nr", row[1]))
                    row[2] = float(tool_data.get("R", row[2]))
                    row[3] = float(tool_data.get("X", row[3]))
                    row[4] = float(tool_data.get("B", row[4]))
                    row[5] = float(tool_data.get("code", row[5]))
                return jsonify({"status": "success", "linedata": linedata})
            else:
                return jsonify({"status": "error", "message": "Invalid row index for Cable"}), 400

        else:
            if row_index is not None and 0 <= row_index < len(busdata):
                row = busdata[row_index]
                if len(row) >= 11:
                    row[0] = float(tool_data.get("Number", row[0]))
                    row[2] = float(tool_data.get("NominalVoltage", row[2]))
                    row[4] = float(tool_data.get("RealPower", row[4]))
                    row[5] = float(tool_data.get("LoadReactivePower", row[5]))
                    row[6] = float(tool_data.get("ActivePower", row[6]))
                    row[7] = float(tool_data.get("ReactivePower", row[7]))
                return jsonify({"status": "success", "busdata": busdata})
            else:
                return jsonify({"status": "error", "message": "Invalid row index for Bus"}), 400

    except Exception as e:
        print("Error in /edit:", e)
        return jsonify({"status": "error", "message": str(e)}), 500
# ----End of edit bus or line data endpoint----



if __name__ == '__main__':
    app.run(debug=True)