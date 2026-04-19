"""
Backend API tests for Squash Machine Trainer Lite
Tests: Device CRUD operations, role assignment, duplicate MAC handling
"""
import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in environment")
BASE_URL = BASE_URL.rstrip('/')


class TestHealthCheck:
    """Health check and basic connectivity"""

    def test_root_endpoint(self):
        """Test GET /api/ returns welcome message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Squash Machine Trainer Lite" in data["message"]


class TestDevicesCRUD:
    """Device CRUD operations with persistence verification"""

    def test_get_devices_initially_empty(self):
        """Test GET /api/devices returns array (may be empty or have data)"""
        response = requests.get(f"{BASE_URL}/api/devices")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_device_and_verify(self):
        """Test POST /api/devices creates device and persists to DB"""
        payload = {
            "mac_address": "TEST:AA:BB:CC:DD:01",
            "name": "TEST_Device_1",
            "role": "machine"
        }
        create_response = requests.post(f"{BASE_URL}/api/devices", json=payload)
        assert create_response.status_code == 200
        
        created = create_response.json()
        assert created["mac_address"] == payload["mac_address"]
        assert created["name"] == payload["name"]
        assert created["role"] == payload["role"]
        assert "id" in created
        assert "created_at" in created
        device_id = created["id"]

        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/devices")
        assert get_response.status_code == 200
        devices = get_response.json()
        found = next((d for d in devices if d["id"] == device_id), None)
        assert found is not None
        assert found["mac_address"] == payload["mac_address"]

        # Cleanup
        requests.delete(f"{BASE_URL}/api/devices/{device_id}")

    def test_create_device_with_duplicate_mac_updates(self):
        """Test POST with same MAC address updates instead of creating duplicate"""
        mac = "TEST:AA:BB:CC:DD:02"
        
        # Create first device
        payload1 = {"mac_address": mac, "name": "TEST_First", "role": "pod1"}
        response1 = requests.post(f"{BASE_URL}/api/devices", json=payload1)
        assert response1.status_code == 200
        device1 = response1.json()
        device_id = device1["id"]

        # Create second device with same MAC but different name/role
        payload2 = {"mac_address": mac, "name": "TEST_Updated", "role": "pod2"}
        response2 = requests.post(f"{BASE_URL}/api/devices", json=payload2)
        assert response2.status_code == 200
        device2 = response2.json()

        # Should return same ID (updated, not created)
        assert device2["id"] == device_id
        assert device2["name"] == "TEST_Updated"
        assert device2["role"] == "pod2"

        # Verify only one device exists with this MAC
        get_response = requests.get(f"{BASE_URL}/api/devices")
        devices = get_response.json()
        matching = [d for d in devices if d["mac_address"] == mac]
        assert len(matching) == 1

        # Cleanup
        requests.delete(f"{BASE_URL}/api/devices/{device_id}")

    def test_delete_device_and_verify(self):
        """Test DELETE /api/devices/{id} removes device"""
        # Create device
        payload = {"mac_address": "TEST:AA:BB:CC:DD:03", "name": "TEST_ToDelete", "role": "pod3"}
        create_response = requests.post(f"{BASE_URL}/api/devices", json=payload)
        device_id = create_response.json()["id"]

        # Delete device
        delete_response = requests.delete(f"{BASE_URL}/api/devices/{device_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["deleted"] == True

        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/devices")
        devices = get_response.json()
        found = next((d for d in devices if d["id"] == device_id), None)
        assert found is None

    def test_delete_nonexistent_device_returns_404(self):
        """Test DELETE with invalid ID returns 404"""
        response = requests.delete(f"{BASE_URL}/api/devices/nonexistent-id-12345")
        assert response.status_code == 404

    def test_update_device_role_and_verify(self):
        """Test PUT /api/devices/{id} updates device role"""
        # Create device
        payload = {"mac_address": "TEST:AA:BB:CC:DD:04", "name": "TEST_ToUpdate", "role": "unassigned"}
        create_response = requests.post(f"{BASE_URL}/api/devices", json=payload)
        device_id = create_response.json()["id"]

        # Update role
        update_payload = {"role": "machine"}
        update_response = requests.put(f"{BASE_URL}/api/devices/{device_id}", json=update_payload)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["role"] == "machine"

        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/devices")
        devices = get_response.json()
        found = next((d for d in devices if d["id"] == device_id), None)
        assert found["role"] == "machine"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/devices/{device_id}")

    def test_update_nonexistent_device_returns_404(self):
        """Test PUT with invalid ID returns 404"""
        response = requests.put(f"{BASE_URL}/api/devices/nonexistent-id-12345", json={"role": "machine"})
        assert response.status_code == 404


class TestRoleAssignment:
    """Role assignment and reassignment logic"""

    def test_assigning_role_unassigns_from_previous_device(self):
        """Test assigning a role to device B unassigns it from device A"""
        # Create device A with role "machine"
        payload_a = {"mac_address": "TEST:AA:BB:CC:DD:05", "name": "TEST_DeviceA", "role": "machine"}
        response_a = requests.post(f"{BASE_URL}/api/devices", json=payload_a)
        device_a_id = response_a.json()["id"]

        # Create device B with role "machine" (should unassign from A)
        payload_b = {"mac_address": "TEST:AA:BB:CC:DD:06", "name": "TEST_DeviceB", "role": "machine"}
        response_b = requests.post(f"{BASE_URL}/api/devices", json=payload_b)
        device_b_id = response_b.json()["id"]

        # Verify device A is now unassigned
        get_response = requests.get(f"{BASE_URL}/api/devices")
        devices = get_response.json()
        device_a = next((d for d in devices if d["id"] == device_a_id), None)
        device_b = next((d for d in devices if d["id"] == device_b_id), None)

        assert device_a["role"] == "unassigned"
        assert device_b["role"] == "machine"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/devices/{device_a_id}")
        requests.delete(f"{BASE_URL}/api/devices/{device_b_id}")

    def test_update_role_unassigns_from_previous_device(self):
        """Test updating device role via PUT unassigns from previous device"""
        # Create device A with role "pod1"
        payload_a = {"mac_address": "TEST:AA:BB:CC:DD:07", "name": "TEST_DeviceA", "role": "pod1"}
        response_a = requests.post(f"{BASE_URL}/api/devices", json=payload_a)
        device_a_id = response_a.json()["id"]

        # Create device B with role "unassigned"
        payload_b = {"mac_address": "TEST:AA:BB:CC:DD:08", "name": "TEST_DeviceB", "role": "unassigned"}
        response_b = requests.post(f"{BASE_URL}/api/devices", json=payload_b)
        device_b_id = response_b.json()["id"]

        # Update device B to role "pod1" (should unassign from A)
        update_response = requests.put(f"{BASE_URL}/api/devices/{device_b_id}", json={"role": "pod1"})
        assert update_response.status_code == 200

        # Verify device A is now unassigned
        get_response = requests.get(f"{BASE_URL}/api/devices")
        devices = get_response.json()
        device_a = next((d for d in devices if d["id"] == device_a_id), None)
        device_b = next((d for d in devices if d["id"] == device_b_id), None)

        assert device_a["role"] == "unassigned"
        assert device_b["role"] == "pod1"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/devices/{device_a_id}")
        requests.delete(f"{BASE_URL}/api/devices/{device_b_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
