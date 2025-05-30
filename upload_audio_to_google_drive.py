from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import mimetypes

creds = service_account.Credentials.from_service_account_file("neo-notetaker-456809-507e1fca8f9c.json")
drive_service = build("drive", "v3", credentials=creds)

file_metadata = {"name": "output.wav"}
media = MediaFileUpload("output.wav", mimetype="audio/wav")
file = drive_service.files().create(body=file_metadata, media_body=media, fields="id").execute()
print("Uploaded to Drive, File ID:", file.get("id"))
