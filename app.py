from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask import send_from_directory

app = Flask(__name__)
app = Flask(__name__, static_folder='static')
CORS(app)

user_inputs = []  # In-memory array to store user inputs

@app.route('/favicon.ico')
def favicon():
    return send_from_directory('static', 'favicon.ico', mimetype='image/vnd.microsoft.icon')
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/submit', methods=['POST'])
def user_input():
    data = request.get_json()
    user_inputs.append(data)   # Store each submission in the list
    return jsonify({"status": "success", "all_inputs": user_inputs})

@app.route('/all_inputs', methods=['GET'])
def get_all_inputs():
    return jsonify({"all_inputs": user_inputs})

if __name__ == '__main__':
    app.run(debug=True)
