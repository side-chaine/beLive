from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def hello_world():
    return jsonify(message='Привет от beLive Backend!')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
