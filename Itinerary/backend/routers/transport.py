from fastapi import APIRouter, HTTPException

from destinations import get_destination
from models.common import Envelope
from models.itinerary import TripRequest
from models.transport import TransportResults
from services import transport_service

router = APIRouter(prefix="/api/transport", tags=["transport"])


@router.post("/search", response_model=Envelope[TransportResults | None])
async def search(req: TripRequest):
    if not req.origin:
        raise HTTPException(400, "An origin is needed to search transport")
    res, st = await transport_service.search(req, get_destination(req.destination_id))
    return Envelope(data=res, providers=st)
