from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from routes.auth import bp as auth_bp
# from routes.users import users_bp
from routes.businesses import bp as businesses_bp
from routes.deals import bp as deals_bp

app = Flask(__name__)
app.config.from_object(Config)

CORS(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}})

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "app": "hole-in-the-wall-api"}), 200

# app.register_blueprint(users_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(businesses_bp)
app.register_blueprint(deals_bp)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)


