import requests
import time

def test_upload():
    url = "http://0.0.0.0:8000"
    file_content = """[축의금축내는놈] [오전 10:16] 몰라요
[박호영] [오전 10:16] 로드 행복주택 신혼부부 아님?
[축의금축내는놈] [오전 10:17] 저는 청년"""
    
    with open("test_chat.txt", "w") as f:
        f.write(file_content)
        
    print("Uploading file...")
    with open("test_chat.txt", "rb") as f:
        resp = requests.post(f"{url}/upload", files={"file": f})
        
    if resp.status_code != 200:
        print(f"Upload failed: {resp.text}")
        return
        
    job_id = resp.json()["job_id"]
    print(f"Job ID: {job_id}")
    
    for _ in range(30):
        resp = requests.get(f"{url}/jobs/{job_id}")
        data = resp.json()
        print(f"Status: {data['status']}, Progress: {data['progress']}")
        if data["status"] in ["done", "error"]:
            break
        time.sleep(2)

if __name__ == "__main__":
    test_upload()
