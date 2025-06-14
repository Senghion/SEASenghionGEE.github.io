from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask import send_from_directory
from loadflow import lfybus, lfnewton, lineflow 
import numpy as np

app = Flask(__name__, static_folder='static')
CORS(app)

# Matrix storage for each tool type
busdata = []      # For Grid, Generator, Load (bus info)
linedata = []     # For lines 

# Tool type to bus code mapping
TOOL_BUS_CODE = {
    "Load": 0,
    "Grid": 1,
    "Generator": 2

}

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico', mimetype='image/vnd.microsoft.icon')
@app.route('/')
def home():
    return render_template('index.html')

# ----Start

@app.route('/submit', methods=['POST'])
def user_input():
    data = request.get_json()
    # Example expected: data = {"toolName": "Grid", "data": {...}, ...}

    # Extract tool type and assign bus code
    tool_name = data.get("toolName")
    tool_data = data.get("data", {})

    if tool_name == "Cable":
        # Expecting: nl, nr, R, X, B, code from tool_data
        # Example: {"nl": 1, "nr": 2, "R": 0.02, "X": 0.035, "B": 0, "code": 1}
        row = [
            int(tool_data.get("nl", 0)),      # From bus number
            int(tool_data.get("nr", 0)),      # To bus number
            float(tool_data.get("R", 0)),     # Resistance (p.u.)
            float(tool_data.get("X", 0)),     # Reactance (p.u.)
            float(tool_data.get("B", 0)),     # 1/2 B (p.u.)
            int(tool_data.get("code", 1))     # Line code (default 1)
        ]
        linedata.append(row)
        return jsonify({
            "status": "success",
            "linedata": linedata
        })
    
    bus_code = TOOL_BUS_CODE.get(tool_name, -1)  # -1 if unknown
    # TOOL_BUS_CODE is a Python dictionary that maps tool names (like "Grid", "Generator", "Load") to their corresponding bus codes (1, 2, 0).
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
        float(tool_data.get("RealPower", 0)) if tool_name == "Load" else 0,        # load Real Power (Mva)
        float(tool_data.get("LoadReactivePower", 0)) if tool_name == "Load" else 0,# Load Reactive Power (Mvar)
        float(tool_data.get("ActivePower", 0)) if tool_name == "Generator" else 0,      # Gen Active Power (MW)
        float(tool_data.get("ReactivePower", 0) if tool_name == "Generator" else 0),    # Gen Reactive Power (Mvar)
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

@app.route('/run_loadflow', methods=['POST'])
def run_loadflow():
    # Convert lists to numpy arrays
    busdata_np = np.array(busdata, dtype=float)
    linedata_np = np.array(linedata, dtype=float)

    # System data
    basemva = 100
    accuracy = 1e-5
    maxiter = 100

    # Run power flow
    Ybus = lfybus(linedata_np)
    V, converge, iter_count = lfnewton(busdata_np, Ybus, basemva, accuracy, maxiter)
    
    # Calculate power injections
    nbus = len(busdata_np)
    bus_type = busdata_np[:, 1]
    Vm = abs(V)
    Va = np.angle(V)
    Pd = busdata_np[:, 4]
    Qd = busdata_np[:, 5]
    Pg = busdata_np[:, 6]
    Qg = busdata_np[:, 7]
    Qsh = busdata_np[:, 10]
    
    P = (Pg - Pd)/basemva
    Q = (Qg - Qd + Qsh)/basemva
    S = P + 1j*Q
    
    # Calculate line flows
    SLT = lineflow(linedata_np, V, basemva, P, Q, S)
    
    # Prepare bus voltages for display in the frontend
    bus_voltages = []
    for i in range(nbus):
        bus_voltages.append({
            "bus": int(busdata_np[i, 0]),
            "V": float(abs(V[i])),
            "angle": float(np.angle(V[i])*180/np.pi)
        })
    
    # Prepare losses
    losses = {
        "P_loss": float(np.real(SLT)),
        "Q_loss": float(np.imag(SLT))
    }

    return jsonify({
        "bus_voltages": bus_voltages,
        "losses": losses
    })

# ----End

if __name__ == '__main__':
    app.run(debug=True)