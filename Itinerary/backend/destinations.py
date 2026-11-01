"""Destination configuration. Add a new entry here to support another city.

Only stable reference facts live here (coordinates, codes, public helpline numbers).
Places, prices, timings and ratings always come from providers at request time."""

from pydantic import BaseModel

from models.itinerary import EmergencyContact


class AreaDef(BaseModel):
    """A part of the city used as a day's search anchor (not a recommendation in itself).
    Coordinates come from Geoapify/OpenStreetMap geocoding."""

    id: str
    name: str
    lat: float
    lng: float
    good_for: list[str]  # interest keys this area is strong in


class ArrivalPoint(BaseModel):
    id: str
    name: str
    lat: float
    lng: float


class Destination(BaseModel):
    id: str
    name: str
    region: str
    country_code: str
    lat: float
    lng: float
    anchor_label: str  # where each day starts if the traveller hasn't picked a stay
    search_radius_m: int
    timezone: str
    currency: str
    airport_codes: list[str]  # IATA codes serving the destination
    railway_station_codes: list[str]
    areas: list[AreaDef]
    arrival_points: dict[str, ArrivalPoint]  # keyed by transport: flight / train / bus
    narrow_lane_zones: list[tuple[float, float, int]] = []  # (lat, lng, radius m): cars often can't reach the door
    emergency: list[EmergencyContact]
    emergency_source: str
    money_notes: list[str]
    documents: list[str]


DESTINATIONS: dict[str, Destination] = {
    "udaipur": Destination(
        id="udaipur",
        name="Udaipur",
        region="Rajasthan, India",
        country_code="in",
        lat=24.57606,  # City Palace (OSM geocode)
        lng=73.68357,
        anchor_label="Udaipur old city (City Palace)",
        search_radius_m=12000,
        timezone="Asia/Kolkata",
        currency="INR",
        airport_codes=["UDR"],  # Maharana Pratap Airport
        railway_station_codes=["UDZ"],  # Udaipur City
        areas=[
            AreaDef(id="pichola", name="Lake Pichola and City Palace", lat=24.57606, lng=73.68357,
                    good_for=["heritage", "museums", "photography", "cafes", "food", "nightlife", "arts"]),
            AreaDef(id="old_city_bazaars", name="Old city bazaars (Bapu Bazar, Hathi Pol)", lat=24.58269, lng=73.69613,
                    good_for=["shopping", "food", "arts", "heritage", "cafes"]),
            AreaDef(id="fateh_sagar", name="Fateh Sagar and Moti Magri", lat=24.60217, lng=73.67557,
                    good_for=["nature", "cafes", "photography", "adventure", "heritage"]),
            AreaDef(id="sajjangarh", name="Sajjangarh and Badi Lake", lat=24.59368, lng=73.64868,
                    good_for=["nature", "adventure", "photography", "heritage"]),
            AreaDef(id="shilpgram", name="Shilpgram and Rani Road", lat=24.61306, lng=73.66341,
                    good_for=["arts", "shopping", "cafes", "nature", "museums"]),
            AreaDef(id="hiran_magri", name="Hiran Magri (new city)", lat=24.56462, lng=73.71982,
                    good_for=["food", "shopping", "wellness", "nightlife", "cafes"]),
        ],
        narrow_lane_zones=[(24.5797, 73.6838, 800)],  # old city around Jagdish Temple / Gangaur Ghat
        arrival_points={
            "flight": ArrivalPoint(id="airport", name="Maharana Pratap Airport (UDR)", lat=24.61982, lng=73.89039),
            "train": ArrivalPoint(id="station", name="Udaipur City railway station", lat=24.56749, lng=73.69955),
            "bus": ArrivalPoint(id="bus_stand", name="Udaipur bus stand", lat=24.57589, lng=73.70084),
        },
        emergency=[
            EmergencyContact(label="All emergencies (police, fire, ambulance)", number="112"),
            EmergencyContact(label="Ambulance", number="108"),
            EmergencyContact(label="Fire", number="101"),
            EmergencyContact(label="Women's helpline", number="1091"),
            EmergencyContact(label="Tourist helpline (Ministry of Tourism)", number="1363"),
        ],
        emergency_source="Government of India public helpline numbers. Confirm locally on arrival.",
        money_notes=[
            "Currency is the Indian Rupee (INR, ₹).",
            "UPI QR payments are widely accepted. Many international cards cannot use UPI, so carry some cash.",
            "Small shops, autos and markets often prefer cash. ATMs are common in the city centre.",
            "Entry tickets for monuments are sometimes priced differently for Indian and foreign visitors.",
        ],
        documents=[
            "Government photo ID (passport for international visitors; Aadhaar, passport or driving licence for Indian citizens)",
            "Visa or e-Visa (international visitors)",
            "Travel tickets or booking references (kept on your phone and printed)",
            "Accommodation confirmation",
            "Driving licence, if you plan to rent a bike, scooter or car (an International Driving Permit for foreign licences)",
            "Travel insurance details",
            "Any prescriptions for medicines you carry",
        ],
    ),
}


def get_destination(dest_id: str) -> Destination:
    try:
        return DESTINATIONS[dest_id]
    except KeyError:
        raise KeyError(f"Unknown destination '{dest_id}'")
