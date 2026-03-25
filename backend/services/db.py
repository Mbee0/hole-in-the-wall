from pymongo import MongoClient
from config import Config

client = MongoClient(Config.MONGO_URI)
db = client[Config.MONGO_DB]

users_collection = db["users"]
businesses_collection = db["businesses"]
deals_collection = db["deals"]