import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    MONGO_DB = os.getenv("MONGO_DB", "hole_in_the_wall")
    FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:8080")
