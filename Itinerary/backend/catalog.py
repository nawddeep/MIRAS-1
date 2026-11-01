"""The single mapping table from our interests and Explore categories to each provider's vocabulary.

Google Places (New):
  primary_types   -> Nearby Search `includedPrimaryTypes` (hard filter on the place's primary type)
  exclude_types   -> Nearby Search `excludedPrimaryTypes`, and dropped again in the post-filter
  queries         -> Text Search queries that express intent ("specialty coffee", "zipline")
Geoapify: category keys, each checked against the live API (all return HTTP 200).
OpenStreetMap Overpass: tag selectors (used for rentals, where Geoapify has no Udaipur data).

Post-filter (applied to every provider): `name_exclude` drops names that contradict the category,
`name_require` keeps only names that fit it, `allowed_types` keeps Google places whose primary type fits.
"""

import re

from pydantic import BaseModel, ConfigDict

# Chains and fast food are excluded where the user asked for local cafes or food.
CHAINS = r"mcdonald|kfc|domino|pizza hut|burger king|subway|haldiram|wow! momo|la pino"


class Spec(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    key: str
    label: str
    primary_types: list[str] = []
    exclude_types: list[str] = []
    allowed_types: list[str] = []  # if set, Google places must have one of these as primary type (or in types)
    queries: list[str] = []
    geoapify: list[str] = []
    geoapify_require: list[str] = []  # if set, an OSM place must carry one of these category prefixes
    overpass: list[str] = []  # Overpass QL selectors without the area filter
    name_exclude: str | None = None
    name_require: str | None = None
    indoor: bool | None = None
    visit_minutes: int = 60
    evening: bool = False  # suits the evening slot
    evening_only: bool = False
    hidden_gem: bool = False  # Explore "Hidden gems": restrict to lesser-known places
    vehicle_hint: str | None = None  # rentals: what the user asked for (never shown as provider data)

    def excludes_name(self, name: str) -> bool:
        return bool(self.name_exclude and re.search(self.name_exclude, name, re.I))

    def requires_name(self, name: str) -> bool:
        return not self.name_require or bool(re.search(self.name_require, name, re.I))


CAFE_EXCLUDE_TYPES = ["diner", "fast_food_restaurant", "meal_takeaway", "restaurant", "hamburger_restaurant", "pizza_restaurant", "indian_restaurant"]
CAFE_NAME_EXCLUDE = rf"bhojnalay|bhojanalaya|dhaba|restaurant|thali|biryani|mess\b|hotel\b|sweets|mishthan|juice|{CHAINS}"

INTERESTS: dict[str, Spec] = {s.key: s for s in [
    Spec(
        key="cafes", label="Cafes and coffee",
        primary_types=["cafe", "coffee_shop", "bakery", "tea_house"],
        allowed_types=["cafe", "coffee_shop", "bakery", "tea_house"],
        exclude_types=CAFE_EXCLUDE_TYPES,
        queries=["specialty coffee", "rooftop cafe", "lake view cafe"],
        geoapify=["catering.cafe"], geoapify_require=["catering.cafe"],
        name_exclude=CAFE_NAME_EXCLUDE, indoor=True, visit_minutes=45, evening=True,
    ),
    Spec(
        key="food", label="Local food and restaurants",
        primary_types=["restaurant", "indian_restaurant", "vegetarian_restaurant"],
        exclude_types=["fast_food_restaurant", "meal_takeaway", "hamburger_restaurant", "pizza_restaurant"],
        queries=["Rajasthani thali", "rooftop restaurant", "dal baati churma"],
        geoapify=["catering.restaurant.indian", "catering.restaurant.regional", "catering.restaurant"],
        geoapify_require=["catering.restaurant"],
        name_exclude=CHAINS, indoor=True, visit_minutes=60, evening=True,
    ),
    Spec(
        key="adventure", label="Adventure and sports",
        queries=["zipline", "paragliding", "quad biking", "trekking", "boating", "ATV ride", "camel safari", "horse riding"],
        exclude_types=["restaurant", "lodging", "store"],
        geoapify=["activity", "sport", "entertainment.zoo", "tourism.attraction"],
        name_require=r"adventure|zip|para|boat|trek|safari|atv|quad|camp|climb|kayak|horse|ride|biological park|zoo|rafting",
        indoor=False, visit_minutes=120,
    ),
    Spec(
        key="shopping", label="Shopping and markets",
        primary_types=["market", "shopping_mall", "gift_shop", "clothing_store"],
        queries=["bazaar", "local market", "traditional market"],
        geoapify=["commercial.marketplace", "commercial.shopping_mall", "commercial.gift_and_souvenir", "commercial.clothing"],
        indoor=None, visit_minutes=75, evening=True,
    ),
    Spec(
        key="heritage", label="Heritage and monuments",
        primary_types=["historical_landmark", "hindu_temple", "monument"],
        queries=["palace", "fort", "haveli", "heritage temple", "stepwell"],
        exclude_types=["restaurant", "lodging", "store", "cafe"],
        geoapify=["tourism.sights.castle", "tourism.sights.memorial", "tourism.sights.city_gate", "building.historic", "religion.place_of_worship.hinduism"],
        indoor=False, visit_minutes=90,
    ),
    Spec(
        key="museums", label="Museums and culture",
        primary_types=["museum", "art_gallery", "cultural_center"],
        queries=["museum", "cultural centre", "folk art museum"],
        geoapify=["entertainment.museum", "entertainment.culture"],
        indoor=True, visit_minutes=90,
    ),
    Spec(
        key="nature", label="Nature and lakes",
        primary_types=["park", "national_park", "botanical_garden"],
        queries=["lake", "garden", "lake viewpoint"],
        exclude_types=["restaurant", "lodging", "store"],
        geoapify=["natural.water", "tourism.attraction.viewpoint", "leisure.park", "entertainment.zoo"],
        indoor=False, visit_minutes=75, evening=True,
    ),
    Spec(
        key="nightlife", label="Nightlife and entertainment",
        primary_types=["bar", "night_club", "pub"],
        queries=["rooftop bar", "live music", "cultural dance show"],
        geoapify=["catering.bar", "adult.nightclub", "catering.pub"],
        indoor=True, visit_minutes=90, evening=True, evening_only=True,
    ),
    Spec(
        key="arts", label="Arts and handicrafts",
        primary_types=["art_gallery"],
        queries=["miniature painting", "handicraft shop", "pottery", "block print textile", "silver jewellery", "pichwai painting"],
        exclude_types=["restaurant", "lodging", "cafe"],
        geoapify=["entertainment.culture.gallery", "commercial.art", "commercial.gift_and_souvenir", "commercial.jewelry"],
        indoor=True, visit_minutes=60,
    ),
    Spec(
        key="wellness", label="Wellness",
        primary_types=["spa"],
        queries=["spa", "yoga centre", "ayurveda massage"],
        geoapify=["service.beauty.spa"],
        indoor=True, visit_minutes=90,
    ),
    Spec(
        key="photography", label="Photography spots",
        queries=["viewpoint", "sunset point", "ghat"],
        exclude_types=["restaurant", "lodging", "store", "cafe"],
        geoapify=["tourism.attraction.viewpoint", "natural.water", "tourism.sights.city_gate"],
        indoor=False, visit_minutes=45, evening=True,
    ),
]}

# ---------- Explore categories ----------

RENTAL_EXCLUDE = r"rental (flat|room|house|apartment)|pg\b|paying guest"

CATEGORIES: dict[str, Spec] = {s.key: s for s in [
    Spec(key="food", label="Restaurants", primary_types=["restaurant", "indian_restaurant", "vegetarian_restaurant"],
         queries=["restaurant", "rooftop restaurant"], geoapify=["catering.restaurant"], geoapify_require=["catering.restaurant"], indoor=True),
    Spec(key="cafes", label="Cafes and coffee shops", primary_types=INTERESTS["cafes"].primary_types, allowed_types=INTERESTS["cafes"].allowed_types,
         exclude_types=CAFE_EXCLUDE_TYPES, queries=INTERESTS["cafes"].queries, geoapify=["catering.cafe"], geoapify_require=["catering.cafe"],
         name_exclude=CAFE_NAME_EXCLUDE, indoor=True),
    Spec(key="hidden_gems", label="Hidden gems", queries=["independent cafe", "rooftop cafe", "local eatery", "viewpoint", "stepwell", "old haveli"],
         exclude_types=["fast_food_restaurant", "lodging"], geoapify=["tourism.attraction.viewpoint", "building.historic", "catering.cafe"],
         name_exclude=CHAINS, hidden_gem=True),
    Spec(key="artisans", label="Artisans and handicrafts", primary_types=["art_gallery"], queries=INTERESTS["arts"].queries,
         exclude_types=["restaurant", "lodging", "cafe"], geoapify=INTERESTS["arts"].geoapify, indoor=True),
    Spec(key="stays", label="Hotels and stays", primary_types=["lodging", "hotel", "hostel", "guest_house"], queries=["hotel", "heritage hotel", "hostel", "homestay"],
         geoapify=["accommodation.hotel", "accommodation.hostel", "accommodation.guest_house"], indoor=True),
    Spec(key="attractions", label="Attractions and monuments", primary_types=["tourist_attraction", "museum", "historical_landmark", "park"],
         queries=["tourist attraction", "museum", "palace", "garden"],
         geoapify=["tourism.attraction", "tourism.sights.castle", "entertainment.museum", "tourism.sights.memorial"]),
    Spec(key="shopping", label="Shopping and markets", primary_types=["shopping_mall", "market"], queries=["bazaar", "local market", "shopping mall"],
         geoapify=["commercial.shopping_mall", "commercial.marketplace"]),
    Spec(key="entertainment", label="Entertainment", primary_types=["night_club", "bar", "movie_theater", "amusement_park"],
         queries=["cultural show", "live music", "rooftop bar"], geoapify=["entertainment.cinema", "adult.nightclub", "catering.bar", "catering.pub"], indoor=True),
    Spec(key="health", label="Hospitals and pharmacies", primary_types=["hospital", "pharmacy"], queries=["hospital", "pharmacy"],
         geoapify=["healthcare.hospital", "healthcare.pharmacy"], indoor=True),
    # Rentals: one category per sub-filter. "rentals" is the union shown by default.
    Spec(key="rental_bike", label="Bike / motorcycle rental", queries=["bike rental", "motorcycle rental", "royal enfield rental"],
         overpass=['nwr["amenity"="motorcycle_rental"]', 'nwr["shop"]["name"~"bike.*(rent|hire)|motorcycle.*rent|enfield",i]', 'nwr["amenity"]["name"~"bike.*(rent|hire)",i]'],
         name_exclude=RENTAL_EXCLUDE, vehicle_hint="Bike / motorcycle"),
    Spec(key="rental_scooter", label="Scooter rental", queries=["scooty rental", "scooter rental", "activa on rent"],
         overpass=['nwr["amenity"="motorcycle_rental"]', 'nwr["shop"]["name"~"scoot|activa",i]', 'nwr["amenity"]["name"~"scoot.*(rent|hire)",i]'],
         name_exclude=RENTAL_EXCLUDE, vehicle_hint="Scooter"),
    Spec(key="rental_bicycle", label="Bicycle rental", queries=["bicycle rental", "cycle on rent"],
         geoapify=["rental.bicycle"], overpass=['nwr["amenity"="bicycle_rental"]', 'nwr["shop"]["name"~"cycle.*(rent|hire)",i]'],
         name_exclude=RENTAL_EXCLUDE, vehicle_hint="Bicycle"),
    Spec(key="rental_car", label="Car rental", primary_types=["car_rental"], queries=["car rental"],
         geoapify=["rental.car"], overpass=['nwr["amenity"="car_rental"]'], name_exclude=RENTAL_EXCLUDE, vehicle_hint="Car"),
    Spec(key="rental_selfdrive", label="Self-drive cars", queries=["self drive car rental", "self drive cars"],
         overpass=['nwr["amenity"="car_rental"]', 'nwr["shop"]["name"~"self.?drive",i]', 'nwr["office"]["name"~"self.?drive",i]'], name_exclude=RENTAL_EXCLUDE, vehicle_hint="Self-drive car"),
    Spec(key="rental_taxi", label="Cars with driver (taxi)", primary_types=["taxi_stand"], queries=["taxi service", "cab service", "car with driver"],
         geoapify=["service.taxi"], overpass=['nwr["amenity"="taxi"]', 'nwr["office"]["name"~"taxi|cab|travels",i]'],
         name_exclude=RENTAL_EXCLUDE, vehicle_hint="Car with driver"),
]}

RENTAL_KEYS = ["rental_bike", "rental_scooter", "rental_bicycle", "rental_car", "rental_selfdrive", "rental_taxi"]
RENTAL_GROUPS = {
    "rentals": RENTAL_KEYS,
    "two_wheeler": ["rental_bike", "rental_scooter"],
    "car": ["rental_car", "rental_selfdrive", "rental_taxi"],
    "unsure": ["rental_bike", "rental_scooter", "rental_car", "rental_selfdrive"],
}

# General advice only (not provider data); shown with a "General advice" label.
BEFORE_YOU_RENT = [
    "Carry a valid driving licence for the vehicle class (an International Driving Permit with a foreign licence).",
    "Wear a helmet on two-wheelers. It is required by law for rider and pillion in India.",
    "Ask what the refundable deposit is, how it is returned, and which ID they keep.",
    "Check brakes, lights, horn, tyres and the fuel level, and photograph existing damage before you ride off.",
    "Ask about fuel policy, the daily km limit and who pays for repairs or traffic fines.",
    "Old-city lanes are narrow and parking is limited. Use paid parking where available.",
]
