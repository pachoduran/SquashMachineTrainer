from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# Models
class DeviceCreate(BaseModel):
    mac_address: str
    name: str
    role: str  # "machine", "pod1", "pod2", "pod3", "unassigned"


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None


class DeviceResponse(BaseModel):
    id: str
    mac_address: str
    name: str
    role: str
    created_at: str


# Routes
@api_router.get("/")
async def root():
    return {"message": "Squash Machine Trainer Lite API"}


@api_router.get("/devices", response_model=List[DeviceResponse])
async def get_devices():
    devices = await db.devices.find({}, {"_id": 0}).to_list(100)
    return devices


@api_router.post("/devices", response_model=DeviceResponse)
async def create_device(device: DeviceCreate):
    # Check if device with same MAC already exists
    existing = await db.devices.find_one(
        {"mac_address": device.mac_address}, {"_id": 0}
    )
    if existing:
        await db.devices.update_one(
            {"mac_address": device.mac_address},
            {"$set": {"role": device.role, "name": device.name}},
        )
        updated = await db.devices.find_one(
            {"mac_address": device.mac_address}, {"_id": 0}
        )
        return updated

    # If role is assigned, unassign from other devices first
    if device.role not in ["unassigned", ""]:
        await db.devices.update_many(
            {"role": device.role}, {"$set": {"role": "unassigned"}}
        )

    device_dict = {
        "id": str(uuid.uuid4()),
        "mac_address": device.mac_address,
        "name": device.name,
        "role": device.role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.devices.insert_one(device_dict)
    result = await db.devices.find_one({"id": device_dict["id"]}, {"_id": 0})
    return result


@api_router.delete("/devices/{device_id}")
async def delete_device(device_id: str):
    result = await db.devices.delete_one({"id": device_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"deleted": True}


@api_router.put("/devices/{device_id}", response_model=DeviceResponse)
async def update_device(device_id: str, update: DeviceUpdate):
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "role" in update_dict and update_dict["role"] not in ["unassigned", ""]:
        await db.devices.update_many(
            {"role": update_dict["role"], "id": {"$ne": device_id}},
            {"$set": {"role": "unassigned"}},
        )

    result = await db.devices.update_one({"id": device_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Device not found")

    updated = await db.devices.find_one({"id": device_id}, {"_id": 0})
    return updated


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_db():
    await db.devices.create_index("id", unique=True)
    await db.devices.create_index("mac_address", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
