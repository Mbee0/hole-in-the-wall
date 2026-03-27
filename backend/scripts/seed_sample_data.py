"""
Seed sample businesses and deals into MongoDB for map/demo usage.

Run from backend/:
    python scripts/seed_sample_data.py
"""
import os
import sys

# Allow running this file directly from backend/ without package install.
CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from services.db import businesses_collection, deals_collection


SAMPLE_BUSINESSES = [
    {
        "name": "Sunset Crumb Bakery",
        "category": "Bakery",
        "address": "1138 Westwood Blvd, Los Angeles, CA",
        "story": "A neighborhood bakery near UCLA focused on student-friendly treats.",
        "claimed": True,
        "deal_summary": "Buy 1 pastry, get 1 half off after 3 PM",
        "lat": 34.0594,
        "lng": -118.4469,
        "offer_types": ["deals", "fundraising"],
        "deal_focus": ["dessert", "drinks"],
    },
    {
        "name": "Midnight Noodles SoCal",
        "category": "Late Night",
        "address": "4001 University Dr, Irvine, CA",
        "story": "Late-night noodles and bowls for UC Irvine students.",
        "claimed": False,
        "deal_summary": "15% off student combo meals",
        "lat": 33.6405,
        "lng": -117.8443,
        "offer_types": ["deals"],
        "deal_focus": ["meals", "drinks"],
    },
    {
        "name": "Green Table Cafe SD",
        "category": "Cafe",
        "address": "9500 Gilman Dr, La Jolla, CA",
        "story": "Cafe with fundraiser-friendly options near UC San Diego.",
        "claimed": True,
        "deal_summary": "Club catering trays available",
        "lat": 32.8801,
        "lng": -117.2340,
        "offer_types": ["catering", "fundraising"],
        "deal_focus": ["meals", "dessert"],
    },
]

SAMPLE_DEALS = [
    {
        "business_name": "Sunset Crumb Bakery",
        "title": "Pastry Happy Hour",
        "description": "Buy 1 pastry, get 1 half off after 3 PM",
        "deal_type": "Student Deal",
        "student_only": True,
        "active": True,
    },
    {
        "business_name": "Midnight Noodles SoCal",
        "title": "15% Student Combo",
        "description": "Valid after 8PM with student ID",
        "deal_type": "Student Deal",
        "student_only": True,
        "active": True,
    },
    {
        "business_name": "Green Table Cafe SD",
        "title": "Club Catering Discount",
        "description": "Discounted trays for clubs and student organizations",
        "deal_type": "Catering",
        "student_only": False,
        "active": True,
    },
]


def upsert_businesses():
    for b in SAMPLE_BUSINESSES:
        businesses_collection.update_one(
            {"name": b["name"]},
            {"$set": b},
            upsert=True,
        )


def upsert_deals():
    for d in SAMPLE_DEALS:
        deals_collection.update_one(
            {"business_name": d["business_name"], "title": d["title"]},
            {"$set": d},
            upsert=True,
        )


if __name__ == "__main__":
    upsert_businesses()
    upsert_deals()
    print("Seed complete: sample businesses and deals are in MongoDB.")

